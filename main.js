import { GameVisuals } from './visuals.js';
import { HostManager } from './host.js';
import { ClientManager } from './client.js';

async function main() {
    const statusEl = document.getElementById('connection-status');
    const roleEl = document.getElementById('role-display');

    // 1. Setup Networking
    const room = new WebsimSocket();
    await room.initialize();
    
    // 2. Identify Identity
    const creator = await window.websim.getCreatedBy();
    const me = await window.websim.getCurrentUser();
    
    const isHost = creator.username === me.username;

    // 3. Setup Visuals
    const visuals = new GameVisuals();

    // 4. Branch Logic
    if (isHost) {
        roleEl.textContent = "ROLE: HOST (AUTHORITY)";
        roleEl.className = "role-badge role-host";
        statusEl.textContent = "Hosting Database. Accepting Connections.";
        
        new HostManager(room, me, visuals);
    } else {
        roleEl.textContent = "ROLE: CLIENT";
        roleEl.className = "role-badge role-client";
        statusEl.textContent = `Looking for host: ${creator.username}`;

        // Check if host is online via Peers
        // Note: This is a loose check, the host might be online but not running this app.
        // We proceed anyway to listen to the DB.
        
        new ClientManager(room, me, visuals, creator.username);
    }

    // Add help text about Host requirement
    const help = document.createElement('div');
    help.style.fontSize = '10px';
    help.style.marginTop = '10px';
    help.style.color = '#888';
    help.innerText = isHost 
        ? "You are the creator. You hold the Master DB (IndexedDB) and sync it to the Cloud." 
        : "You are a client. You only read DB rows created by the Host. If the Host is offline, nothing moves.";
    document.getElementById('status-panel').appendChild(help);
}

main().catch(console.error);

