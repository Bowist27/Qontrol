/**
 * Login Page - Electron Desktop App
 * Matches the web-admin design with offline-first capabilities
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/ui/Logo';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

// Icons
const EmailIcon: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);

const LockIcon: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const SyncIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
);

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, manualSync, loading, error } = useAuth();
    const [msg, setMsg] = useState('');
    const [syncing, setSyncing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        const success = await login(email, password);
        if (success) {
            setMsg('¡Login exitoso! Redirigiendo...');
            // In a real app, redirect to dashboard
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMsg('');
        const success = await manualSync();
        if (success) {
            setMsg('Usuarios sincronizados correctamente ✅');
        }
        setSyncing(false);
    };

    return (
        <div className="flex min-h-screen bg-slate-900 font-sans">
            {/* Left Brand Section - visible on larger screens */}
            <section className="hidden lg:flex flex-1 relative p-12 bg-gradient-to-br from-[#009fdb] via-[#005580] to-slate-900 overflow-hidden">
                {/* Decorative gradients */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,212,170,0.2)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(0,159,219,0.3)_0%,transparent_50%)]" />

                <div className="relative z-10 h-full flex flex-col justify-center max-w-[500px]">
                    <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-white leading-tight mb-6 tracking-tight">
                        QONTROL.
                    </h1>
                    <p className="text-base text-white/70 leading-relaxed">
                        Punto de Venta Offline-First. Sincroniza tus datos cuando tengas conexión.
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-white/50 text-sm">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Versión Desktop
                    </div>
                </div>
            </section>

            {/* Right Login Section */}
            <section className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-900 max-sm:p-6">
                <div className="w-full max-w-[380px] animate-[fadeIn_0.5s_ease_forwards]">
                    <Logo />

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-1 max-sm:text-xl">
                            Bienvenido de nuevo
                        </h2>
                        <p className="text-sm text-slate-400">
                            Ingresa tus credenciales para acceder.
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {msg && !error && (
                        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
                            {msg}
                        </div>
                    )}

                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        <InputField
                            type="email"
                            id="email"
                            label="Correo Electrónico"
                            placeholder="jose.admin@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<EmailIcon />}
                            required
                            autoComplete="email"
                        />

                        <InputField
                            type="password"
                            id="password"
                            label="Contraseña"
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={<LockIcon />}
                            required
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            loading={loading}
                        >
                            Iniciar Sesión
                        </Button>
                    </form>

                    {/* Sync Section */}
                    <div className="mt-8 pt-6 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 text-center mb-4">
                            ¿Problemas de acceso? Sincroniza los usuarios si tienes conexión.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            fullWidth
                            onClick={handleSync}
                            loading={syncing}
                            icon={<SyncIcon />}
                        >
                            Sincronizar Usuarios
                        </Button>
                    </div>

                    <p className="text-center mt-8 text-xs text-slate-500 leading-relaxed">
                        Este es un sistema privado para uso exclusivo de<br />
                        personal autorizado de Comex.
                    </p>
                </div>
            </section>
        </div>
    );
};
