/**
 * Database wrapper for sql.js (pure JavaScript SQLite)
 * Compatible with Plesk hosting without native compilation
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'imagony.db');

let db = null;
let SQL = null;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Initialize database
 */
async function initDB() {
    if (db) return db;
    
    SQL = await initSqlJs();
    
    try {
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log('📂 Loaded existing database');
        } else {
            db = new SQL.Database();
            console.log('🆕 Created new database');
        }
    } catch (error) {
        console.error('Database init error:', error);
        db = new SQL.Database();
    }
    
    return db;
}

/**
 * Save database to file
 */
function saveDB() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (error) {
        console.error('Database save error:', error);
    }
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE, CREATE)
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            db.run(sql, params);
            saveDB();
            resolve({ changes: db.getRowsModified() });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get single row
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                resolve(row);
            } else {
                stmt.free();
                resolve(null);
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get all rows
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            resolve(rows);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Serialize operations (compatibility with sqlite3 API)
 */
function serialize(callback) {
    callback();
    saveDB();
}

/**
 * Close database
 */
function close() {
    if (db) {
        saveDB();
        db.close();
        db = null;
    }
}

module.exports = {
    initDB,
    run,
    get,
    all,
    serialize,
    saveDB,
    close,
    getDB: () => db
};
