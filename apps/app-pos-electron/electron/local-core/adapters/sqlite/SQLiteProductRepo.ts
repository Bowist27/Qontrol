import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { Product, ProductSyncStats } from '../../domain/Product';
import { ProductRepository } from '../../ports/ProductRepository';

export class SQLiteProductRepo implements ProductRepository {
    private db: Database.Database;

    constructor() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'user_data.db');
        fs.ensureDirSync(userDataPath);
        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    private initializeSchema() {
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

    findByBarcode(barcode: string): Product | undefined {
        const stmt = this.db.prepare('SELECT * FROM products WHERE barcode = ?');
        return stmt.get(barcode) as Product | undefined;
    }

    findBySku(sku: string): Product | undefined {
        const stmt = this.db.prepare('SELECT * FROM products WHERE sku = ?');
        return stmt.get(sku) as Product | undefined;
    }

    search(query: string): Product[] {
        const stmt = this.db.prepare(`
            SELECT * FROM products 
            WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ?
            LIMIT 50
        `);
        const pattern = `%${query}%`;
        return stmt.all(pattern, pattern, pattern) as Product[];
    }

    count(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM products');
        const result = stmt.get() as { count: number };
        return result.count;
    }

    getAll(): Product[] {
        const stmt = this.db.prepare('SELECT * FROM products ORDER BY name');
        return stmt.all() as Product[];
    }

    saveBatch(products: Product[]): ProductSyncStats {
        const insert = this.db.prepare(`
            INSERT OR REPLACE INTO products (
                id, sku, barcode, name, unit, last_price, created_at
            )
            VALUES (
                @id, @sku, @barcode, @name, @unit, @last_price, @created_at
            )
        `);

        const insertMany = this.db.transaction((products: Product[]) => {
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
