import { COLLECTION_NAME, MSG_TYPES } from './constants.js';

export class ClientManager {
    constructor(room, user, visuals, hostUsername) {
        this.room = room;
        this.user = user;
        this.visuals = visuals;
        this.hostUsername = hostUsername;
        this.inputs = { w: false, a: false, s: false, d: false };
        
        this.init();
    }

    log(msg) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.textContent = `[CLIENT]: ${msg}`;
        document.getElementById('logs').prepend(div);
    }

    async init() {
        this.log(`Connecting to host: ${this.hostUsername}`);

        // 1. Subscribe to DB (Read Only Mode)
        this.room.collection(COLLECTION_NAME).subscribe((records) => {
            this.handleDBUpdate(records);
        });

        // 2. Setup Input Listeners
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));

        // 3. Input Loop
        setInterval(() => this.sendInput(), 50); // Send inputs 20 times a second
    }

    handleKey(e, isDown) {
        const key = e.key.toLowerCase();
        if (['w','a','s','d'].includes(key)) {
            this.inputs[key] = isDown;
        }
    }

    sendInput() {
        // Only send if keys are pressed
        if (Object.values(this.inputs).some(v => v)) {
            this.room.send({
                type: MSG_TYPES.INPUT_UPDATE,
                clientId: this.room.clientId,
                input: this.inputs
            });
        }
    }

    handleDBUpdate(records) {
        const container = document.getElementById('db-visualizer');
        container.innerHTML = '';

        // Filter: ONLY process rows that seem to be managed by the host.
        // In this architecture, we trust the DB rows themselves because 
        // only the Host (who owns the project) has write access to the collection 
        // if we were using RLS, but here we manually filter based on logic.
        
        // Actually, in Websim, anyone can write to public collections unless restricted.
        // The prompt says "Client will ONLY read database rows from the host".
        // Since Websim records store the creator's username, we can filter by that.
        
        const trustedRecords = records.filter(r => r.username === this.hostUsername);

        if (trustedRecords.length === 0) {
            this.log("No trusted records from Host found yet.");
        }

        trustedRecords.forEach(record => {
            // Visualize
            const div = document.createElement('div');
            div.className = 'db-row';
            div.style.borderColor = '#4caf50'; // Green for trusted
            div.innerHTML = `
                <strong>TRUSTED SOURCE</strong><br>
                <strong>ID:</strong> ${record.player_id ? record.player_id.substring(0,8) : '?'}<br>
                <strong>Pos:</strong> ${record.col_1?.x?.toFixed(1) || 0}
            `;
            container.appendChild(div);

            // Update Visuals
            if (record.col_1 && record.player_id) {
                this.visuals.updatePlayer(record.player_id, record.col_1);
                
                if (record.player_id === this.room.clientId) {
                    // Update camera to follow my player
                    this.visuals.controls.target.set(record.col_1.x, record.col_1.y, record.col_1.z);
                    this.visuals.controls.update();
                }
            }
        });
    }
}

