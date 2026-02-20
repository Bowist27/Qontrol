/**
 * ProtectedRoute with Permission Check
 * Wraps routes to enforce both authentication and permissions.
 * 
 * If no permissions specified, only checks auth.
 * If user lacks permission, redirects to /dashboard/overview or shows "Sin acceso".
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions, type Permission } from '../../hooks/usePermissions';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    permission?: Permission;
    permissions?: Permission[];
    requireAll?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    permission,
    permissions,
    requireAll = false,
}) => {
    const { isAuthenticated, isLoading } = useAuth();
    const { hasPermission, hasAny, hasAll } = usePermissions();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check permissions
    let allowed = true;
    if (permission) {
        allowed = hasPermission(permission);
    } else if (permissions && permissions.length > 0) {
        allowed = requireAll ? hasAll(permissions) : hasAny(permissions);
    }

    if (!allowed) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <ShieldX className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800">Sin acceso</h2>
                    <p className="text-slate-500">
                        Tu rol no tiene permisos para acceder a esta sección.
                        Contacta a un administrador si necesitas acceso.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
