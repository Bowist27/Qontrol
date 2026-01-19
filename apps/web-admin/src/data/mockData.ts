// Mock data for Admin Dashboard
import { Lock, Database, Store, FileBarChart, Shield, Cloud } from 'lucide-react';
import type { Store as StoreType, ProductWithStock, AuditLog, AuditDiffItem, SystemService } from '../types';

// --- 31 TIENDAS ---
export const STORES_DATA: StoreType[] = [
    { id: 1, name: 'Celaya Centro', city: 'Celaya', status: 'online', salesToday: 45800, inventory: 12450, pendingSync: 0 },
    { id: 2, name: 'Celaya Norte', city: 'Celaya', status: 'online', salesToday: 38200, inventory: 9800, pendingSync: 0 },
    { id: 3, name: 'Celaya Sur', city: 'Celaya', status: 'warning', salesToday: 29500, inventory: 7600, pendingSync: 15 },
    { id: 4, name: 'Querétaro Centro', city: 'Querétaro', status: 'online', salesToday: 52300, inventory: 15200, pendingSync: 0 },
    { id: 5, name: 'Querétaro Norte', city: 'Querétaro', status: 'online', salesToday: 41000, inventory: 11300, pendingSync: 0 },
    { id: 6, name: 'Querétaro Sur', city: 'Querétaro', status: 'online', salesToday: 35600, inventory: 9100, pendingSync: 0 },
    { id: 7, name: 'Irapuato Centro', city: 'Irapuato', status: 'online', salesToday: 33400, inventory: 8700, pendingSync: 0 },
    { id: 8, name: 'Irapuato Norte', city: 'Irapuato', status: 'offline', salesToday: 0, inventory: 6200, pendingSync: 48 },
    { id: 9, name: 'Salamanca', city: 'Salamanca', status: 'online', salesToday: 28900, inventory: 7400, pendingSync: 0 },
    { id: 10, name: 'León Centro', city: 'León', status: 'online', salesToday: 61200, inventory: 18500, pendingSync: 0 },
    { id: 11, name: 'León Norte', city: 'León', status: 'online', salesToday: 48700, inventory: 14200, pendingSync: 0 },
    { id: 12, name: 'León Sur', city: 'León', status: 'warning', salesToday: 31200, inventory: 8900, pendingSync: 8 },
    { id: 13, name: 'Silao', city: 'Silao', status: 'online', salesToday: 22100, inventory: 5600, pendingSync: 0 },
    { id: 14, name: 'San Miguel Allende', city: 'San Miguel', status: 'online', salesToday: 39800, inventory: 10400, pendingSync: 0 },
    { id: 15, name: 'Dolores Hidalgo', city: 'Dolores', status: 'online', salesToday: 18500, inventory: 4800, pendingSync: 0 },
    { id: 16, name: 'San Luis Potosí Centro', city: 'SLP', status: 'online', salesToday: 55400, inventory: 16800, pendingSync: 0 },
    { id: 17, name: 'San Luis Potosí Norte', city: 'SLP', status: 'online', salesToday: 42300, inventory: 12100, pendingSync: 0 },
    { id: 18, name: 'Aguascalientes Centro', city: 'Aguascalientes', status: 'online', salesToday: 47600, inventory: 13900, pendingSync: 0 },
    { id: 19, name: 'Aguascalientes Sur', city: 'Aguascalientes', status: 'online', salesToday: 36800, inventory: 10200, pendingSync: 0 },
    { id: 20, name: 'Morelia Centro', city: 'Morelia', status: 'online', salesToday: 51200, inventory: 15600, pendingSync: 0 },
    { id: 21, name: 'Morelia Norte', city: 'Morelia', status: 'online', salesToday: 38900, inventory: 11800, pendingSync: 0 },
    { id: 22, name: 'Uruapan', city: 'Uruapan', status: 'online', salesToday: 29400, inventory: 7900, pendingSync: 0 },
    { id: 23, name: 'Zamora', city: 'Zamora', status: 'online', salesToday: 24600, inventory: 6500, pendingSync: 0 },
    { id: 24, name: 'Guadalajara Centro', city: 'Guadalajara', status: 'online', salesToday: 72500, inventory: 22400, pendingSync: 0 },
    { id: 25, name: 'Guadalajara Zapopan', city: 'Guadalajara', status: 'online', salesToday: 58300, inventory: 17800, pendingSync: 0 },
    { id: 26, name: 'Guadalajara Tlaquepaque', city: 'Guadalajara', status: 'online', salesToday: 44100, inventory: 13200, pendingSync: 0 },
    { id: 27, name: 'Tepic', city: 'Tepic', status: 'online', salesToday: 31800, inventory: 8400, pendingSync: 0 },
    { id: 28, name: 'Zacatecas', city: 'Zacatecas', status: 'online', salesToday: 27200, inventory: 7100, pendingSync: 0 },
    { id: 29, name: 'Pachuca', city: 'Pachuca', status: 'online', salesToday: 34500, inventory: 9300, pendingSync: 0 },
    { id: 30, name: 'Tulancingo', city: 'Tulancingo', status: 'online', salesToday: 19800, inventory: 5200, pendingSync: 0 },
    { id: 31, name: 'Bodega Central', city: 'Celaya', status: 'online', salesToday: 0, inventory: 145000, pendingSync: 0 },
];

// --- CATÁLOGO DE PRODUCTOS ---
export const PRODUCTS_CATALOG: ProductWithStock[] = [
    {
        sku: 'VIN-001', name: 'Vinimex Total', color: 'Blanco Hueso', family: 'Vinílicas', presentation: '19L', price: 1850,
        stockByStore: [
            { storeId: 1, stock: 48, inTransit: 10, minStock: 20, maxStock: 100 },
            { storeId: 2, stock: 32, inTransit: 0, minStock: 15, maxStock: 80 },
            { storeId: 3, stock: 5, inTransit: 20, minStock: 15, maxStock: 80 },
            { storeId: 4, stock: 65, inTransit: 0, minStock: 25, maxStock: 120 },
            { storeId: 5, stock: 28, inTransit: 0, minStock: 20, maxStock: 90 },
            { storeId: 10, stock: 89, inTransit: 0, minStock: 30, maxStock: 150 },
            { storeId: 24, stock: 112, inTransit: 0, minStock: 40, maxStock: 200 },
            { storeId: 31, stock: 520, inTransit: 0, minStock: 100, maxStock: 1000 },
        ]
    },
    {
        sku: 'VIN-002', name: 'Vinimex Total', color: 'Azul Profundo', family: 'Vinílicas', presentation: '19L', price: 1950,
        stockByStore: [
            { storeId: 1, stock: 12, inTransit: 0, minStock: 10, maxStock: 50 },
            { storeId: 2, stock: 8, inTransit: 5, minStock: 8, maxStock: 40 },
            { storeId: 4, stock: 22, inTransit: 0, minStock: 12, maxStock: 60 },
            { storeId: 10, stock: 35, inTransit: 0, minStock: 15, maxStock: 80 },
            { storeId: 31, stock: 180, inTransit: 0, minStock: 50, maxStock: 400 },
        ]
    },
    {
        sku: 'VIN-003', name: 'Vinimex Total', color: 'Rojo Colonial', family: 'Vinílicas', presentation: '4L', price: 520,
        stockByStore: [
            { storeId: 1, stock: 25, inTransit: 0, minStock: 15, maxStock: 60 },
            { storeId: 3, stock: 0, inTransit: 15, minStock: 10, maxStock: 50 },
            { storeId: 5, stock: 18, inTransit: 0, minStock: 12, maxStock: 55 },
            { storeId: 31, stock: 340, inTransit: 0, minStock: 80, maxStock: 600 },
        ]
    },
    {
        sku: 'ESM-001', name: 'Esmalte Comex 100', color: 'Negro Brillante', family: 'Esmaltes', presentation: '1L', price: 285,
        stockByStore: [
            { storeId: 1, stock: 42, inTransit: 0, minStock: 20, maxStock: 80 },
            { storeId: 2, stock: 38, inTransit: 0, minStock: 18, maxStock: 75 },
            { storeId: 4, stock: 55, inTransit: 0, minStock: 25, maxStock: 100 },
            { storeId: 10, stock: 67, inTransit: 0, minStock: 30, maxStock: 120 },
            { storeId: 31, stock: 890, inTransit: 0, minStock: 200, maxStock: 1500 },
        ]
    },
    {
        sku: 'ESM-002', name: 'Esmalte Comex 100', color: 'Blanco Mate', family: 'Esmaltes', presentation: '4L', price: 680,
        stockByStore: [
            { storeId: 1, stock: 8, inTransit: 10, minStock: 12, maxStock: 50 },
            { storeId: 2, stock: 15, inTransit: 0, minStock: 10, maxStock: 45 },
            { storeId: 3, stock: 3, inTransit: 8, minStock: 8, maxStock: 40 },
            { storeId: 31, stock: 420, inTransit: 0, minStock: 100, maxStock: 800 },
        ]
    },
    {
        sku: 'IMP-001', name: 'Impermeabilizante 5 Años', color: 'Terracota', family: 'Impermeabilizantes', presentation: '19L', price: 2450,
        stockByStore: [
            { storeId: 1, stock: 22, inTransit: 0, minStock: 15, maxStock: 60 },
            { storeId: 4, stock: 45, inTransit: 0, minStock: 20, maxStock: 80 },
            { storeId: 10, stock: 38, inTransit: 0, minStock: 18, maxStock: 70 },
            { storeId: 20, stock: 52, inTransit: 0, minStock: 22, maxStock: 90 },
            { storeId: 31, stock: 680, inTransit: 0, minStock: 150, maxStock: 1200 },
        ]
    },
    {
        sku: 'IMP-002', name: 'Impermeabilizante 10 Años', color: 'Blanco', family: 'Impermeabilizantes', presentation: '19L', price: 3200,
        stockByStore: [
            { storeId: 1, stock: 0, inTransit: 12, minStock: 10, maxStock: 45 },
            { storeId: 4, stock: 28, inTransit: 0, minStock: 12, maxStock: 55 },
            { storeId: 10, stock: 19, inTransit: 0, minStock: 10, maxStock: 50 },
            { storeId: 31, stock: 320, inTransit: 0, minStock: 80, maxStock: 600 },
        ]
    },
    {
        sku: 'ACC-001', name: 'Brocha Profesional', color: '—', family: 'Accesorios', presentation: 'Pieza', price: 85,
        stockByStore: [
            { storeId: 1, stock: 120, inTransit: 0, minStock: 50, maxStock: 200 },
            { storeId: 2, stock: 95, inTransit: 0, minStock: 40, maxStock: 180 },
            { storeId: 3, stock: 78, inTransit: 0, minStock: 35, maxStock: 150 },
            { storeId: 4, stock: 145, inTransit: 0, minStock: 60, maxStock: 250 },
            { storeId: 31, stock: 2400, inTransit: 0, minStock: 500, maxStock: 5000 },
        ]
    },
    {
        sku: 'ACC-002', name: 'Rodillo Antigota 9"', color: '—', family: 'Accesorios', presentation: 'Pieza', price: 125,
        stockByStore: [
            { storeId: 1, stock: 65, inTransit: 0, minStock: 30, maxStock: 120 },
            { storeId: 2, stock: 48, inTransit: 0, minStock: 25, maxStock: 100 },
            { storeId: 4, stock: 82, inTransit: 0, minStock: 35, maxStock: 140 },
            { storeId: 31, stock: 1850, inTransit: 0, minStock: 400, maxStock: 4000 },
        ]
    },
    {
        sku: 'SEL-001', name: 'Sellador 5x1', color: 'Transparente', family: 'Selladores', presentation: '19L', price: 1280,
        stockByStore: [
            { storeId: 1, stock: 18, inTransit: 0, minStock: 12, maxStock: 50 },
            { storeId: 2, stock: 12, inTransit: 5, minStock: 10, maxStock: 45 },
            { storeId: 4, stock: 32, inTransit: 0, minStock: 15, maxStock: 65 },
            { storeId: 10, stock: 45, inTransit: 0, minStock: 20, maxStock: 80 },
            { storeId: 31, stock: 580, inTransit: 0, minStock: 120, maxStock: 1000 },
        ]
    },
];

// --- SERVICIOS DEL SISTEMA ---
export const SYSTEM_SERVICES: SystemService[] = [
    { id: 'auth', name: 'Inicio de Sesión', description: 'Permite a los empleados y administradores acceder al sistema', icon: Lock, status: 'online' },
    { id: 'db', name: 'Base de Datos', description: 'Guarda toda la información de productos, clientes e inventarios', icon: Database, status: 'online' },
    { id: 'inventory', name: 'Control de Inventario', description: 'Registra entradas, salidas y existencias de productos en tiendas', icon: Store, status: 'online' },
    { id: 'billing', name: 'Facturación', description: 'Genera facturas y comprobantes fiscales para las ventas', icon: FileBarChart, status: 'online' },
    { id: 'payments', name: 'Pagos', description: 'Procesa cobros con tarjeta, efectivo y transferencias', icon: Shield, status: 'online' },
    { id: 'sync', name: 'Sincronización', description: 'Mantiene actualizados los datos entre todas las sucursales', icon: Cloud, status: 'online' },
];

// --- HISTORIAL DE AUDITORÍAS ---
export const AUDIT_LOGS: AuditLog[] = [
    { id: 'AUD-001', date: '2026-01-18 14:32', user: 'Adrián García', storeId: 1, storeName: 'Celaya Centro', fileName: 'inventario_celaya_enero.xlsx', productsUpdated: 245, status: 'applied' },
    { id: 'AUD-002', date: '2026-01-17 09:15', user: 'Adrián García', storeId: 4, storeName: 'Querétaro Centro', fileName: 'qro_centro_17ene.xlsx', productsUpdated: 312, status: 'applied' },
    { id: 'AUD-003', date: '2026-01-16 16:45', user: 'María López', storeId: 10, storeName: 'León Centro', fileName: 'leon_auditoria.xlsx', productsUpdated: 0, status: 'cancelled' },
    { id: 'AUD-004', date: '2026-01-15 11:20', user: 'Adrián García', storeId: 24, storeName: 'Guadalajara Centro', fileName: 'gdl_enero_2026.xlsx', productsUpdated: 428, status: 'applied' },
];

// --- PREVIEW DE DIFF ---
export const AUDIT_DIFF_PREVIEW: AuditDiffItem[] = [
    { sku: 'VIN-001', name: 'Vinimex Total Blanco 19L', systemQty: 48, fileQty: 48, difference: 0, action: 'ok' },
    { sku: 'VIN-002', name: 'Vinimex Total Azul 19L', systemQty: 12, fileQty: 15, difference: 3, action: 'adjust_up' },
    { sku: 'VIN-003', name: 'Vinimex Total Rojo 4L', systemQty: 25, fileQty: 22, difference: -3, action: 'adjust_down' },
    { sku: 'ESM-001', name: 'Esmalte Comex Negro 1L', systemQty: 42, fileQty: 42, difference: 0, action: 'ok' },
    { sku: 'ESM-002', name: 'Esmalte Comex Blanco 4L', systemQty: 8, fileQty: 5, difference: -3, action: 'adjust_down' },
    { sku: 'IMP-001', name: 'Impermeabilizante 5 Años 19L', systemQty: 22, fileQty: 28, difference: 6, action: 'adjust_up' },
    { sku: 'ACC-001', name: 'Brocha Profesional 2"', systemQty: 120, fileQty: 115, difference: -5, action: 'adjust_down' },
    { sku: 'NEW-001', name: 'Sellador Acrílico Premium', systemQty: 0, fileQty: 12, difference: 12, action: 'new_product' },
];

// --- HELPER FUNCTIONS ---
export const getStockStatus = (stock: number, minStock: number, maxStock: number): 'ok' | 'low' | 'critical' | 'overstock' => {
    if (stock === 0) return 'critical';
    if (stock < minStock) return 'low';
    if (stock > maxStock) return 'overstock';
    return 'ok';
};

export const getProductStockForStore = (product: ProductWithStock, storeId: number) => {
    return product.stockByStore.find(s => s.storeId === storeId) || null;
};
