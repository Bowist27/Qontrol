/**
 * Topbar Component
 * Header with dynamic title and profile dropdown
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Settings, LogOut, Shield, Store, Clock } from 'lucide-react';
import type { ViewType } from '../../types';

interface TopbarProps {
    currentView: ViewType;
    onLogout: () => void;
}

const VIEW_TITLES: Record<ViewType, string> = {
    dashboard: 'Dashboard General',
    inventory_detail: 'Consulta de Inventarios',
    audits: 'Auditorías y Ajustes',
    catalog: 'Catálogo Maestro',
    users: 'Gestión de Usuarios',
};

const Topbar: React.FC<TopbarProps> = ({ currentView, onLogout }) => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
            {/* Dynamic Title */}
            <div>
                <h2 className="text-lg font-bold text-slate-800">{VIEW_TITLES[currentView]}</h2>
                <p className="text-xs text-slate-500">Bienvenido de vuelta, Administrador</p>
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
                <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">Administrador Global</p>
                        <p className="text-xs text-slate-500">admin@qontrol.com</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold">
                        AD
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                        {/* User Info */}
                        <div className="px-4 py-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    AD
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">Jose Admin</p>
                                    <p className="text-sm text-slate-500">admin@qontrol.com</p>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                            <div className="flex items-center gap-3 text-sm">
                                <Shield size={16} className="text-blue-500" />
                                <span className="text-slate-600">Rol:</span>
                                <span className="font-medium text-slate-800">Administrador Global</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Store size={16} className="text-green-500" />
                                <span className="text-slate-600">Tiendas:</span>
                                <span className="font-medium text-slate-800">Todas (31)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Clock size={16} className="text-amber-500" />
                                <span className="text-slate-600">Última sesión:</span>
                                <span className="font-medium text-slate-800">Hoy, 10:30 AM</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-2 py-2">
                            <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm">
                                <User size={16} /> Ver Mi Perfil
                            </button>
                            <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm">
                                <Settings size={16} /> Configuración
                            </button>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                            >
                                <LogOut size={16} /> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Topbar;
