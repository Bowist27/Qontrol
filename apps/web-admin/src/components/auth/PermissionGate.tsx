/**
 * PermissionGate - Conditionally render children based on permissions.
 * 
 * Usage:
 *   <PermissionGate permission="web:users">
 *     <SecretStuff />
 *   </PermissionGate>
 * 
 *   <PermissionGate permissions={['web:audits', 'web:inventories']} requireAll={false}>
 *     <AnyOfThese />
 *   </PermissionGate>
 */

import type { ReactNode } from 'react';
import { usePermissions, type Permission } from '../hooks/usePermissions';

interface PermissionGateProps {
    /** Single permission check */
    permission?: Permission;
    /** Multiple permissions check */
    permissions?: Permission[];
    /** If true, ALL permissions required; if false, ANY is enough. Default: false */
    requireAll?: boolean;
    /** What to render if no access. Default: nothing */
    fallback?: ReactNode;
    children: ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
    permission,
    permissions,
    requireAll = false,
    fallback = null,
    children,
}) => {
    const { hasPermission, hasAny, hasAll } = usePermissions();

    let allowed = false;

    if (permission) {
        allowed = hasPermission(permission);
    } else if (permissions && permissions.length > 0) {
        allowed = requireAll ? hasAll(permissions) : hasAny(permissions);
    } else {
        allowed = true; // No permission specified = always visible
    }

    return allowed ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGate;
