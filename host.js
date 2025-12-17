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
        
        this.log("Host Ready. Waiting for peers.");
    }

    async handleRemoteDBUpdate(records) {
        // As Host, we are the authority. 
        // We mainly listen to this to ensure our writes landed, 
        // OR to recover if we crashed and reloaded (fetching from server).
        
        // Visualize the DB for the user
        this.updateDBUI(records);
        
        // Render the scene based on valid records
        records.forEach(record => {
            if (record.col_1) {
                this.visuals.updatePlayer(record.player_id, record.col_1);
            }
        });
    }

    handleMessage(data) {
        if (data.type === MSG_TYPES.INPUT_UPDATE) {
            this.processInput(data);
        }
    }

    async processInput(data) {
        const playerId = data.clientId;
        // In a real game, we would validate move distance here to prevent speed hacks.
        
        // Fetch current state from memory/IDB
        let record = await this.localDB.getRecord(playerId);
        
        if (!record) {
            // New player or missing record
            record = createEmptyRow(playerId);
            this.log(`Created new record for ${playerId}`);
        }

        // Update Column 1 (Player Data)
        // Apply input vectors
        const speed = 0.2;
        if (data.input.w) record.col_1.z -= speed;
        if (data.input.s) record.col_1.z += speed;
        if (data.input.a) record.col_1.x -= speed;
        if (data.input.d) record.col_1.x += speed;
        
        record.last_updated = Date.now();

        // Save to LocalDB immediately
        await this.localDB.saveRecord(record);
        
        // Mark for cloud sync
        this.pendingUpdates.set(playerId, record);
    }

    async checkPresence() {
        // Check room.peers. If a peer exists but has no DB row, create one.
        // If a DB row exists but peer is gone, we might mark as inactive.
        
        for (const [clientId, peerData] of Object.entries(this.room.peers)) {
            const exists = await this.localDB.getRecord(clientId);
            if (!exists) {
                this.log(`Discovered new peer ${peerData.username}, initializing DB row.`);
                const newRow = createEmptyRow(clientId);
                await this.localDB.saveRecord(newRow);
                this.pendingUpdates.set(clientId, newRow);
            }
        }
    }

    async syncState() {
        if (this.pendingUpdates.size === 0) return;

        // Process a batch of updates
        const updates = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();

        // Get current remote state to find IDs
        const remoteRecords = this.room.collection(COLLECTION_NAME).getList();

        for (const update of updates) {
            const existingRemote = remoteRecords.find(r => r.player_id === update.player_id);
            
            try {
                if (existingRemote) {
                    // Update existing
                    await this.room.collection(COLLECTION_NAME).update(existingRemote.id, update);
                } else {
                    // Create new in cloud
                    // Note: This might fail if we hit the 1k row limit, 
                    // in which case we should delete old rows.
                    await this.room.collection(COLLECTION_NAME).create(update);
                }
            } catch (e) {
                console.error("Sync failed", e);
                // Put back in queue?
            }
        }
    }

    updateDBUI(records) {
        const container = document.getElementById('db-visualizer');
        container.innerHTML = '';
        records.forEach(r => {
            const div = document.createElement('div');
            div.className = 'db-row';
            div.innerHTML = `
                <strong>ID:</strong> ${r.player_id.substring(0,8)}...<br>
                <strong>Pos:</strong> ${r.col_1.x.toFixed(1)}, ${r.col_1.z.toFixed(1)}<br>
                <strong>Updated:</strong> ${new Date(r.last_updated).toLocaleTimeString()}
            `;
            container.appendChild(div);
        });
    }
}

