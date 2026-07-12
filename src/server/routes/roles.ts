import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { RolesController } from '../controllers/roles.ts';

export const rolesRouter = Router();

// Get standard permissions list
rolesRouter.get('/permissions', requireAuth, requirePermission('manage_roles_permissions'), RolesController.getPermissions);

// Roles management
rolesRouter.get('/roles', requireAuth, RolesController.getRoles); // Standard login can fetch (e.g. for selection)
rolesRouter.post('/roles', requireAuth, requirePermission('manage_roles_permissions'), RolesController.createRole);
rolesRouter.put('/roles/:id', requireAuth, requirePermission('manage_roles_permissions'), RolesController.updateRole);
rolesRouter.delete('/roles/:id', requireAuth, requirePermission('manage_roles_permissions'), RolesController.deleteRole);

// User-role and user-permissions assignment
rolesRouter.get('/users', requireAuth, requirePermission('manage_roles_permissions'), RolesController.getClinicUsers);
rolesRouter.put('/users/:userId/role', requireAuth, requirePermission('manage_roles_permissions'), RolesController.assignUserRole);
rolesRouter.get('/users/:userId/permissions', requireAuth, requirePermission('manage_roles_permissions'), RolesController.getUserPermissions);
rolesRouter.put('/users/:userId/permissions', requireAuth, requirePermission('manage_roles_permissions'), RolesController.updateUserPermissions);

// Audit Logging
rolesRouter.get('/audit-logs', requireAuth, requirePermission('view_audit_logs'), RolesController.getAuditLogs);
