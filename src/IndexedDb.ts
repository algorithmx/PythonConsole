/**
 * IndexedDb.ts
 * adapted from https://gist.githubusercontent.com/ANUPAMCHAUDHARY1117/4a7abca0705ab212d39417da5427e26d/raw/6ee57b2c147c54be5de72a7058b66e2492bf8bc7/IndexedDb.ts
 * see the post https://javascript.plainenglish.io/working-with-indexeddb-in-typescript-react-ad504a1bdae3
 */
import { IDBPDatabase, DBSchema, StoreNames, StoreValue, StoreKey, openDB } from 'idb';

class IndexedDb<DBTypes extends DBSchema> {
    private database: string;
    private db: IDBPDatabase<DBTypes> | null = null;

    constructor(database: string) {
        this.database = database;
    }

    /**
     * Creates object stores in the IndexedDB database if they do not already exist.
     *
     * This method opens the database and upgrades its schema to include the specified object stores.
     * Each object store is created with an auto-incrementing primary key based on the 'id' field.
     *
     * @param {StoreNames<DBTypes>[]} tableNames - An array of names for the object stores to be created.
     * @returns {Promise<boolean>} A promise that resolves to true if the object stores were created successfully, or false if an error occurred.
     * @throws {Error} Throws an error if the database cannot be opened or upgraded.
     */
    public async createObjectStore(tableNames: StoreNames<DBTypes>[]) {
        try {
            this.db = await openDB<DBTypes>(this.database, 1, {
                upgrade(db: IDBPDatabase<DBTypes>) {
                    for (const tableName of tableNames) {
                        if (db.objectStoreNames.contains(tableName)) {
                            continue;
                        }
                        db.createObjectStore(tableName, { autoIncrement: true, keyPath: 'id' });
                    }
                },
            });
            return true;
        } catch (error) {
            console.error('Error creating object store:', error);
            return false;
        }
    }

    /**
     * Retrieves a value from the specified object store in the IndexedDB database by its ID.
     *
     * This method checks if the database is initialized, creates a read-only transaction for the specified
     * object store, and retrieves the record associated with the given ID. In non-production environments,
     * it logs the retrieved data to the console for debugging purposes.
     *
     * @param {StoreNames<DBTypes>} tableName - The name of the object store from which to retrieve the value.
     * @param {StoreKey<DBTypes, StoreName>} id - The unique identifier of the record to be retrieved.
     * @returns {Promise<any>} A promise that resolves to the retrieved value, or undefined if not found.
     * @throws {Error} Throws an error if the database is not initialized or if the transaction fails.
     */
    public async getValue<StoreName extends StoreNames<DBTypes>>(tableName: StoreNames<DBTypes>, id: StoreKey<DBTypes, StoreName>) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const tx = this.db.transaction(tableName, 'readonly');
        const store = tx.objectStore(tableName);
        const result = await store.get(id);
        if (process.env.NODE_ENV !== 'production') {
            // console.log('Get Data ', JSON.stringify(result));
        }
        return result;
    }

    /**
     * Retrieves all values from the specified object store in the IndexedDB database.
     *
     * This method checks if the database is initialized, creates a read-only transaction for the specified
     * object store, and retrieves all records within that store. In non-production environments, it logs
     * the retrieved data to the console for debugging purposes.
     *
     * @param {StoreNames<DBTypes>} tableName - The name of the object store from which to retrieve all values.
     * @returns {Promise<any[]>} A promise that resolves to an array of all retrieved values.
     * @throws {Error} Throws an error if the database is not initialized or if the transaction fails.
     */
    public async getAllValue(tableName: StoreNames<DBTypes>) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const tx = this.db.transaction(tableName, 'readonly');
        const store = tx.objectStore(tableName);
        const result = await store.getAll();
        if (process.env.NODE_ENV !== 'production') {
            // console.log('Get All Data', JSON.stringify(result));
        }
        return result;
    }

    /**
     * Inserts or updates a value in the specified object store in the IndexedDB database.
     *
     * This method checks if the database is initialized, creates a read-write transaction for the specified
     * object store, and uses the `put` operation to insert or update the record. An optional key can be provided
     * to specify the record's identifier. In non-production environments, it logs the operation result to the console.
     *
     * @param {StoreName} tableName - The name of the object store where the value will be inserted or updated.
     * @param {StoreValue<DBTypes, StoreName>} value - The value to be inserted or updated in the object store.
     * @param {StoreKey<DBTypes, StoreName>} [key] - An optional unique identifier for the record; if not provided, an auto-generated key will be used.
     * @returns {Promise<IDBValidKey>} A promise that resolves to the key of the inserted or updated record.
     * @throws {Error} Throws an error if the database is not initialized or if the transaction fails.
     */
    public async putValue<StoreName extends StoreNames<DBTypes>>(tableName: StoreName, value: StoreValue<DBTypes, StoreName>, key?: StoreKey<DBTypes, StoreName>) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const tx = this.db.transaction(tableName, 'readwrite');
        const store = tx.objectStore(tableName);
        const result = await store.put(value, key);
        if (process.env.NODE_ENV !== 'production') {
            // console.log('Put Data ', JSON.stringify(result));
        }
        return result;
    }

    /**
     * Inserts or updates multiple values in the specified object store in the IndexedDB database.
     *
     * This method checks if the database is initialized, creates a read-write transaction for the specified
     * object store, and iterates over the provided array of values to insert or update each record using the
     * `put` operation. In non-production environments, it logs the operation results to the console. After
     * all values are processed, it returns the updated list of all records in the object store.
     *
     * @param {StoreName} tableName - The name of the object store where the values will be inserted or updated.
     * @param {StoreValue<DBTypes, StoreName>[]} values - An array of values to be inserted or updated in the object store.
     * @returns {Promise<any[]>} A promise that resolves to an array of all records in the object store after the operation.
     * @throws {Error} Throws an error if the database is not initialized or if the transaction fails.
     */
    public async putBulkValue<StoreName extends StoreNames<DBTypes>>(tableName: StoreName, values: StoreValue<DBTypes, StoreName>[]) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const tx = this.db.transaction(tableName, 'readwrite');
        const store = tx.objectStore(tableName);
        for (const value of values) {
            const result = await store.put(value);
            if (process.env.NODE_ENV !== 'production') {
                // console.log('Put Bulk Data ', JSON.stringify(result));
            }
        }
        return this.getAllValue(tableName);
    }

    /**
     * Deletes a value from the specified object store in the IndexedDB database by its ID.
     *
     * This method checks if the database is initialized, creates a read-write transaction for the specified
     * object store, and attempts to retrieve the record associated with the given ID. If the record is found,
     * it is deleted; otherwise, a message is logged indicating that the ID was not found. In non-production
     * environments, it logs the ID of the deleted record to the console.
     *
     * @param {StoreNames<DBTypes>} tableName - The name of the object store from which the value will be deleted.
     * @param {StoreKey<DBTypes, StoreName>} id - The unique identifier of the record to be deleted.
     * @returns {Promise<StoreKey<DBTypes, StoreName> | undefined>} A promise that resolves to the ID of the deleted record, or undefined if not found.
     * @throws {Error} Throws an error if the database is not initialized or if the transaction fails.
     */
    public async deleteValue<StoreName extends StoreNames<DBTypes>>(tableName: StoreNames<DBTypes>, id: StoreKey<DBTypes, StoreName>) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const tx = this.db.transaction(tableName, 'readwrite');
        const store = tx.objectStore(tableName);
        const result = await store.get(id);
        if (!result) {
            // console.log('Id not found', id);
            return result;
        }
        await store.delete(id);
        if (process.env.NODE_ENV !== 'production') {
            // console.log('Deleted Data', id);
        }
        return id;
    }
}

export default IndexedDb;