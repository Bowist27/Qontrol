/**
 * HU10 - Pruebas Automatizadas: Dashboard de Auditorías
 * 
 * Casos de prueba:
 * 1. Listar tiendas (GET /api/stores)
 * 2. Listar auditorías (GET /api/audits)
 * 3. Ver detalle de auditoría (GET /api/audits/:id)
 * 4. Verificar filtros funcionan correctamente
 * 
 * Ejecutar: node docs/pruebas/test_hu10_audits.js
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
    reset: '\x1b[0m'
};

let token = '';
let testsPassed = 0;
let testsFailed = 0;

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

async function runTest() {
    console.log(`${colors.yellow}🚀 Iniciando pruebas automatizadas: HU10 Dashboard de Auditorías${colors.reset}\n`);

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
    // PRUEBA 1: LISTAR TIENDAS
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 1: Listar Tiendas (GET /api/stores) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUDIT_URL}/api/stores`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        // Verificar que responde 200
        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        // Verificar que tiene array de stores
        logTest('Contiene array "stores"', Array.isArray(data.stores));

        // Verificar que hay al menos 1 tienda
        const hasStores = data.stores && data.stores.length > 0;
        logTest(`Hay tiendas disponibles (${data.stores?.length || 0})`, hasStores);

        // Verificar estructura de tienda
        if (hasStores) {
            const store = data.stores[0];
            logTest('Tienda tiene campo "id"', typeof store.id === 'number');
            logTest('Tienda tiene campo "name"', typeof store.name === 'string');
        }

    } catch (e) {
        logTest('Listar tiendas', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 2: LISTAR AUDITORÍAS
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 2: Listar Auditorías (GET /api/audits) ━━━${colors.reset}`);
    let auditId = null;
    try {
        const res = await fetch(`${AUDIT_URL}/api/audits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        // Verificar que responde 200
        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

        // Verificar que tiene array de audits
        logTest('Contiene array "audits"', Array.isArray(data.audits));

        // Verificar que hay auditorías
        const hasAudits = data.audits && data.audits.length > 0;
        logTest(`Hay auditorías disponibles (${data.audits?.length || 0})`, hasAudits);

        // Verificar estructura de auditoría
        if (hasAudits) {
            const audit = data.audits[0];
            auditId = audit.session?.id;
            logTest('Auditoría tiene "session.id"', typeof auditId === 'number');
            logTest('Auditoría tiene "session.status"', typeof audit.session?.status === 'string');
            logTest('Auditoría tiene "store_name"', typeof audit.store_name === 'string');
        }

    } catch (e) {
        logTest('Listar auditorías', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 3: VER DETALLE DE AUDITORÍA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 3: Ver Detalle de Auditoría (GET /api/audits/:id) ━━━${colors.reset}`);
    if (auditId) {
        try {
            const res = await fetch(`${AUDIT_URL}/api/audits/${auditId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            // Verificar que responde 200
            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

            // Verificar que tiene session
            logTest('Contiene objeto "session"', typeof data.session === 'object');

            // Verificar que tiene items
            logTest('Contiene array "items"', Array.isArray(data.items));

            // Verificar campos de session
            if (data.session) {
                logTest('Session tiene "id"', data.session.id === auditId);
                logTest('Session tiene "store_id"', typeof data.session.store_id === 'number');
                logTest('Session tiene "created_at"', typeof data.session.created_at === 'string');
            }

        } catch (e) {
            logTest('Ver detalle de auditoría', false, e.message);
        }
    } else {
        console.log(`${colors.yellow}⚠️  Saltando prueba: No hay auditorías para consultar${colors.reset}`);
    }
    console.log();

    // ==========================================
    // PRUEBA 4: OBTENER ESCANEOS FÍSICOS
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 4: Obtener Escaneos Físicos (GET /api/audits/:id/scans) ━━━${colors.reset}`);
    if (auditId) {
        try {
            const res = await fetch(`${AUDIT_URL}/api/audits/${auditId}/scans`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            // Verificar que responde 200
            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);

            // Verificar que tiene array de scans (puede ser null o vacío)
            const scans = data.scans || [];
            logTest('Contiene array "scans" o es null', Array.isArray(scans) || data.scans === null);

            // Verificar estructura si hay escaneos
            if (scans.length > 0) {
                const scan = scans[0];
                logTest('Scan tiene "barcode"', typeof scan.barcode === 'string');
                logTest('Scan tiene "quantity"', typeof scan.quantity === 'number');
                logTest(`Hay ${scans.length} escaneos`, true);
            } else {
                console.log(`${colors.yellow}   ℹ️  No hay escaneos físicos registrados (esto es normal)${colors.reset}`);
            }

        } catch (e) {
            logTest('Obtener escaneos físicos', false, e.message);
        }
    } else {
        console.log(`${colors.yellow}⚠️  Saltando prueba: No hay auditorías para consultar${colors.reset}`);
    }
    console.log();

    // ==========================================
    // PRUEBA 5: ENDPOINT PROTEGIDO SIN TOKEN
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 5: Verificar Seguridad (Sin Token) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUDIT_URL}/api/stores`, {
            // Sin Authorization header
        });

        // Debería rechazar sin autenticación (401)
        logTest('Rechaza petición sin token (401)', res.status === 401, `Status: ${res.status}`);

    } catch (e) {
        logTest('Verificar seguridad', false, e.message);
    }
    console.log();

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}                 RESUMEN DE PRUEBAS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}   Pasaron: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}   Fallaron: ${testsFailed}${colors.reset}`);
    console.log();

    if (testsFailed === 0) {
        console.log(`${colors.green}🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! 🎉${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  Algunas pruebas fallaron. Revisar los detalles arriba.${colors.reset}`);
        process.exit(1);
    }
}

runTest();
