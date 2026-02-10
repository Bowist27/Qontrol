"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteProductRepo = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const electron_1 = require("electron");
class SQLiteProductRepo {
    constructor() {
        const userDataPath = electron_1.app.getPath('userData');
        const dbPath = path_1.default.join(userDataPath, 'user_data.db');
        fs_extra_1.default.ensureDirSync(userDataPath);
        this.db = new better_sqlite3_1.default(dbPath);
        this.initializeSchema();
    }
    initializeSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                sku TEXT UNIQUE NOT NULL,
                barcode TEXT,
                name TEXT NOT NULL,
                unit TEXT DEFAULT 'pz',
                last_price REAL,
                created_at TEXT
            )
        `);
        // Index for fast barcode lookup (critical for scanning)
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)
        `);
    }
    findByBarcode(barcode) {
        const stmt = this.db.prepare('SELECT * FROM products WHERE barcode = ?');
        return stmt.get(barcode);
    }
    findBySku(sku) {
        const stmt = this.db.prepare('SELECT * FROM products WHERE sku = ?');
        return stmt.get(sku);
    }
    search(query) {
        const stmt = this.db.prepare(`
            SELECT * FROM products 
            WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ?
            LIMIT 50
        `);
        const pattern = `%${query}%`;
        return stmt.all(pattern, pattern, pattern);
    }
    count() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM products');
        const result = stmt.get();
        return result.count;
    }
    getAll() {
        const stmt = this.db.prepare('SELECT * FROM products ORDER BY name');
        return stmt.all();
    }
    saveOne(product) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO products (sku, barcode, name, unit, last_price, created_at)
            VALUES (@sku, @barcode, @name, @unit, @last_price, @created_at)
        `);
        const result = stmt.run({
            sku: product.sku,
            barcode: product.barcode || null,
            name: product.name || product.sku,
            unit: product.unit || 'pz',
            last_price: product.last_price || null,
            created_at: new Date().toISOString()
        });
        return {
            id: result.lastInsertRowid,
            sku: product.sku,
            barcode: product.barcode || null,
            name: product.name || product.sku,
            unit: product.unit || 'pz',
            last_price: product.last_price || null,
            created_at: new Date().toISOString()
        };
    }
    saveBatch(products) {
        const insert = this.db.prepare(`
            INSERT OR REPLACE INTO products (
                id, sku, barcode, name, unit, last_price, created_at
            )
            VALUES (
                @id, @sku, @barcode, @name, @unit, @last_price, @created_at
            )
        `);
        const insertMany = this.db.transaction((products) => {
            let added = 0;
            for (const product of products) {
                insert.run({
                    id: product.id,
                    sku: product.sku,
                    barcode: product.barcode || null,
                    name: product.name,
                    unit: product.unit || 'pz',
                    last_price: product.last_price || null,
                    created_at: product.created_at || new Date().toISOString()
                });
                added++;
            }
            return added;
        });
        const count = insertMany(products);
        return {
            added: count,
            updated: 0,
            total: this.count()
        };
    }
}
exports.SQLiteProductRepo = SQLiteProductRepo;
//# sourceMappingURL=SQLiteProductRepo.js.map