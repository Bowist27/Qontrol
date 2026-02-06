const assert = require('assert');

// Configuración
const BASE_URL = 'http://localhost:8080';
const CREDENTIALS = {
    email: 'admin@qontrol.com',
    password: 'Admin123!'
};

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

async function runTest() {
    console.log(`${colors.yellow}🚀 Iniciando prueba automatizada: HU09 Logout Seguro${colors.reset}\n`);
    let token = '';

    // ==========================================
    // PASO 1: LOGIN (Obtener Token)
    // ==========================================
    try {
        console.log('1️⃣  Intentando Login...');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(CREDENTIALS)
        });

        if (loginRes.status !== 200) throw new Error(`Login falló con status ${loginRes.status}`);

        const loginData = await loginRes.json();
        token = loginData.token;

        if (!token) throw new Error('No se recibió token en la respuesta');
        console.log(`${colors.green}✅ Login Exitoso. Token: ${token.substring(0, 15)}...${colors.reset}\n`);

    } catch (e) {
        console.error(`${colors.red}❌ Falló PASO 1 (Login): ${e.message}${colors.reset}`);
        process.exit(1);
    }

    // ==========================================
    // PASO 2: VERIFICAR ACCESO (Token Válido)
    // ==========================================
    try {
        console.log('2️⃣  Verificando acceso a ruta protegida (/users) con token válido...');
        const userRes = await fetch(`${BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (userRes.status !== 200) {
            throw new Error(`Acceso falló con status ${userRes.status} (Esperaba 200)`);
        }
        console.log(`${colors.green}✅ Acceso Permitido (Como se esperaba).${colors.reset}\n`);

    } catch (e) {
        console.error(`${colors.red}❌ Falló PASO 2 (Pre-Logout Check): ${e.message}${colors.reset}`);
        process.exit(1);
    }

    // ==========================================
    // PASO 3: LOGOUT (Invalidar Token)
    // ==========================================
    try {
        console.log('3️⃣  Cerrando Sesión (Enviando token a Blacklist)...');
        const logoutRes = await fetch(`${BASE_URL}/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (logoutRes.status !== 200) {
            throw new Error(`Logout falló con status ${logoutRes.status}`);
        }
        console.log(`${colors.green}✅ Logout Exitoso.${colors.reset}\n`);

    } catch (e) {
        console.error(`${colors.red}❌ Falló PASO 3 (Logout): ${e.message}${colors.reset}`);
        process.exit(1);
    }

    // ==========================================
    // PASO 4: VERIFICAR BLOQUEO (Prueba de Fuego)
    // ==========================================
    try {
        console.log('4️⃣  Intentando acceder a ruta protegida con token invalidado...');
        const blockedRes = await fetch(`${BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // AQUÍ ESPERAMOS QUE FALLE CON 401
        if (blockedRes.status === 401) {
            console.log(`${colors.green}✅ ¡ÉXITO! El acceso fue denegado (Status 401). El token está en Blacklist.${colors.reset}\n`);
            console.log(`${colors.green}🎉 PRUEBA COMPLETADA EXITOSAMENTE 🎉${colors.reset}`);
            process.exit(0);
        } else {
            throw new Error(`¡Fallo de Seguridad! Se permitió el acceso con status ${blockedRes.status} (Esperaba 401)`);
        }

    } catch (e) {
        console.error(`${colors.red}❌ Falló PASO 4 (Seguridad): ${e.message}${colors.reset}`);
        process.exit(1);
    }
}

runTest();
