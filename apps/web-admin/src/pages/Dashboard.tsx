/**
 * Dashboard Page
 * Implements: Page -> Page: navigate("/dashboard")
 *             Page -> User: Muestra Dashboard
 * 
 * Destination after successful login
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-lg">
                            Q
                        </div>
                        <span className="text-xl font-semibold">QONTROL</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-slate-400">Bienvenido,</p>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                    <p className="text-slate-400">Panel de administración de QONTROL Enterprise</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">Usuario</p>
                        <p className="text-2xl font-bold">{user?.email}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">Rol</p>
                        <p className="text-2xl font-bold capitalize">{user?.role}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">Estado</p>
                        <p className="text-2xl font-bold text-green-500">Activo</p>
                    </div>
                </div>

                {/* Success Message */}
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-500">¡Login Exitoso!</h3>
                            <p className="text-slate-400 text-sm">Has iniciado sesión correctamente en QONTROL Enterprise.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
