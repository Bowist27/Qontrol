/**
 * AuthContext - Global Authentication State
 * Provides authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../core/domain/entities/User';
import { LoginUseCase, loginUseCase } from '../core/application/usecases/LoginUseCase';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    // Initialize state directly from storage to avoid useEffect cascade
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = LoginUseCase.getCurrentUser();
        return (storedUser && LoginUseCase.isAuthenticated()) ? storedUser : null;
    });
    const [isLoading] = useState(false);

    // Listen for global logout events
    useEffect(() => {
        // Global Logout Listener (triggered by 401s in API clients)
        const handleGlobalLogout = () => {
            loginUseCase.logout();
            setUser(null);
        };

        window.addEventListener('auth:logout', handleGlobalLogout);
        return () => window.removeEventListener('auth:logout', handleGlobalLogout);
    }, []);

    const login = (userData: User) => {
        setUser(userData);
    };

    const logout = async () => {
        await loginUseCase.logout();
        setUser(null);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
