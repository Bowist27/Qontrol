/**
 * ForgotPassword.tsx - Password Recovery Page
 * 
 * Public page where users can request a password reset email.
 * Design matches the Login page (dark theme, same components).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandSection from '../components/ui/BrandSection';
import Logo from '../components/ui/Logo';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8082';

function getApiBase() {
    try {
        const url = new URL(AUTH_API);
        if (url.port && url.port !== '80' && url.port !== '443') {
            return AUTH_API;
        }
    } catch { /* fall through */ }
    return `${AUTH_API}/api/auth`;
}

// Icons
const EmailIcon: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);

const ArrowLeftIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </svg>
);

const CheckCircleIcon: React.FC = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Ingresa tu correo electrónico');
            return;
        }

        setLoading(true);

        try {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });

            if (!res.ok) {
                throw new Error('Error en el servidor');
            }

            setSent(true);
        } catch {
            setError('Error al enviar la solicitud. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-900 font-sans">
            <BrandSection />

            <section className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-900 max-sm:p-6">
                <div className="w-full max-w-[380px] animate-[fadeIn_0.5s_ease_forwards]">
                    <Logo />

                    {sent ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-6">
                                <CheckCircleIcon />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                Correo enviado
                            </h2>
                            <p className="text-sm text-slate-400 mb-2">
                                Si el correo <span className="text-white font-medium">{email}</span> está registrado, recibirás un enlace para restablecer tu contraseña.
                            </p>
                            <p className="text-xs text-slate-500 mb-8">
                                Revisa tu bandeja de entrada y spam. El enlace es válido por 48 horas.
                            </p>

                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <ArrowLeftIcon />
                                Volver a Iniciar Sesión
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-white mb-1 max-sm:text-xl">
                                    ¿Olvidaste tu contraseña?
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Ingresa tu correo y te enviaremos un enlace para restablecerla.
                                </p>
                            </div>

                            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                                <InputField
                                    type="email"
                                    id="email"
                                    label="Correo Electrónico"
                                    placeholder="tu.correo@empresa.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError('');
                                    }}
                                    icon={<EmailIcon />}
                                    required
                                    autoComplete="email"
                                />

                                {error && (
                                    <p className="text-sm text-red-400 text-center -mt-2">
                                        {error}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    loading={loading}
                                >
                                    Enviar enlace de recuperación
                                </Button>
                            </form>

                            <div className="text-center mt-6">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    <ArrowLeftIcon />
                                    Volver a Iniciar Sesión
                                </Link>
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
}
