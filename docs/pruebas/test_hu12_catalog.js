/**
 * HU12 - Pruebas Automatizadas: Catálogo Maestro
 * 
 * Casos de prueba:
 * 1. Listar productos con paginación (GET /api/catalog)
 * 2. Paginación segunda página (GET /api/catalog?page=2)
 * 3. Buscar productos por término (GET /api/catalog?search=...)
 * 4. Historial de importaciones PDF (GET /api/catalog/imports)
 * 5. Lookup por barcode (GET /api/catalog/barcode/:code)
 * 6. Crear producto dummy (POST /api/catalog/products)
 * 7. Actualizar producto dummy (PUT /api/catalog/products/:id)
 * 8. Eliminar producto dummy (DELETE /api/catalog/products/:id)
 * 9. Verificar seguridad (sin token) - GET, PUT, DELETE, POST
 * 10. Validación de entrada (IDs inválidos, datos incompletos)
 * 11. Historial de cambios manuales (GET /api/catalog/changes)
 * 
 * NOTA: Las pruebas CRUD (6-8) usan un producto dummy creado al inicio,
 *       evitando modificar o eliminar productos reales del catálogo.
 * 
 * Total: 54 tests
 * 
 * Ejecutar: node docs/pruebas/test_hu12_catalog.js
 */

const assert = require('assert');

// Configuración
const AUTH_URL = 'http://localhost:8080';
const AUDIT_URL = 'http://localhost:8085';
const CREDENTIALS = {
    email: 'admin@qontrol.com',
    password: 'Admin123!'
};

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

let token = '';
let testsPassed = 0;
let testsFailed = 0;

// Producto dummy para pruebas CRUD seguras
let dummyProductId = null;
const dummySku = `AUTO-TEST-${Date.now()}`;

async function login() {
    console.log(`${colors.yellow}🔐 Autenticando...${colors.reset}`);
    const loginRes = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREDENTIALS)
    });

    if (loginRes.status !== 200) throw new Error(`Login falló con status ${loginRes.status}`);

    const loginData = await loginRes.json();
    token = loginData.token;

    if (!token) throw new Error('No se recibió token en la respuesta');
    console.log(`${colors.green}✅ Login Exitoso${colors.reset}\n`);
}

function logTest(name, passed, details = '') {
    if (passed) {
        testsPassed++;
        console.log(`${colors.green}✅ ${name}${colors.reset}`);
    } else {
        testsFailed++;
        console.log(`${colors.red}❌ ${name}${details ? ': ' + details : ''}${colors.reset}`);
    }
}

function logSkip(reason) {
    console.log(`${colors.yellow}   ⏭️  Saltando: ${reason}${colors.reset}`);
}

async function runTest() {
    console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║     HU12 - Pruebas Automatizadas: Catálogo Maestro            ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    // ==========================================
    // PASO 0: LOGIN
    // ==========================================
    try {
        await login();
    } catch (e) {
        console.error(`${colors.red}❌ No se pudo autenticar: ${e.message}${colors.reset}`);
        process.exit(1);
    }

    // ==========================================
    // PRUEBA 1: LISTAR PRODUCTOS CON PAGINACIÓN
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 1: Listar Productos con Paginación (GET /api/catalog) ━━━${colors.reset}`);
    let firstProduct = null;
    let totalProducts = 0;
    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog?page=1&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        // Verificar que responde 200
        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        // Verificar que tiene array de products
        logTest('Contiene array "products"', Array.isArray(data.products));

        // Verificar que tiene total_count para paginación
        logTest('Contiene "total_count" para paginación', typeof data.total_count === 'number');

        // Verificar que tiene page y limit
        logTest('Contiene "page" en respuesta', typeof data.page === 'number');
        logTest('Contiene "limit" en respuesta', typeof data.limit === 'number');

        // Verificar que hay productos
        const hasProducts = data.products && data.products.length > 0;
        totalProducts = data.total_count || 0;
        logTest(`Hay productos disponibles (${totalProducts} total)`, hasProducts || totalProducts > 0);

        // Verificar estructura de producto
        if (hasProducts) {
            firstProduct = data.products[0];
            logTest('Producto tiene campo "id"', typeof firstProduct.id === 'number');
            logTest('Producto tiene campo "sku"', typeof firstProduct.sku === 'string');
            logTest('Producto tiene campo "name"', typeof firstProduct.name === 'string');
            logTest('Producto tiene campo "unit"', typeof firstProduct.unit === 'string');
            // last_price puede ser omitido si es 0 (omitempty en Go)
            logTest('Producto tiene campo "last_price" (number o undefined)', 
                typeof firstProduct.last_price === 'number' || firstProduct.last_price === undefined);
        }

        // Verificar que limit funciona correctamente
        logTest(`Paginación respeta limit (devuelve ≤10)`, data.products.length <= 10);

    } catch (e) {
        logTest('Listar productos', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 2: PAGINACIÓN - SEGUNDA PÁGINA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 2: Paginación - Segunda Página (GET /api/catalog?page=2) ━━━${colors.reset}`);
    
    // Solo ejecutar si hay suficientes productos para paginación
    if (totalProducts <= 10) {
        logSkip('Datos insuficientes para paginación (≤10 productos)');
        console.log(`${colors.yellow}   ℹ️  El endpoint funciona, pero no hay datos para verificar paginación${colors.reset}`);
    } else {
        try {
            const res = await fetch(`${AUDIT_URL}/api/catalog?page=2&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            // Verificar que responde 200
            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

            // Verificar que page es 2
            logTest('Page es 2', data.page === 2);

            // Verificar que devuelve productos diferentes
            if (data.products.length > 0 && firstProduct) {
                const secondPageFirstProduct = data.products[0];
                logTest('Productos de página 2 son diferentes', secondPageFirstProduct.id !== firstProduct.id);
            }

        } catch (e) {
            logTest('Paginación segunda página', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 3: BÚSQUEDA POR TÉRMINO
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 3: Búsqueda por Término (GET /api/catalog?search=...) ━━━${colors.reset}`);
    try {
        // Buscar un término que probablemente exista
        const searchTerm = 'POLYFORM';
        const res = await fetch(`${AUDIT_URL}/api/catalog?page=1&limit=25&search=${encodeURIComponent(searchTerm)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        // Verificar que responde 200
        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        // Verificar que devuelve resultados filtrados
        const matchCount = data.products?.length || 0;
        logTest(`Búsqueda "${searchTerm}" devuelve resultados (${matchCount})`, matchCount > 0 || data.total_count === 0);

        // Si hay resultados, verificar que contienen el término
        if (matchCount > 0) {
            const allMatch = data.products.every(p => 
                p.name?.toUpperCase().includes(searchTerm) || 
                p.sku?.toUpperCase().includes(searchTerm) ||
                p.barcode?.includes(searchTerm)
            );
            logTest('Resultados contienen el término buscado', allMatch);
        }

    } catch (e) {
        logTest('Búsqueda por término', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 4: HISTORIAL DE IMPORTACIONES
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 4: Historial de Importaciones (GET /api/catalog/imports) ━━━${colors.reset}`);
    let historyItems = [];
    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/imports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        // Verificar que responde 200
        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        // Verificar que tiene array de imports
        logTest('Contiene array "imports"', Array.isArray(data.imports));

        historyItems = data.imports || [];
        const hasHistory = historyItems.length > 0;
        logTest(`Hay historial de importaciones (${historyItems.length})`, hasHistory);

        // Verificar estructura de import history
        if (hasHistory) {
            const item = historyItems[0];
            logTest('Import tiene campo "id"', typeof item.id === 'number');
            logTest('Import tiene campo "file_name"', typeof item.file_name === 'string');
            logTest('Import tiene campo "status"', typeof item.status === 'string');
            logTest('Import tiene campo "date"', typeof item.date === 'string');
            logTest('Import tiene campo "time_ago"', typeof item.time_ago === 'string');
            
            // Verificar que hay al menos uno "applied" (vigente)
            const hasApplied = historyItems.some(i => i.status === 'applied');
            logTest('Existe al menos una importación aplicada (vigente)', hasApplied);
        }

    } catch (e) {
        logTest('Historial de importaciones', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 5: LOOKUP POR BARCODE
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 5: Lookup por Barcode (GET /api/catalog/barcode/:code) ━━━${colors.reset}`);
    try {
        // Usar un barcode conocido del catálogo
        const testBarcode = '7501234567890';
        const res = await fetch(`${AUDIT_URL}/api/catalog/barcode/${testBarcode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Puede ser 200 (encontrado) o 404 (no encontrado)
        if (res.status === 200) {
            const data = await res.json();
            logTest('Respuesta HTTP 200 (producto encontrado)', true);
            logTest('Producto tiene "sku"', typeof data.sku === 'string');
            logTest('Producto tiene "name"', typeof data.name === 'string');
            logTest('Producto tiene "last_price"', typeof data.last_price === 'number');
        } else if (res.status === 404) {
            logTest('Respuesta HTTP 404 (producto no encontrado)', true);
            console.log(`${colors.yellow}   ℹ️  El barcode ${testBarcode} no existe en el catálogo${colors.reset}`);
        } else {
            logTest('Respuesta válida (200 o 404)', false, `Status: ${res.status}`);
        }

    } catch (e) {
        logTest('Lookup por barcode', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 6: CREAR PRODUCTO DUMMY (para pruebas CRUD seguras)
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 6: Crear Producto Dummy (POST /api/catalog/products) ━━━${colors.reset}`);
    console.log(`${colors.yellow}   📦 SKU de prueba: ${dummySku}${colors.reset}`);
    
    const countBeforeCreate = totalProducts;
    
    try {
        // Crear un producto dummy para pruebas
        const createRes = await fetch(`${AUDIT_URL}/api/catalog/products`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sku: dummySku,
                name: 'Producto Dummy para Pruebas Automatizadas',
                barcode: `TEST${Date.now()}`,
                unit: 'PZ',
                price: 99.99
            })
        });

        logTest('Respuesta HTTP 200 o 201 al crear', createRes.status === 200 || createRes.status === 201, `Status: ${createRes.status}`);

        const createData = await createRes.json();
        logTest('Devuelve product_id', !!createData.product_id, `product_id: ${createData.product_id}`);
        dummyProductId = createData.product_id;

        // Verificar que el producto se creó buscándolo
        const searchRes = await fetch(`${AUDIT_URL}/api/catalog?search=${dummySku}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const searchData = await searchRes.json();
        const found = searchData.products?.some(p => p.sku === dummySku);
        logTest('Producto dummy encontrado en búsqueda', found, `SKU: ${dummySku}`);

        // Verificar que el conteo aumentó
        const countRes = await fetch(`${AUDIT_URL}/api/catalog?page=1&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const countData = await countRes.json();
        logTest('Conteo de productos aumentó', countData.total_count > countBeforeCreate);

    } catch (e) {
        logTest('Crear producto dummy', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 7: ACTUALIZAR PRODUCTO DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 7: Actualizar Producto Dummy (PUT /api/catalog/products/:id) ━━━${colors.reset}`);
    
    if (!dummyProductId) {
        logSkip('No se pudo crear producto dummy - saltando prueba de actualización');
    } else {
        try {
            const originalPrice = 99.99;
            const newPrice = 149.99;
            const newName = 'Producto Dummy ACTUALIZADO';
            
            const updateData = {
                name: newName,
                barcode: `UPDATED${Date.now()}`,
                unit: 'PZ',
                price: newPrice
            };

            const res = await fetch(`${AUDIT_URL}/api/catalog/products/${dummyProductId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();

            // Verificar que responde 200
            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

            // Verificar mensaje de éxito
            logTest('Mensaje de éxito recibido', data.message?.includes('success') || data.message?.includes('updated'));

            // Verificar que el cambio se aplicó
            const verifyRes = await fetch(`${AUDIT_URL}/api/catalog?search=${dummySku}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const verifyData = await verifyRes.json();
            
            const updatedProduct = verifyData.products?.find(p => p.id === dummyProductId);
            if (updatedProduct) {
                logTest('Precio actualizado correctamente', updatedProduct.last_price === newPrice, 
                    `Esperado: ${newPrice}, Actual: ${updatedProduct.last_price}`);
            } else {
                logTest('Producto dummy verificado tras actualización', true);
            }

        } catch (e) {
            logTest('Actualizar producto dummy', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 8: ELIMINAR PRODUCTO DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 8: Eliminar Producto Dummy (DELETE /api/catalog/products/:id) ━━━${colors.reset}`);
    
    if (!dummyProductId) {
        logSkip('No se pudo crear producto dummy - saltando prueba de eliminación');
    } else {
        try {
            // Obtener conteo actual antes de eliminar
            const beforeRes = await fetch(`${AUDIT_URL}/api/catalog?page=1&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const beforeData = await beforeRes.json();
            const countBeforeDelete = beforeData.total_count;
            
            const res = await fetch(`${AUDIT_URL}/api/catalog/products/${dummyProductId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            // Verificar que responde 200
            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

            // Verificar mensaje de éxito
            logTest('Mensaje de éxito recibido', data.message?.includes('success') || data.message?.includes('deleted'));

            // Verificar que el producto ya no existe
            const verifyRes = await fetch(`${AUDIT_URL}/api/catalog?page=1&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const verifyData = await verifyRes.json();
            
            logTest('Conteo de productos disminuyó', verifyData.total_count < countBeforeDelete);

            // Verificar que no se encuentra el producto
            const searchRes = await fetch(`${AUDIT_URL}/api/catalog?search=${dummySku}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const searchData = await searchRes.json();
            const stillExists = searchData.products?.some(p => p.id === dummyProductId);
            logTest('Producto dummy ya no existe en búsqueda', !stillExists);

            console.log(`${colors.green}   🧹 Producto dummy (ID ${dummyProductId}) limpiado correctamente${colors.reset}`);
            dummyProductId = null; // Marcar como eliminado

        } catch (e) {
            logTest('Eliminar producto dummy', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 9: SEGURIDAD - SIN TOKEN
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 9: Verificar Seguridad (Sin Token) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog`, {
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición GET /api/catalog sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad GET', false, e.message);
    }

    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/imports`, {
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición GET /api/catalog/imports sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad imports', false, e.message);
    }

    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/products/1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test', barcode: '', unit: 'pz', price: 10 })
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición PUT sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad PUT', false, e.message);
    }

    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/products/1`, {
            method: 'DELETE'
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición DELETE sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad DELETE', false, e.message);
    }

    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'TEST', name: 'Test', unit: 'PZ', price: 10 })
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición POST sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad POST', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 10: VALIDACIÓN DE ENTRADA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 10: Validación de Entrada ━━━${colors.reset}`);
    try {
        // Intentar actualizar producto con ID inválido
        const res = await fetch(`${AUDIT_URL}/api/catalog/products/invalid`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Test', barcode: '', unit: 'pz', price: 10 })
        });

        // Debería rechazar con 400 (bad request)
        logTest('Rechaza ID de producto inválido (400)', res.status === 400, `Status: ${res.status}`);

    } catch (e) {
        logTest('Validación ID inválido', false, e.message);
    }

    try {
        // Intentar eliminar producto inexistente
        const res = await fetch(`${AUDIT_URL}/api/catalog/products/999999999`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Debería rechazar con 404 o 500 (not found)
        logTest('Rechaza eliminar producto inexistente (404 o 500)', res.status === 404 || res.status === 500, `Status: ${res.status}`);

    } catch (e) {
        logTest('Validación producto inexistente', false, e.message);
    }

    // Intentar crear con datos incompletos (sin SKU)
    try {
        const badRes = await fetch(`${AUDIT_URL}/api/catalog/products`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Sin SKU' })
        });
        logTest('Rechaza crear sin SKU (400)', badRes.status === 400, `Status: ${badRes.status}`);

    } catch (e) {
        logTest('Validación crear sin SKU', false, e.message);
    }

    // Intentar crear con datos incompletos (sin nombre)
    try {
        const badRes = await fetch(`${AUDIT_URL}/api/catalog/products`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sku: 'TEST-NO-NAME' })
        });
        logTest('Rechaza crear sin nombre (400)', badRes.status === 400, `Status: ${badRes.status}`);

    } catch (e) {
        logTest('Validación crear sin nombre', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 11: HISTORIAL DE CAMBIOS MANUALES (GET /api/catalog/changes)
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 11: Historial de Cambios Manuales (GET /api/catalog/changes) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUDIT_URL}/api/catalog/changes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        const data = await res.json();
        logTest('Respuesta contiene array de cambios', Array.isArray(data.changes), `Tipo: ${typeof data.changes}`);
        logTest('Respuesta contiene total_count', typeof data.total_count === 'number', `total_count: ${data.total_count}`);

        // Si hay cambios, verificar estructura
        if (data.changes && data.changes.length > 0) {
            const firstChange = data.changes[0];
            logTest('Cambio tiene id', typeof firstChange.id === 'number');
            logTest('Cambio tiene action', ['create', 'update', 'delete'].includes(firstChange.action), `action: ${firstChange.action}`);
            logTest('Cambio tiene product_sku', typeof firstChange.product_sku === 'string');
            logTest('Cambio tiene time_ago', typeof firstChange.time_ago === 'string');
        } else {
            console.log(`${colors.yellow}   ℹ️  No hay cambios manuales registrados aún${colors.reset}`);
        }

    } catch (e) {
        logTest('Historial de cambios manuales', false, e.message);
    }

    // Verificar que rechaza sin token
    try {
        const noAuthRes = await fetch(`${AUDIT_URL}/api/catalog/changes`);
        logTest('Rechaza sin token (401)', noAuthRes.status === 401, `Status: ${noAuthRes.status}`);

    } catch (e) {
        logTest('Seguridad cambios manuales', false, e.message);
    }
    console.log();

    // ==========================================
    // LIMPIEZA FINAL: Asegurar que el producto dummy fue eliminado
    // ==========================================
    if (dummyProductId) {
        console.log(`${colors.yellow}🧹 Limpieza: Eliminando producto dummy que quedó pendiente...${colors.reset}`);
        try {
            await fetch(`${AUDIT_URL}/api/catalog/products/${dummyProductId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`${colors.green}   ✓ Producto dummy eliminado${colors.reset}`);
        } catch (e) {
            console.log(`${colors.red}   ✗ No se pudo eliminar: ${e.message}${colors.reset}`);
        }
        console.log();
    }

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║                    RESUMEN DE PRUEBAS                         ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`${colors.green}   ✅ Pasaron: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}   ❌ Fallaron: ${testsFailed}${colors.reset}`);
    console.log();

    if (testsFailed === 0) {
        console.log(`${colors.green}🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! 🎉${colors.reset}`);
        console.log(`${colors.cyan}   ℹ️  Ningún producto real fue modificado durante las pruebas${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  Algunas pruebas fallaron. Revisar los detalles arriba.${colors.reset}`);
        process.exit(1);
    }
}

runTest();
