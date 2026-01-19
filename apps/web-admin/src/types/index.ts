// Types for Admin Dashboard

export type StockStatus = 'ok' | 'low' | 'critical' | 'overstock';
export type ProductFamily = 'Vinílicas' | 'Esmaltes' | 'Impermeabilizantes' | 'Accesorios' | 'Selladores';
export type Presentation = '1L' | '4L' | '19L' | 'Tambor' | 'Pieza';
export type StoreStatus = 'online' | 'warning' | 'offline';
export type AuditDiffAction = 'ok' | 'adjust_up' | 'adjust_down' | 'new_product';
export type AuditStatus = 'applied' | 'cancelled' | 'pending';
export type ViewType = 'dashboard' | 'inventory_detail' | 'audits' | 'catalog' | 'users';

export interface Store {
    id: number;
    name: string;
    city: string;
    status: StoreStatus;
    salesToday: number;
    inventory: number;
    pendingSync: number;
}

export interface Product {
    sku: string;
    name: string;
    color: string;
    family: ProductFamily;
    presentation: Presentation;
    price: number;
}

export interface StoreStock {
    storeId: number;
    stock: number;
    inTransit: number;
    minStock: number;
    maxStock: number;
}

export interface ProductWithStock extends Product {
    stockByStore: StoreStock[];
}

export interface AuditDiffItem {
    sku: string;
    name: string;
    systemQty: number;
    fileQty: number;
    difference: number;
    action: AuditDiffAction;
}

export interface AuditLog {
    id: string;
    date: string;
    user: string;
    storeId: number;
    storeName: string;
    fileName: string;
    productsUpdated: number;
    status: AuditStatus;
}

export interface SystemService {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    status: 'online' | 'offline';
}

export interface SystemHealth {
    status: number;
    online: boolean;
}
