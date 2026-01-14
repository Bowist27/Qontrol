/**
 * AuthContext - Global Authentication State
 * Provides authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../core/domain/entities/User';
import { LoginUseCase } from '../core/application/usecases/LoginUseCase';

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
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const storedUser = LoginUseCase.getCurrentUser();
        if (storedUser && LoginUseCase.isAuthenticated()) {
            setUser(storedUser);
        }
        setIsLoading(false);
    }, []);

    const login = (userData: User) => {
        setUser(userData);
    };

    const logout = () => {
        LoginUseCase.clearSession();
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
