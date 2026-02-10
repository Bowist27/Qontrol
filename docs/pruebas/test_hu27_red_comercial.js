/**
 * HU27 - Pruebas Automatizadas: Red Comercial (Zonas y Sucursales)
 * 
 * Casos de prueba:
 * 
 * LISTAS DE PRECIOS:
 * 1. Listar listas de precios (GET /price-lists)
 * 
 * ZONAS:
 * 2. Listar zonas (GET /zones)
 * 3. Crear zona dummy para pruebas (POST /zones)
 * 4. Obtener zona por ID (GET /zones/:id)
 * 5. Actualizar zona (PUT /zones/:id)
 * 6. Verificar zona no encontrada (GET /zones/:id con ID inexistente)
 * 7. Verificar ID inválido en zona (GET /zones/:id con ID no numérico)
 * 
 * SUCURSALES:
 * 8. Listar sucursales (GET /stores)
 * 9. Crear sucursal dummy para pruebas (POST /stores)
 * 10. Obtener sucursal por ID (GET /stores/:id)
 * 11. Actualizar sucursal (PUT /stores/:id)
 * 12. Asignar sucursal a zona (PUT /stores/:id)
 * 13. Verificar sucursal no encontrada (GET /stores/:id con ID inexistente)
 * 14. Verificar ID inválido en sucursal (GET /stores/:id con ID no numérico)
 * 
 * SEGURIDAD (Sin token):
 * 15. GET /zones sin token
 * 16. POST /zones sin token
 * 17. GET /stores sin token
 * 18. POST /stores sin token
 * 19. GET /price-lists sin token
 * 
 * LIMPIEZA:
 * 20. Eliminar sucursal dummy (DELETE /stores/:id)
 * 21. Eliminar zona dummy (DELETE /zones/:id)
 * 22. Verificar que zona con sucursales no se puede eliminar
 * 
 * NOTA: Las pruebas CRUD usan entidades dummy creadas al inicio,
 *       evitando modificar o eliminar datos reales del sistema.
 * 
 * Total: ~45 tests
 * 
 * Ejecutar: node docs/pruebas/test_hu27_red_comercial.js
 */

const assert = require('assert');

// Configuración
const AUTH_URL = 'http://localhost:8080';
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

// Entidades dummy para pruebas CRUD seguras
let dummyZoneId = null;
let dummyStoreId = null;
const timestamp = Date.now();
const dummyZoneName = `Zona-Test-${timestamp}`;
const dummyStoreName = `Sucursal-Test-${timestamp}`;

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
    console.log(`${colors.cyan}║     HU27 - Pruebas Automatizadas: Red Comercial               ║${colors.reset}`);
    console.log(`${colors.cyan}║     (Zonas y Sucursales)                                      ║${colors.reset}`);
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
    // PRUEBA 1: LISTAR LISTAS DE PRECIOS
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 1: Listar Listas de Precios (GET /price-lists) ━━━${colors.reset}`);
    let priceLists = [];
    try {
        const res = await fetch(`${AUTH_URL}/price-lists`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
        logTest('Contiene array "price_lists"', Array.isArray(data.price_lists));

        if (data.price_lists && data.price_lists.length > 0) {
            priceLists = data.price_lists;
            const firstPriceList = data.price_lists[0];
            logTest(`Hay listas de precios (${data.price_lists.length})`, true);
            logTest('Lista tiene campo "id"', typeof firstPriceList.id === 'number');
            logTest('Lista tiene campo "name"', typeof firstPriceList.name === 'string');
            logTest('Lista tiene campo "adjustment_percent"', typeof firstPriceList.adjustment_percent === 'number');
        } else {
            logSkip('No hay listas de precios para verificar estructura');
        }
    } catch (e) {
        logTest('Listar listas de precios', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 2: LISTAR ZONAS
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 2: Listar Zonas (GET /zones) ━━━${colors.reset}`);
    let existingZones = [];
    try {
        const res = await fetch(`${AUTH_URL}/zones`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
        logTest('Contiene array "zones"', Array.isArray(data.zones));

        existingZones = data.zones || [];
        logTest(`Total de zonas: ${existingZones.length}`, true);

        if (existingZones.length > 0) {
            const firstZone = existingZones[0];
            logTest('Zona tiene campo "id"', typeof firstZone.id === 'number');
            logTest('Zona tiene campo "name"', typeof firstZone.name === 'string');
            logTest('Zona tiene campo "status"', typeof firstZone.status === 'boolean');
            logTest('Zona tiene campo "store_count"', typeof firstZone.store_count === 'number');
        }
    } catch (e) {
        logTest('Listar zonas', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 3: CREAR ZONA DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 3: Crear Zona Dummy (POST /zones) ━━━${colors.reset}`);
    try {
        const createData = {
            name: dummyZoneName,
            supervisor_id: null,
            price_list_id: priceLists.length > 0 ? priceLists[0].id : null
        };

        const res = await fetch(`${AUTH_URL}/zones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(createData)
        });

        const data = await res.json();

        logTest('Respuesta HTTP 201', res.status === 201, `Status: ${res.status}`);

        if (res.status === 201 && data.id) {
            dummyZoneId = data.id;
            logTest('Zona creada tiene ID', typeof data.id === 'number');
            logTest('Zona creada tiene nombre correcto', data.name === dummyZoneName);
            logTest('Zona creada está activa por defecto', data.status === true);
            console.log(`${colors.yellow}   📝 Zona dummy creada con ID: ${dummyZoneId}${colors.reset}`);
        } else {
            logTest('Zona dummy creada', false, 'No se obtuvo ID');
        }
    } catch (e) {
        logTest('Crear zona dummy', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 4: OBTENER ZONA POR ID
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 4: Obtener Zona por ID (GET /zones/:id) ━━━${colors.reset}`);
    if (!dummyZoneId) {
        logSkip('No se creó zona dummy');
    } else {
        try {
            const res = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Zona tiene ID correcto', data.id === dummyZoneId);
            logTest('Zona tiene nombre correcto', data.name === dummyZoneName);
            logTest('Zona tiene status', typeof data.status === 'boolean');
        } catch (e) {
            logTest('Obtener zona por ID', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 5: ACTUALIZAR ZONA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 5: Actualizar Zona (PUT /zones/:id) ━━━${colors.reset}`);
    const updatedZoneName = `${dummyZoneName}-Actualizada`;
    if (!dummyZoneId) {
        logSkip('No se creó zona dummy');
    } else {
        try {
            const updateData = {
                name: updatedZoneName,
                status: true,
                supervisor_id: null,
                price_list_id: null
            };

            const res = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Zona actualizada tiene nombre nuevo', data.name === updatedZoneName);
            logTest('Zona mantiene el ID', data.id === dummyZoneId);
        } catch (e) {
            logTest('Actualizar zona', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 6: ZONA NO ENCONTRADA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 6: Zona No Encontrada (GET /zones/99999) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUTH_URL}/zones/99999`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 404', res.status === 404, `Status: ${res.status}`);
        logTest('Contiene error "not_found"', data.error === 'not_found');
    } catch (e) {
        logTest('Zona no encontrada', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 7: ID INVÁLIDO EN ZONA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 7: ID Inválido en Zona (GET /zones/abc) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUTH_URL}/zones/abc`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 400', res.status === 400, `Status: ${res.status}`);
        logTest('Contiene error "invalid_request"', data.error === 'invalid_request');
    } catch (e) {
        logTest('ID inválido en zona', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 8: LISTAR SUCURSALES
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 8: Listar Sucursales (GET /stores) ━━━${colors.reset}`);
    let existingStores = [];
    try {
        const res = await fetch(`${AUTH_URL}/stores`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
        logTest('Contiene array "stores"', Array.isArray(data.stores));

        existingStores = data.stores || [];
        logTest(`Total de sucursales: ${existingStores.length}`, true);

        if (existingStores.length > 0) {
            const firstStore = existingStores[0];
            logTest('Sucursal tiene campo "id"', typeof firstStore.id === 'number');
            logTest('Sucursal tiene campo "name"', typeof firstStore.name === 'string');
            logTest('Sucursal tiene campo "status"', typeof firstStore.status === 'boolean');
        }
    } catch (e) {
        logTest('Listar sucursales', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 9: CREAR SUCURSAL DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 9: Crear Sucursal Dummy (POST /stores) ━━━${colors.reset}`);
    try {
        const createData = {
            name: dummyStoreName,
            zone_id: null  // Sin zona asignada inicialmente
        };

        const res = await fetch(`${AUTH_URL}/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(createData)
        });

        const data = await res.json();

        logTest('Respuesta HTTP 201', res.status === 201, `Status: ${res.status}`);

        if (res.status === 201 && data.id) {
            dummyStoreId = data.id;
            logTest('Sucursal creada tiene ID', typeof data.id === 'number');
            logTest('Sucursal creada tiene nombre correcto', data.name === dummyStoreName);
            logTest('Sucursal creada está activa por defecto', data.status === true);
            console.log(`${colors.yellow}   📝 Sucursal dummy creada con ID: ${dummyStoreId}${colors.reset}`);
        } else {
            logTest('Sucursal dummy creada', false, 'No se obtuvo ID');
        }
    } catch (e) {
        logTest('Crear sucursal dummy', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 10: OBTENER SUCURSAL POR ID
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 10: Obtener Sucursal por ID (GET /stores/:id) ━━━${colors.reset}`);
    if (!dummyStoreId) {
        logSkip('No se creó sucursal dummy');
    } else {
        try {
            const res = await fetch(`${AUTH_URL}/stores/${dummyStoreId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Sucursal tiene ID correcto', data.id === dummyStoreId);
            logTest('Sucursal tiene nombre correcto', data.name === dummyStoreName);
            logTest('Sucursal tiene status', typeof data.status === 'boolean');
        } catch (e) {
            logTest('Obtener sucursal por ID', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 11: ACTUALIZAR SUCURSAL
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 11: Actualizar Sucursal (PUT /stores/:id) ━━━${colors.reset}`);
    const updatedStoreName = `${dummyStoreName}-Actualizada`;
    if (!dummyStoreId) {
        logSkip('No se creó sucursal dummy');
    } else {
        try {
            const updateData = {
                name: updatedStoreName,
                status: true,
                zone_id: null
            };

            const res = await fetch(`${AUTH_URL}/stores/${dummyStoreId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Sucursal actualizada tiene nombre nuevo', data.name === updatedStoreName);
            logTest('Sucursal mantiene el ID', data.id === dummyStoreId);
        } catch (e) {
            logTest('Actualizar sucursal', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 12: ASIGNAR SUCURSAL A ZONA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 12: Asignar Sucursal a Zona (PUT /stores/:id) ━━━${colors.reset}`);
    if (!dummyStoreId || !dummyZoneId) {
        logSkip('No se creó sucursal o zona dummy');
    } else {
        try {
            const updateData = {
                name: updatedStoreName,
                status: true,
                zone_id: dummyZoneId
            };

            const res = await fetch(`${AUTH_URL}/stores/${dummyStoreId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Sucursal asignada a zona', data.zone_id === dummyZoneId);

            // Verificar que la zona ahora tiene 1 sucursal
            const zoneRes = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const zoneData = await zoneRes.json();
            logTest('Zona refleja sucursal asignada (store_count = 1)', zoneData.store_count === 1);
        } catch (e) {
            logTest('Asignar sucursal a zona', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 13: SUCURSAL NO ENCONTRADA
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 13: Sucursal No Encontrada (GET /stores/99999) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUTH_URL}/stores/99999`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 404', res.status === 404, `Status: ${res.status}`);
        logTest('Contiene error "not_found"', data.error === 'not_found');
    } catch (e) {
        logTest('Sucursal no encontrada', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 14: ID INVÁLIDO EN SUCURSAL
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 14: ID Inválido en Sucursal (GET /stores/abc) ━━━${colors.reset}`);
    try {
        const res = await fetch(`${AUTH_URL}/stores/abc`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        logTest('Respuesta HTTP 400', res.status === 400, `Status: ${res.status}`);
        logTest('Contiene error "invalid_request"', data.error === 'invalid_request');
    } catch (e) {
        logTest('ID inválido en sucursal', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBAS DE SEGURIDAD (SIN TOKEN)
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBAS DE SEGURIDAD: Endpoints sin token ━━━${colors.reset}`);

    // Prueba 15: GET /zones sin token
    try {
        const res = await fetch(`${AUTH_URL}/zones`);
        logTest('GET /zones sin token retorna 401', res.status === 401, `Status: ${res.status}`);
    } catch (e) {
        logTest('GET /zones sin token', false, e.message);
    }

    // Prueba 16: POST /zones sin token
    try {
        const res = await fetch(`${AUTH_URL}/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        logTest('POST /zones sin token retorna 401', res.status === 401, `Status: ${res.status}`);
    } catch (e) {
        logTest('POST /zones sin token', false, e.message);
    }

    // Prueba 17: GET /stores sin token
    try {
        const res = await fetch(`${AUTH_URL}/stores`);
        logTest('GET /stores sin token retorna 401', res.status === 401, `Status: ${res.status}`);
    } catch (e) {
        logTest('GET /stores sin token', false, e.message);
    }

    // Prueba 18: POST /stores sin token
    try {
        const res = await fetch(`${AUTH_URL}/stores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
        });
        logTest('POST /stores sin token retorna 401', res.status === 401, `Status: ${res.status}`);
    } catch (e) {
        logTest('POST /stores sin token', false, e.message);
    }

    // Prueba 19: GET /price-lists sin token
    try {
        const res = await fetch(`${AUTH_URL}/price-lists`);
        logTest('GET /price-lists sin token retorna 401', res.status === 401, `Status: ${res.status}`);
    } catch (e) {
        logTest('GET /price-lists sin token', false, e.message);
    }
    console.log();

    // ==========================================
    // PRUEBA 20: VERIFICAR ZONA CON SUCURSALES NO SE PUEDE ELIMINAR
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 20: Zona con Sucursales no se puede eliminar ━━━${colors.reset}`);
    if (!dummyZoneId) {
        logSkip('No se creó zona dummy');
    } else {
        try {
            const res = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            // Debería fallar porque la zona tiene sucursales asignadas
            logTest('Respuesta HTTP 409 (Conflict)', res.status === 409, `Status: ${res.status}`);
            logTest('Contiene error "zone_in_use"', data.error === 'zone_in_use');
        } catch (e) {
            logTest('Zona con sucursales no eliminable', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 21: ELIMINAR SUCURSAL DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 21: Eliminar Sucursal Dummy (DELETE /stores/:id) ━━━${colors.reset}`);
    if (!dummyStoreId) {
        logSkip('No se creó sucursal dummy');
    } else {
        try {
            const res = await fetch(`${AUTH_URL}/stores/${dummyStoreId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Mensaje de eliminación exitosa', data.message && data.message.includes('eliminada'));

            // Verificar que ya no existe
            const verifyRes = await fetch(`${AUTH_URL}/stores/${dummyStoreId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            logTest('Sucursal ya no existe (404)', verifyRes.status === 404);

            console.log(`${colors.yellow}   🗑️  Sucursal dummy eliminada${colors.reset}`);
        } catch (e) {
            logTest('Eliminar sucursal dummy', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // PRUEBA 22: ELIMINAR ZONA DUMMY
    // ==========================================
    console.log(`${colors.blue}━━━ PRUEBA 22: Eliminar Zona Dummy (DELETE /zones/:id) ━━━${colors.reset}`);
    if (!dummyZoneId) {
        logSkip('No se creó zona dummy');
    } else {
        try {
            const res = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            logTest('Respuesta HTTP 200', res.status === 200, `Status: ${res.status}`);
            logTest('Mensaje de eliminación exitosa', data.message && data.message.includes('eliminada'));

            // Verificar que ya no existe
            const verifyRes = await fetch(`${AUTH_URL}/zones/${dummyZoneId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            logTest('Zona ya no existe (404)', verifyRes.status === 404);

            console.log(`${colors.yellow}   🗑️  Zona dummy eliminada${colors.reset}`);
        } catch (e) {
            logTest('Eliminar zona dummy', false, e.message);
        }
    }
    console.log();

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║                      RESUMEN DE PRUEBAS                       ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`${colors.green}✅ Pruebas exitosas: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}❌ Pruebas fallidas: ${testsFailed}${colors.reset}`);
    console.log(`   Total: ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
        console.log(`\n${colors.green}🎉 ¡Todas las pruebas pasaron exitosamente!${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️  Algunas pruebas fallaron. Revisar los detalles arriba.${colors.reset}`);
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

runTest().catch(e => {
    console.error(`${colors.red}Error fatal: ${e.message}${colors.reset}`);
    process.exit(1);
});
