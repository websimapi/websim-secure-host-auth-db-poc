import { openDB } from 'idb';
import { COLLECTION_NAME } from './constants.js';

const DB_NAME = 'WebsimHostBackup';
const STORE_NAME = 'player_records';

export class LocalDB {
    constructor() {
        this.dbPromise = null;
    }

    async init() {
        this.dbPromise = openDB(DB_NAME, 2, {
            upgrade(db) {
                // Reset store to use username as key for better identity persistence
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }
                db.createObjectStore(STORE_NAME, { keyPath: 'username' });
            },
        });
        await this.dbPromise;
        console.log("IndexedDB Initialized");
    }

    async saveRecord(record) {
        const db = await this.dbPromise;
        await db.put(STORE_NAME, record);
    }

    async getRecord(username) {
        const db = await this.dbPromise;
        return await db.get(STORE_NAME, username);
    }

    async getAllRecords() {
        const db = await this.dbPromise;
        return await db.getAll(STORE_NAME);
    }

    async deleteRecord(username) {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, username);
    }
}

