import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// User type matching the one from Electron main process
export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role_id: number;
    role_name: string;
    is_active: number;
    permissions: string[];
    store_ids: number[];
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    sync: () => Promise<{ success: boolean; added?: number; total?: number; error?: string }>;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check if user is already logged in on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await window.auth.getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                }
            } catch (err) {
                console.error('Error checking auth:', err);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.auth.login({ email, password });
            
            if (result.success && result.user) {
                setUser(result.user);
                return true;
            } else {
                // Handle specific error codes
                if (result.error === 'DB_EMPTY') {
                    setError('No hay usuarios sincronizados. Presiona "Sincronizar" para descargar usuarios.');
                } else {
                    setError(result.error || 'Error de autenticación');
                }
                return false;
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión con la aplicación');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await window.auth.logout();
            setUser(null);
        } catch (err) {
            console.error('Error logging out:', err);
        }
    }, []);

    const sync = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.auth.sync();
            if (!result.success) {
                setError(result.error || 'Error al sincronizar');
            }
            return result;
        } catch (err: any) {
            const errorMsg = err.message || 'Error de conexión';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Permission helpers
    const hasPermission = useCallback((permission: string): boolean => {
        if (!user) return false;
        return user.permissions.includes(permission);
    }, [user]);

    const hasAnyPermission = useCallback((permissions: string[]): boolean => {
        if (!user) return false;
        return permissions.some(p => user.permissions.includes(p));
    }, [user]);

    const hasAllPermissions = useCallback((permissions: string[]): boolean => {
        if (!user) return false;
        return permissions.every(p => user.permissions.includes(p));
    }, [user]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        sync,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        clearError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// HOC for protected routes
interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredPermissions?: string[];
    requireAll?: boolean;
    fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredPermissions = [],
    requireAll = false,
    fallback = null,
}) => {
    const { isAuthenticated, hasAnyPermission, hasAllPermissions } = useAuth();

    if (!isAuthenticated) {
        return fallback ? <>{fallback}</> : null;
    }

    if (requiredPermissions.length > 0) {
        const hasAccess = requireAll
            ? hasAllPermissions(requiredPermissions)
            : hasAnyPermission(requiredPermissions);

        if (!hasAccess) {
            return fallback ? <>{fallback}</> : null;
        }
    }

    return <>{children}</>;
};
