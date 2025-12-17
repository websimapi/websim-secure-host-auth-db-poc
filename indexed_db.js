import { openDB } from 'idb';
import { COLLECTION_NAME } from './constants.js';

const DB_NAME = 'WebsimHostBackup';
const STORE_NAME = 'player_records';

export class LocalDB {
    constructor() {
        this.dbPromise = null;
    }

    async init() {
        this.dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Use player_id as the key
                    db.createObjectStore(STORE_NAME, { keyPath: 'player_id' });
                }
            },
        });
        await this.dbPromise;
        console.log("IndexedDB Initialized");
    }

    async saveRecord(record) {
        const db = await this.dbPromise;
        await db.put(STORE_NAME, record);
    }

    async getRecord(playerId) {
        const db = await this.dbPromise;
        return await db.get(STORE_NAME, playerId);
    }

    async getAllRecords() {
        const db = await this.dbPromise;
        return await db.getAll(STORE_NAME);
    }

    async deleteRecord(playerId) {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, playerId);
    }
}

