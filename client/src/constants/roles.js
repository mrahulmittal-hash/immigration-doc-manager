export const ROLES = {
    ADMIN: 'Admin',
    CASE_MANAGER: 'Case Manager',
    RCIC_CONSULTANT: 'RCIC Consultant',
    VIEWER: 'Viewer',
};

export const ROLE_PERMISSIONS = {
    'Admin': {
        routes: ['/', '/clients', '/pipeline', '/tasks', '/calendar', '/retainers', '/users', '/ircc-updates', '/ircc-templates', '/settings/email'],
        canVerifyPIF: true,
        canGenerateForms: true,
        canManageUsers: true,
        canEditClients: true,
        canViewAudit: true,
    },
    'Case Manager': {
        routes: ['/', '/clients', '/pipeline', '/tasks', '/calendar', '/ircc-updates', '/ircc-templates'],
        canVerifyPIF: true,
        canGenerateForms: false,
        canManageUsers: false,
        canEditClients: true,
        canViewAudit: true,
    },
    'RCIC Consultant': {
        routes: ['/', '/clients', '/pipeline', '/tasks', '/calendar', '/ircc-updates', '/ircc-templates'],
        canVerifyPIF: false,
        canGenerateForms: true,
        canManageUsers: false,
        canEditClients: false,
        canViewAudit: true,
    },
    'Viewer': {
        routes: ['/', '/clients', '/pipeline'],
        canVerifyPIF: false,
        canGenerateForms: false,
        canManageUsers: false,
        canEditClients: false,
        canViewAudit: false,
    },
};

export function hasPermission(role, permission) {
    return ROLE_PERMISSIONS[role]?.[permission] || false;
}

export function canAccessRoute(role, path) {
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;
    return permissions.routes.some(r => path === r || (r !== '/' && path.startsWith(r)));
}
