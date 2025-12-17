import { LocalDB } from './indexed_db.js';
import { COLLECTION_NAME, createEmptyRow, MSG_TYPES, COLUMNS } from './constants.js';

export class HostManager {
    constructor(room, user, visuals) {
        this.room = room;
        this.user = user;
        this.visuals = visuals;
        this.localDB = new LocalDB();
        this.pendingUpdates = new Map(); // Debounce map
        
        this.init();
    }

    log(msg) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.style.color = '#ffaaaa';
        div.textContent = `[HOST]: ${msg}`;
        document.getElementById('logs').prepend(div);
        console.log(`[HOST] ${msg}`);
    }

    async init() {
        this.log("Initializing Host Authority...");
        
        // 1. Init Local Storage
        await this.localDB.init();

        // 2. Subscribe to remote DB
        this.room.collection(COLLECTION_NAME).subscribe((records) => {
            this.handleRemoteDBUpdate(records);
        });

        // 3. Handle incoming events/requests from clients
        this.room.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        // 4. Sync Cycle (Periodically push state to DB)
        setInterval(() => this.syncState(), 100); 

        // 5. Cleanup inactive players periodically
        setInterval(() => this.checkPresence(), 5000);

        // 6. Game Logic Loop (Movement Simulation)
        setInterval(() => this.gameLoop(), 50);
        
        this.log("Host Ready. Waiting for peers.");
    }

    async handleRemoteDBUpdate(records) {
        this.updateDBUI(records);
        records.forEach(record => {
            if (record.col_1 && record.player_username) {
                this.visuals.updatePlayer(record.player_username, record.col_1);
            }
        });
    }

    handleMessage(data) {
        if (data.type === MSG_TYPES.INPUT_UPDATE || data.type === MSG_TYPES.CLICK_MOVE) {
            this.processInput(data);
        }
    }

    async processInput(data) {
        const peer = this.room.peers[data.clientId];
        if (!peer || !peer.username) return;

        const username = peer.username;
        let record = await this.localDB.getRecord(username);
        
        if (!record) {
            record = createEmptyRow(username);
            this.log(`Created new persistent record for ${username}`);
        }

        const speed = 0.2;
        if (data.type === MSG_TYPES.INPUT_UPDATE) {
            // WASD cancels auto-movement
            record.col_1.targetX = null; 
            record.col_1.targetZ = null;
            
            if (data.input.w) record.col_1.z -= speed;
            if (data.input.s) record.col_1.z += speed;
            if (data.input.a) record.col_1.x -= speed;
            if (data.input.d) record.col_1.x += speed;
        } else if (data.type === MSG_TYPES.CLICK_MOVE) {
            record.col_1.targetX = data.target.x;
            record.col_1.targetZ = data.target.z;
        }
        
        record.last_updated = Date.now();
        await this.localDB.saveRecord(record);
        this.pendingUpdates.set(username, record);
    }

    async gameLoop() {
        // Handle automated movement (Click to Move)
        // Iterate peers to find active players
        for (const [clientId, peer] of Object.entries(this.room.peers)) {
            if (!peer || !peer.username) continue;

            const record = await this.localDB.getRecord(peer.username);
            if (record && record.col_1.targetX !== null) {
                const speed = 0.2;
                const dx = record.col_1.targetX - record.col_1.x;
                const dz = record.col_1.targetZ - record.col_1.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist < speed) {
                    record.col_1.x = record.col_1.targetX;
                    record.col_1.z = record.col_1.targetZ;
                    record.col_1.targetX = null;
                    record.col_1.targetZ = null;
                } else {
                    record.col_1.x += (dx / dist) * speed;
                    record.col_1.z += (dz / dist) * speed;
                }
                
                record.last_updated = Date.now();
                await this.localDB.saveRecord(record);
                this.pendingUpdates.set(peer.username, record);
            }
        }
    }

    async checkPresence() {
        for (const [clientId, peerData] of Object.entries(this.room.peers)) {
            if (!peerData || !peerData.username) continue;

            const exists = await this.localDB.getRecord(peerData.username);
            if (!exists) {
                this.log(`Discovered new peer ${peerData.username}, initializing DB row.`);
                const newRow = createEmptyRow(peerData.username);
                await this.localDB.saveRecord(newRow);
                this.pendingUpdates.set(peerData.username, newRow);
            }
        }
    }

    async syncState() {
        if (this.pendingUpdates.size === 0) return;

        const updates = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();

        const remoteRecords = this.room.collection(COLLECTION_NAME).getList();

        for (const update of updates) {
            // Find remote record by our custom identity field
            const existingRemote = remoteRecords.find(r => r.player_username === update.player_username);
            
            try {
                if (existingRemote) {
                    await this.room.collection(COLLECTION_NAME).update(existingRemote.id, update);
                } else {
                    await this.room.collection(COLLECTION_NAME).create(update);
                }
            } catch (e) {
                console.error("Sync failed", e);
            }
        }
    }

    updateDBUI(records) {
        const container = document.getElementById('db-visualizer');
        container.innerHTML = '';
        records.forEach(r => {
            const pUser = r.player_username || 'Unknown';
            const div = document.createElement('div');
            div.className = 'db-row';
            div.innerHTML = `
                <strong>USER:</strong> ${pUser}<br>
                <strong>Pos:</strong> ${r.col_1.x.toFixed(1)}, ${r.col_1.z.toFixed(1)}<br>
                <strong>Updated:</strong> ${new Date(r.last_updated).toLocaleTimeString()}
            `;
            container.appendChild(div);
        });
    }
}

