# Casos de Prueba - HU01 Iniciar Sesión

## Backend (Postman)

Importa el archivo `QONTROL_HU01_Login_Tests.postman_collection.json` en Postman.

### Variable de Entorno
- `baseUrl`: `http://localhost` (local) o `http://<IP-EC2>` (AWS)

### Casos de Prueba

| # | Caso | Email | Password | Esperado |
|---|------|-------|----------|----------|
| 1 | Health Check | - | - | 200 `{status: "ok"}` |
| 2 | Login Admin | jose.admin@gmail.com | Admin123! | 200 + JWT + user |
| 3 | Login User | test.user@hotmail.com | Test1234! | 200 + JWT + user |
| 4 | Password Incorrecto | jose.admin@gmail.com | WrongPass | 401 `invalid_credentials` |
| 5 | Usuario No Existe | noexiste@gmail.com | Test1234! | 401 `invalid_credentials` |
| 6 | Usuario Inactivo | inactive@gmail.com | Inactive123! | 403 `user_inactive` |
| 7 | Email Vacío | (vacío) | Test1234! | 400/401 |
| 8 | Password Vacío | jose.admin@gmail.com | (vacío) | 400/401 |
| 9 | Rate Limiting (6 intentos) | ratelimit@test.com | WrongX | 429 `too_many_requests` |

---

## Frontend (Manual en Browser)

URL: `http://localhost:5173`

### Casos de Prueba

| # | Caso | Email | Password | Esperado |
|---|------|-------|----------|----------|
| 1 | Login Exitoso | jose.admin@gmail.com | Admin123! | Toast éxito + redirect a `/dashboard` |
| 2 | Password Incorrecto | jose.admin@gmail.com | WrongPass | Toast: "Email o contraseña incorrectos" |
| 3 | Usuario No Existe | noexiste@gmail.com | Test1234! | Toast: "Email o contraseña incorrectos" |
| 4 | Usuario Inactivo | inactive@gmail.com | Inactive123! | Toast: "Su cuenta está desactivada..." |
| 5 | Email Inválido | notanemail | Test1234! | Toast: "El formato del correo no es válido" |
| 6 | Rate Limiting | (6 intentos fallidos) | - | Toast: "Demasiados intentos..." |
| 7 | Sesión Persistente | - | - | Recargar página, debe mantener login |
| 8 | Logout | - | - | Click "Cerrar Sesión", redirect a `/login` |
| 9 | Ruta Protegida | - | - | Sin login, `/dashboard` redirige a `/login` |

---

## Credenciales de Prueba

| Rol | Email | Password | Estado |
|-----|-------|----------|--------|
| Admin | jose.admin@gmail.com | Admin123! | Activo |
| User | test.user@hotmail.com | Test1234! | Activo |
| Inactivo | inactive@gmail.com | Inactive123! | Inactivo |
