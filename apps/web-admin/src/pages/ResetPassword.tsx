/**
 * ResetPassword.tsx - Password Reset Page
 * 
 * Public page where users can set their new password using a reset token.
 * Token is received via email when an admin creates their account.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082';

// Detect if connecting directly to backend (port-based) vs through nginx
function getApiBase() {
    const url = new URL(AUTH_API);
    // Direct connection: use URL as-is
    if (url.port && url.port !== '80' && url.port !== '443') {
        return AUTH_API;
    }
    // Via Nginx: prefix with /api/auth
    return `${url.origin}/api/auth`;
}

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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-wider">QONTROL<span className="text-blue-400">.</span></h1>
                </div>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
                        <h2 className="text-xl font-semibold text-white">
                            {success ? '¡Cuenta activada!' : 'Activa tu cuenta'}
                        </h2>
                        <p className="text-blue-100 text-sm mt-1">
                            {success
                                ? 'Ya puedes iniciar sesión con tu nueva contraseña'
                                : 'Establece una contraseña segura para comenzar'
                            }
                        </p>
                    </div>

                    <div className="p-6">
                        {/* Loading */}
                        {validating && (
                            <div className="flex flex-col items-center py-8">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-slate-500 text-sm">Validando enlace...</p>
                            </div>
                        )}

                        {/* Invalid token */}
                        {!validating && tokenInfo && !tokenInfo.valid && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Enlace inválido o expirado</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Este enlace de activación ya no es válido. 
                                    Contacta al administrador para solicitar uno nuevo.
                                </p>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                                >
                                    Ir a Inicio de Sesión
                                </button>
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">¡Listo!</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Tu contraseña ha sido actualizada exitosamente.
                                </p>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    Iniciar Sesión
                                </button>
                            </div>
                        )}

                        {/* Password form */}
                        {!validating && tokenInfo?.valid && !success && (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* User info */}
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <p className="text-sm text-slate-600">
                                        <span className="font-medium text-slate-800">{tokenInfo.first_name}</span>
                                        <span className="mx-2 text-slate-300">·</span>
                                        <span className="text-slate-500">{tokenInfo.email}</span>
                                    </p>
                                </div>

                                {/* New password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Nueva contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        autoFocus
                                    />
                                    {/* Strength indicator */}
                                    {newPassword && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full ${strength.color} transition-all duration-300`}
                                                    style={{ width: `${(strength.level / 5) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500">{strength.label}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Confirmar contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repite tu contraseña"
                                        className={`w-full px-4 py-2.5 border rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            confirmPassword && confirmPassword !== newPassword
                                                ? 'border-red-300 bg-red-50'
                                                : confirmPassword && confirmPassword === newPassword
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-slate-300'
                                        }`}
                                    />
                                    {confirmPassword && confirmPassword !== newPassword && (
                                        <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                                    )}
                                </div>

                                {/* Error message */}
                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                                        {error}
                                    </div>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={submitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Guardando...
                                        </span>
                                    ) : (
                                        'Establecer contraseña'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-xs mt-6">
                    © 2026 QONTROL. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
}
