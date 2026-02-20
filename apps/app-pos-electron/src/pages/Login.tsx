/**
 * Login Page - Electron Desktop App
 * Uses AuthContext for authentication management
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

// Auth API URL for forgot password
const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082';

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

interface LoginProps {
    onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [appVersion, setAppVersion] = useState('...');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState('');
    
    const { login, sync, isLoading, error, clearError } = useAuth();

    // Get app version
    useEffect(() => {
        (window as any).appInfo?.getVersion?.().then((v: string) => setAppVersion(v)).catch(() => setAppVersion('dev'));
    }, []);

    // Clear error when user types
    useEffect(() => {
        if (error && (email || password)) {
            clearError();
        }
    }, [email, password, error, clearError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        
        const success = await login(email, password);
        if (success) {
            setMsg('¡Login exitoso! Cargando...');
            setTimeout(() => {
                onLoginSuccess();
            }, 500);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMsg('');
        const result = await sync();
        if (result.success) {
            setMsg(`✅ ${result.added || 0} usuarios sincronizados. Total: ${result.total || 0}`);
        }
        setSyncing(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');

        if (!forgotEmail.trim()) {
            setForgotError('Ingresa tu correo electrónico');
            return;
        }

        setForgotLoading(true);
        try {
            const res = await fetch(`${AUTH_API}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
            });

            if (!res.ok) {
                throw new Error('Error en el servidor');
            }

            setForgotSent(true);
        } catch {
            setForgotError('Error al enviar. Verifica tu conexión a internet.');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleBackToLogin = () => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotSent(false);
        setForgotError('');
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
                        Versión Desktop v{appVersion}
                    </div>
                </div>
            </section>

            {/* Right Login Section */}
            <section className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-900 max-sm:p-6">
                <div className="w-full max-w-[380px] animate-[fadeIn_0.5s_ease_forwards]">
                    <Logo />

                    {showForgotPassword ? (
                        /* ===== FORGOT PASSWORD VIEW ===== */
                        forgotSent ? (
                            <div className="text-center">
                                <div className="flex justify-center mb-6">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    Correo enviado
                                </h2>
                                <p className="text-sm text-slate-400 mb-2">
                                    Si el correo <span className="text-white font-medium">{forgotEmail}</span> está registrado, recibirás un enlace para restablecer tu contraseña.
                                </p>
                                <p className="text-xs text-slate-500 mb-4">
                                    Revisa tu bandeja de entrada y spam. El enlace es válido por 48 horas.
                                </p>
                                <p className="text-xs text-blue-400/80 mb-8">
                                    📱 Abre el enlace desde tu celular o cualquier navegador para cambiar tu contraseña.
                                </p>

                                <button
                                    onClick={handleBackToLogin}
                                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m12 19-7-7 7-7" />
                                        <path d="M19 12H5" />
                                    </svg>
                                    Volver a Iniciar Sesión
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-white mb-1 max-sm:text-xl">
                                        ¿Olvidaste tu contraseña?
                                    </h2>
                                    <p className="text-sm text-slate-400">
                                        Ingresa tu correo y te enviaremos un enlace para restablecerla. Podrás abrirlo desde tu celular.
                                    </p>
                                </div>

                                {forgotError && (
                                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                                        {forgotError}
                                    </div>
                                )}

                                <form className="flex flex-col gap-6" onSubmit={handleForgotPassword}>
                                    <InputField
                                        type="email"
                                        id="forgot-email"
                                        label="Correo Electrónico"
                                        placeholder="tu.correo@empresa.com"
                                        value={forgotEmail}
                                        onChange={(e) => {
                                            setForgotEmail(e.target.value);
                                            setForgotError('');
                                        }}
                                        icon={<EmailIcon />}
                                        required
                                        autoComplete="email"
                                    />

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        fullWidth
                                        loading={forgotLoading}
                                    >
                                        Enviar enlace de recuperación
                                    </Button>
                                </form>

                                <div className="text-center mt-6">
                                    <button
                                        onClick={handleBackToLogin}
                                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m12 19-7-7 7-7" />
                                            <path d="M19 12H5" />
                                        </svg>
                                        Volver a Iniciar Sesión
                                    </button>
                                </div>

                                <p className="text-center mt-8 text-xs text-slate-500 leading-relaxed">
                                    Este es un sistema privado para uso exclusivo de<br />
                                    personal autorizado de Comex.
                                </p>
                            </>
                        )
                    ) : (
                        /* ===== LOGIN VIEW ===== */
                        <>
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
                                    loading={isLoading && !syncing}
                                >
                                    Iniciar Sesión
                                </Button>
                            </form>

                            {/* Forgot Password Link */}
                            <div className="text-center mt-4">
                                <button
                                    onClick={() => {
                                        setShowForgotPassword(true);
                                        setForgotEmail(email); // Pre-fill with current email
                                    }}
                                    className="text-sm text-blue-400/80 hover:text-blue-300 transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>

                            {/* Sync Section */}
                            <div className="mt-6 pt-6 border-t border-slate-700/50">
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
                        </>
                    )}
                </div>
            </section>
        </div>
    );
};
