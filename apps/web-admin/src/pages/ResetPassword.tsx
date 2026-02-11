/**
 * ResetPassword.tsx - Account Activation / Password Reset Page
 * 
 * Public page where users can set their new password using a reset token.
 * Token is received via email when an admin creates their account.
 * Design matches the Login page (dark theme, same components).
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import BrandSection from '../components/ui/BrandSection';
import Logo from '../components/ui/Logo';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082';

// Detect if connecting directly to backend (port-based) vs through nginx
function getApiBase() {
    const url = new URL(AUTH_API);
    if (url.port && url.port !== '80' && url.port !== '443') {
        return AUTH_API;
    }
    return `${url.origin}/api/auth`;
}

// Icons
const LockIcon: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const ShieldCheckIcon: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

interface TokenValidation {
    valid: boolean;
    email?: string;
    first_name?: string;
}

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') || '';

    const [validating, setValidating] = useState(true);
    const [tokenInfo, setTokenInfo] = useState<TokenValidation | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setValidating(false);
            setTokenInfo({ valid: false });
            return;
        }

        const validateToken = async () => {
            try {
                const apiBase = getApiBase();
                const res = await fetch(`${apiBase}/reset-password/validate?token=${encodeURIComponent(token)}`);
                const data = await res.json();
                setTokenInfo(data);
            } catch {
                setTokenInfo({ valid: false });
            } finally {
                setValidating(false);
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setSubmitting(true);
        try {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Error al cambiar contraseña');
                return;
            }

            setSuccess(true);
        } catch {
            setError('Error de conexión. Intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = (pass: string) => {
        if (!pass) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pass.length >= 6) score++;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 2) return { level: score, label: 'Débil', color: 'bg-red-500' };
        if (score <= 3) return { level: score, label: 'Media', color: 'bg-yellow-500' };
        return { level: score, label: 'Fuerte', color: 'bg-green-500' };
    };

    const strength = getPasswordStrength(newPassword);

    return (
        <div className="flex min-h-screen bg-slate-900 font-sans">
            <BrandSection />

            <section className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-900 max-sm:p-6">
                <div className="w-full max-w-[380px] animate-[fadeIn_0.5s_ease_forwards]">
                    <Logo />

                    {/* Loading */}
                    {validating && (
                        <div className="flex flex-col items-center py-12">
                            <div className="w-8 h-8 border-2 border-slate-600 border-t-[#009fdb] rounded-full animate-spin mb-4" />
                            <p className="text-sm text-slate-400">Validando enlace...</p>
                        </div>
                    )}

                    {/* Invalid token */}
                    {!validating && tokenInfo && !tokenInfo.valid && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 max-sm:text-xl">
                                Enlace inválido o expirado
                            </h2>
                            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                                Este enlace de activación ya no es válido.<br />
                                Contacta al administrador para solicitar uno nuevo.
                            </p>
                            <Button
                                variant="outline"
                                fullWidth
                                onClick={() => navigate('/login')}
                            >
                                Ir a Inicio de Sesión
                            </Button>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 max-sm:text-xl">
                                ¡Cuenta activada!
                            </h2>
                            <p className="text-sm text-slate-400 mb-8">
                                Tu contraseña ha sido establecida exitosamente.
                            </p>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={() => navigate('/login')}
                            >
                                Iniciar Sesión
                            </Button>
                        </div>
                    )}

                    {/* Password form */}
                    {!validating && tokenInfo?.valid && !success && (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-white mb-1 max-sm:text-xl">
                                    Activa tu cuenta
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Establece una contraseña segura para comenzar.
                                </p>
                            </div>

                            {/* User badge */}
                            <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-6">
                                <div className="w-8 h-8 rounded-full bg-[#009fdb]/10 border border-[#009fdb]/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[#009fdb] text-sm font-semibold">
                                        {tokenInfo.first_name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{tokenInfo.first_name}</p>
                                    <p className="text-xs text-slate-500 truncate">{tokenInfo.email}</p>
                                </div>
                            </div>

                            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                                {/* New password with strength indicator */}
                                <div className="flex flex-col gap-2">
                                    <InputField
                                        type="password"
                                        id="new-password"
                                        label="Nueva contraseña"
                                        placeholder="Mínimo 6 caracteres"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        icon={<LockIcon />}
                                        required
                                        autoComplete="new-password"
                                    />
                                    {newPassword && (
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full ${strength.color} transition-all duration-300 rounded-full`}
                                                    style={{ width: `${(strength.level / 5) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500 w-10 text-right">{strength.label}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div className="flex flex-col gap-2">
                                    <InputField
                                        type="password"
                                        id="confirm-password"
                                        label="Confirmar contraseña"
                                        placeholder="Repite tu contraseña"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        icon={<ShieldCheckIcon />}
                                        required
                                        autoComplete="new-password"
                                    />
                                    {confirmPassword && confirmPassword !== newPassword && (
                                        <p className="text-xs text-red-400 px-1">Las contraseñas no coinciden</p>
                                    )}
                                    {confirmPassword && confirmPassword === newPassword && (
                                        <p className="text-xs text-green-400 px-1">Las contraseñas coinciden</p>
                                    )}
                                </div>

                                {/* Error message */}
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                                        {error}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    loading={submitting}
                                    disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                                >
                                    Activar mi cuenta
                                </Button>
                            </form>
                        </>
                    )}

                    <p className="text-center mt-8 text-xs text-slate-500 leading-relaxed">
                        Este es un sistema privado para uso exclusivo de<br />
                        personal autorizado de Comex.
                    </p>
                </div>
            </section>
        </div>
    );
}
