import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, manualSync, loading, error } = useAuth();
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        const success = await login(email, password);
        if (success) {
            setMsg('Login Exitoso (Redirigiendo...)');
            // In a real app, you would redirect here or update global auth state
        }
    };

    const handleSync = async () => {
        setMsg('Sincronizando...');
        const success = await manualSync();
        if (success) {
            setMsg('Usuarios Sincronizados Correctamente ✅');
        } else {
            setMsg('Error al sincronizar ❌');
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: '#f5f5f5',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{
                padding: '2rem',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                width: '350px'
            }}>
                <h2 style={{ textAlign: 'center', color: '#333' }}>QONTROL Point of Sale</h2>
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>Version Desktop (Offline-First)</p>

                {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
                {msg && <div style={{ color: 'green', marginBottom: '1rem', textAlign: 'center' }}>{msg}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            padding: '0.75rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? 'Cargando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                        ¿Problemas de acceso? Intente sincronizar los usuarios si tiene internet.
                    </p>
                    <button
                        onClick={handleSync}
                        disabled={loading}
                        style={{
                            backgroundColor: 'transparent',
                            color: '#666',
                            border: '1px solid #ccc',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        🔄 Sincronizar Usuarios
                    </button>
                </div>
            </div>
        </div>
    );
};
