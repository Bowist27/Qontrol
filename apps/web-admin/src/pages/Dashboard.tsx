/**
 * AdminDashboard Page
 * Main orchestrator combining all components
 */

import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { SystemHealth } from '../types';

// Layout components
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import SystemStatusModal from '../components/layout/SystemStatusModal';

export default function AdminDashboard() {
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 200, online: true });
    const [showSystemStatus, setShowSystemStatus] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { logout } = useAuth();

    // Simulate system health check
    useEffect(() => {
        const interval = setInterval(() => {
            setSystemHealth({ status: 200, online: true });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } catch (error) {
            console.error("Error during logout:", error);
            alert("Hubo un error al conectar con el servidor, pero se cerrará la sesión local.");
            localStorage.removeItem('token');
            window.location.reload();
        } finally {
            setIsLoggingOut(false);
            setShowLogoutConfirm(false);
        }
    };



    return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
            {/* Sidebar */}
            <Sidebar
                systemHealth={systemHealth}
                onShowSystemStatus={() => setShowSystemStatus(true)}
                onLogout={handleLogout}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* System Status Modal */}
            <SystemStatusModal
                isOpen={showSystemStatus}
                onClose={() => setShowSystemStatus(false)}
            />

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <LogOut className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                ¿Cerrar sesión?
                            </h3>
                            <p className="text-slate-500 mb-6">
                                ¿Estás seguro que deseas salir del sistema? Tendrás que volver a ingresar tus credenciales.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    disabled={isLoggingOut}
                                    className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {isLoggingOut ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saliendo...
                                        </>
                                    ) : (
                                        'Cerrar Sesión'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <Topbar onLogout={handleLogout} />

                <div className="p-8 overflow-y-auto h-[calc(100vh-64px)]">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
