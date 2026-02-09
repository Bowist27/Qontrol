const { Client } = require('pg');

/**
 * Test Script: Generate Perfect Match Physical Scans
 * 
 * This script directly inserts physical scans into the database
 * matching the theoretical inventory from an audit
 */

const AUDIT_ID = parseInt(process.argv[2]) || 1;
const DEVICE_ID = 'TEST-DEVICE-PERFECT-MATCH';

// Load environment variables from .env file
require('dotenv').config({ path: '../../.env' });

const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: process.env.POSTGRES_DB || 'qontrol',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD
};

async function generatePerfectMatch() {
    const client = new Client(dbConfig);

    try {
        console.log(`\n🎯 Generating perfect match audit for Audit ID: ${AUDIT_ID}\n`);

        await client.connect();
        console.log('✓ Connected to database');

        // Step 1: Get theoretical items
        console.log('\n📋 Fetching theoretical items...');
        const itemsResult = await client.query(`
            SELECT product_code, product_name, expected_qty
            FROM audit_items
            WHERE audit_id = $1
              AND expected_qty > 0
            ORDER BY product_code
        `, [AUDIT_ID]);

        const items = itemsResult.rows;
        console.log(`   Found ${items.length} theoretical items with expected qty > 0\n`);

        if (items.length === 0) {
            console.log('⚠️  No items found. Make sure the audit exists and has items.');
            return;
        }

        // Step 2: Delete existing physical scans for this audit (optional - comment out if you want to keep existing scans)
        console.log('🗑️  Clearing existing physical scans...');
        await client.query('DELETE FROM audit_physical WHERE audit_id = $1', [AUDIT_ID]);
        console.log('   ✓ Cleared\n');

        // Step 3: Create matching physical scans
        console.log('🔨 Creating physical scans...');
        let successCount = 0;

        for (const item of items) {
            try {
                await client.query(`
                    INSERT INTO audit_physical (audit_id, barcode, quantity, device_id, scanned_at)
                    VALUES ($1, $2, $3, $4, NOW() - interval '1 minute' * random() * 5)
                `, [AUDIT_ID, item.product_code, item.expected_qty, DEVICE_ID]);

                successCount++;
                if (successCount % 100 === 0) {
                    console.log(`   ✓ ${successCount}/${items.length} scans created...`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to create scan for ${item.product_code}:`, error.message);
            }
        }

        console.log(`   ✓ ${successCount}/${items.length} scans created\n`);

        // Step 4: Verify results
        console.log('📊 Verification:');
        const statsResult = await client.query(`
            SELECT 
                COUNT(*) as total_scans,
                SUM(quantity) as total_quantity,
                COUNT(DISTINCT barcode) as unique_products
            FROM audit_physical
            WHERE audit_id = $1
        `, [AUDIT_ID]);

        const stats = statsResult.rows[0];
        console.log(`   Total scans: ${stats.total_scans}`);
        console.log(`   Total quantity: ${stats.total_quantity}`);
        console.log(`   Unique products: ${stats.unique_products}`);

        console.log(`\n✅ Complete! Refresh the audit page to see the results.\n`);

    } catch (error) {
        console.error('\n💥 Script failed:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);
        console.error('   Details:', error);
        process.exit(1);
    } finally {
        try {
            await client.end();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Run the script
generatePerfectMatch();
