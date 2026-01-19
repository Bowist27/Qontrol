import { useState } from 'react';

export const useAuth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (email: string, pass: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.auth.login({ email, password: pass });

            if (!result.success) {
                // Handle specific error codes if needed
                setError(result.error || 'Login failed');
                return false;
            }

            return true; // Success
        } catch (err: any) {
            setError(err.message || 'Error communicating with Desktop App');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const manualSync = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.auth.sync();
            if (!result.success) {
                setError(result.error || 'Sync failed');
                return false;
            }
            return true;
        } catch (err: any) {
            setError('Sync failed: ' + err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { login, manualSync, loading, error };
};
