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
        window.addEventListener('mousedown', (e) => this.handleClick(e));

        // 3. Input Loop
        setInterval(() => this.sendInput(), 50); 
    }
    
    handleClick(e) {
        if (e.target.tagName !== 'CANVAS') return;
        
        const intersection = this.visuals.getGroundIntersection(e.clientX, e.clientY);
        if (intersection) {
            this.room.send({
                type: MSG_TYPES.CLICK_MOVE,
                clientId: this.room.clientId,
                target: { x: intersection.point.x, z: intersection.point.z }
            });
            
            // Temporary Visual Indicator
            const el = document.createElement('div');
            el.style.cssText = `position:absolute;left:${e.clientX}px;top:${e.clientY}px;width:10px;height:10px;background:white;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0.5;`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 500);
        }
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
            const pUser = record.player_username || 'Unknown';
            
            // Visualize
            const div = document.createElement('div');
            div.className = 'db-row';
            div.style.borderColor = '#4caf50'; 
            div.innerHTML = `
                <strong>USER:</strong> ${pUser}<br>
                <strong>Pos:</strong> ${record.col_1?.x?.toFixed(1) || 0}, ${record.col_1?.z?.toFixed(1) || 0}
            `;
            container.appendChild(div);

            // Update Visuals
            if (record.col_1 && pUser) {
                this.visuals.updatePlayer(pUser, record.col_1);
                
                if (pUser === this.user.username) {
                    // Update camera to follow my player
                    this.visuals.controls.target.set(record.col_1.x, record.col_1.y, record.col_1.z);
                    this.visuals.controls.update();
                }
            }
        });
    }
}

