/**
 * usePermissions Hook - Role-Based Access Control
 * 
 * Reads permissions from user.role.permissions + user_permissions overrides.
 * Permission format: "web:dashboard", "web:users", "pos:sales", etc.
 * 
 * Usage:
 *   const { hasPermission, hasAny, hasAll, canAccessWeb, canAccessPos } = usePermissions();
 *   if (hasPermission('web:users')) { ... }
 */

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export type Permission =
    | 'web:dashboard'
    | 'web:inventories'
    | 'web:audits'
    | 'web:catalog'
    | 'web:users'
    | 'pos:sales'
    | 'pos:inventory'
    | 'pos:reports';

export function usePermissions() {
    const { user } = useAuth();

    const permissions = useMemo(() => {
        const rolePerms = user?.role?.permissions ?? [];
        // user_permissions overrides could be added here in the future
        return new Set<string>(rolePerms);
    }, [user?.role?.permissions]);

    const hasPermission = (perm: Permission): boolean => permissions.has(perm);
    const hasAny = (perms: Permission[]): boolean => perms.some(p => permissions.has(p));
    const hasAll = (perms: Permission[]): boolean => perms.every(p => permissions.has(p));

    const isAdmin = user?.role?.name === 'Administrador';
    const roleName = user?.role?.name ?? 'Sin rol';

    return {
        permissions,
        hasPermission,
        hasAny,
        hasAll,
        isAdmin,
        roleName,
    };
}
