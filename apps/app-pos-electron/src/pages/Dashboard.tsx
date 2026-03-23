/**
 * Dashboard POS - Main menu after login
 * Shows options based on user permissions
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';

// Icons
const ShoppingCartIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
);

const CashRegisterIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M12 12h.01" />
        <path d="M17 12h.01" />
        <path d="M7 12h.01" />
        <path d="M12 6V2" />
        <path d="M2 10h20" />
    </svg>
);

const InventoryIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

// @ts-ignore used conditionally
const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);


const LogoutIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
);

const BillingIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

interface DashboardProps {
    onLogout: () => void;
    onNavigate?: (page: string) => void;
}

interface MenuOption {
    id: string;
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    permission?: string;
    color: string;
    onClick?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout, onNavigate }) => {
    const { user, logout, hasPermission } = useAuth();

    const handleLogout = async () => {
        await logout();
        onLogout();
    };

    // Define menu options with required permissions
    const menuOptions: MenuOption[] = [
        {
            id: 'auditoria',
            title: 'Auditoría Física',
            description: 'Escaneo rápido con pistola Zebra',
            icon: InventoryIcon,
            permission: 'pos:inventory',
            color: 'from-emerald-500 to-teal-600',
            onClick: () => onNavigate?.('audit'),
        },
        {
            id: 'ventas',
            title: 'Punto de Venta',
            description: 'Realizar ventas y cobros',
            icon: ShoppingCartIcon,
            permission: 'pos:sales',
            color: 'from-blue-500 to-blue-600',
        },
        {
            id: 'corte',
            title: 'Corte de Caja',
            description: 'Cierre y conteo de efectivo',
            icon: CashRegisterIcon,
            permission: 'pos:sales',
            color: 'from-amber-500 to-amber-600',
        },
        {
            id: 'inventario',
            title: 'Consultar Inventario',
            description: 'Ver existencias y buscar productos',
            icon: InventoryIcon,
            permission: 'pos:inventory',
            color: 'from-purple-500 to-purple-600',
        },

        {
            id: 'facturacion',
            title: 'Facturar / Reimprimir',
            description: 'Emitir CFDI a clientes',
            icon: BillingIcon,
            permission: 'pos:sales', // same permission as sales or a new one
            color: 'from-emerald-600 to-emerald-800',
            onClick: () => onNavigate?.('billing'),
        },
        {
            id: 'configuracion',
            title: 'Configuración',
            description: 'Ajustes del sistema',
            icon: SettingsIcon,
            color: 'from-slate-500 to-slate-600',
        },
    ];

    // Filter options based on permissions
    const availableOptions = menuOptions.filter(
        (option) => !option.permission || hasPermission(option.permission)
    );

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-white tracking-tight">
                                QONTROL<span className="text-blue-400">.</span>
                            </h1>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                                POS
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* User Info */}
                            <div className="text-right">
                                <div className="text-sm font-medium text-white">
                                    {user?.first_name} {user?.last_name}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {user?.role_name}
                                </div>
                            </div>
                            
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                                {user?.first_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            
                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                title="Cerrar Sesión"
                            >
                                <LogoutIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        ¡Hola, {user?.first_name}!
                    </h2>
                    <p className="text-slate-400">
                        Selecciona una opción para comenzar
                    </p>
                </div>

                {/* Menu Grid */}
                {availableOptions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    onClick={option.onClick}
                                    className="group p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-900/50 text-left"
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-1">
                                        {option.title}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {option.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">
                            Sin acceso a módulos
                        </h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Tu cuenta no tiene permisos asignados para ningún módulo del POS. 
                            Contacta a tu administrador para solicitar acceso.
                        </p>
                    </div>
                )}

                {/* Store Access */}
                {user?.store_ids && user.store_ids.length > 0 && (
                    <div className="mt-8 p-4 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-sm font-medium text-slate-300">Tiendas asignadas</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {user.store_ids.map((storeId) => (
                                <span
                                    key={storeId}
                                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium"
                                >
                                    Tienda #{storeId}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
