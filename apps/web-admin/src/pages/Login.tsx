/**
 * Login Page - Updated to follow Sequence Diagram
 * 
 * Implements:
 * - User -> Page: Ingresa email y contraseña
 * - User -> Page: Clic en "Iniciar Sesión"
 * - Page ->> UseCase: execute(credentials: LoginCredentials)
 * - UseCase -->> Page: Success/Error
 * - Page -> Page: navigate("/dashboard")
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import BrandSection from '../components/ui/BrandSection';
import Logo from '../components/ui/Logo';
import InputField from '../components/ui/InputField';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { loginUseCase } from '../core/application/usecases/LoginUseCase';
import type { LoginCredentials } from '../core/domain/entities/User';

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

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    /**
     * Handle form submission
     * Implements: Page ->> UseCase: execute(credentials: LoginCredentials)
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const credentials: LoginCredentials = { email, password };

        try {
            // Page ->> UseCase: execute(credentials)
            const result = await loginUseCase.execute(credentials);

            if (result.success) {
                // Update auth context
                login(result.user);

                // Show success toast
                toast.success('¡Bienvenido de nuevo!', {
                    position: 'top-right',
                    autoClose: 2000,
                });

                // Page -> Page: navigate("/dashboard")
                navigate('/dashboard');
            } else {
                // UseCase -->> Page: Toast error message
                toast.error(result.error.message, {
                    position: 'top-right',
                    autoClose: 4000,
                });
            }
        } catch (error) {
            toast.error('Error inesperado. Intente nuevamente.', {
                position: 'top-right',
                autoClose: 4000,
            });
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

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-1 max-sm:text-xl">
                            Bienvenido de nuevo
                        </h2>
                        <p className="text-sm text-slate-400">
                            Ingresa tus credenciales para acceder.
                        </p>
                    </div>

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

                    <p className="text-center mt-8 text-xs text-slate-500 leading-relaxed">
                        Este es un sistema privado para uso exclusivo de<br />
                        personal autorizado de Comex.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default Login;
