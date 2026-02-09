-- =================================================================
-- Test Script: Create Perfect Match Audit
-- Purpose: Generate physical scans that match theoretical inventory
-- =================================================================

-- Step 1: Get the audit ID you want to test
-- Replace AUDIT_ID with your actual audit session ID
\set audit_id 1

-- Step 2: Generate physical scans matching theoretical inventory
-- This inserts physical scans for all theoretical items with matching quantities
INSERT INTO audit_physical (audit_id, barcode, quantity, device_id, scanned_at)
SELECT 
    :audit_id,                          -- The audit session ID
    ai.product_code,                     -- Using product_code as barcode (SKU)
    ai.expected_qty,                     -- Match theoretical quantity exactly
    'TEST-DEVICE-001',                   -- Simulated device ID
    CURRENT_TIMESTAMP - (random() * interval '5 minutes')  -- Random time within last 5 min
FROM audit_items ai
WHERE ai.audit_id = :audit_id
  AND ai.expected_qty > 0                -- Only products with expected quantity
ORDER BY ai.product_code;

-- Step 3: Verify the results
SELECT 
    COUNT(*) as total_scans,
    SUM(quantity) as total_quantity,
    COUNT(DISTINCT barcode) as unique_products
FROM audit_physical
WHERE audit_id = :audit_id;

-- Step 4: Check summary statistics
SELECT 
    'Theoretical' as type,
    COUNT(*) as items,
    SUM(expected_qty) as total_units
FROM audit_items
WHERE audit_id = :audit_id

UNION ALL

SELECT 
    'Physical' as type,
    COUNT(DISTINCT barcode) as items,
    SUM(quantity) as total_units
FROM audit_physical
WHERE audit_id = :audit_id

UNION ALL

SELECT 
    'Discrepancies' as type,
    COUNT(*) as items,
    SUM(ABS(COALESCE(p.qty, 0) - ai.expected_qty)) as total_diff
FROM audit_items ai
LEFT JOIN (
    SELECT barcode, SUM(quantity) as qty
    FROM audit_physical
    WHERE audit_id = :audit_id
    GROUP BY barcode
) p ON p.barcode = ai.product_code
WHERE ai.audit_id = :audit_id;
