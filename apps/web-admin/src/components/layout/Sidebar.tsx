/**
 * Sidebar Component
 * Collapsible navigation for the admin dashboard
 */

import { NavLink } from 'react-router-dom';
import { BarChart3, Package, ClipboardList, FileSpreadsheet, Users, MapPin, LogOut, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePermissions, type Permission } from '../../hooks/usePermissions';
import type { SystemHealth } from '../../types';

interface SidebarProps {
    systemHealth: SystemHealth;
    onShowSystemStatus: () => void;
    onLogout: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    systemHealth,
    onShowSystemStatus,
    onLogout,
    isCollapsed,
    onToggleCollapse,
}) => {
    const { hasPermission } = usePermissions();

    const navItems: { path: string; label: string; icon: any; permission?: Permission }[] = [
        { path: '/dashboard/overview', label: 'Dashboard', icon: BarChart3, permission: 'web:dashboard' },
        { path: '/dashboard/inventory', label: 'Inventarios', icon: Package, permission: 'web:inventories' },
        { path: '/dashboard/audits', label: 'Auditorías', icon: ClipboardList, permission: 'web:audits' },
    ];

    const configItems: { path: string; label: string; icon: any; permission?: Permission }[] = [
        { path: '/dashboard/catalog', label: 'Catálogo Maestro', icon: FileSpreadsheet, permission: 'web:catalog' },
        { path: '/dashboard/users', label: 'Usuarios (IAM)', icon: Users, permission: 'web:users' },
        { path: '/dashboard/stores', label: 'Red Comercial', icon: MapPin, permission: 'web:users' },
    ];

    const visibleNavItems = navItems.filter(item => !item.permission || hasPermission(item.permission));
    const visibleConfigItems = configItems.filter(item => !item.permission || hasPermission(item.permission));

    return (
        <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
            {/* Logo + Toggle */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                {!isCollapsed && <h1 className="text-white font-bold tracking-wider text-xl">QONTROL.</h1>}
                <button
                    onClick={onToggleCollapse}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                    title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-2 space-y-1">
                {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'
                                } ${isCollapsed ? 'justify-center' : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon size={20} />
                            {!isCollapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}

                {/* Separator - only show if there are config items */}
                {visibleConfigItems.length > 0 && (
                    <>
                        <div className="border-t border-slate-700 my-3"></div>
                        {!isCollapsed && <p className="px-3 text-xs text-slate-500 uppercase tracking-wide">Configuración</p>}
                    </>
                )}

                {visibleConfigItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
                                } ${isCollapsed ? 'justify-center' : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon size={20} />
                            {!isCollapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer: System Status + Logout */}
            <div className="p-2 border-t border-slate-800 space-y-2">
                {/* System Status */}
                <button
                    onClick={onShowSystemStatus}
                    className={`w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'text-left'}`}
                    title={isCollapsed ? 'Estado del sistema' : undefined}
                >
                    <Activity size={16} className={systemHealth.online ? "text-emerald-400" : "text-red-400"} />
                    {!isCollapsed && (
                        <>
                            <div className="flex-1">
                                <p className="text-xs text-slate-400">Sistema</p>
                                <p className={`text-xs font-medium ${systemHealth.online ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {systemHealth.online ? 'Todo operativo' : 'Con problemas'}
                                </p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${systemHealth.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                        </>
                    )}
                </button>

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-slate-800 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? 'Cerrar sesión' : undefined}
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span>Cerrar Sesión</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
