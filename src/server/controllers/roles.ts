import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { RolesService } from '../services/roles.ts';

export class RolesController {
  /**
   * Get all registered dynamic permissions
   */
  public static async getPermissions(req: AuthRequest, res: Response) {
    try {
      const permissions = await RolesService.getPermissions();
      res.json(permissions);
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ error: error.message || 'Internal server error fetching permissions' });
    }
  }

  /**
   * Get all clinic roles
   */
  public static async getRoles(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.role === 'superadmin' && req.query.clinicId 
        ? parseInt(req.query.clinicId as string, 10)
        : user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID is required' });
      }

      const roles = await RolesService.getRoles(clinicId);
      res.json(roles);
    } catch (error: any) {
      console.error('Error fetching clinic roles:', error);
      res.status(500).json({ error: error.message || 'Internal server error fetching roles' });
    }
  }

  /**
   * Create custom role
   */
  public static async createRole(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required to create a custom role.' });
      }

      const { name, description, permissionIds } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Role name is required.' });
      }

      const role = await RolesService.createRole(clinicId, name, description, permissionIds || []);
      
      // Log audit
      await RolesService.logAudit(
        user.id,
        clinicId,
        'CREATE_ROLE',
        'custom_role',
        { roleId: role?.id, name, permissionsCount: permissionIds?.length },
        req.ip
      );

      res.status(201).json(role);
    } catch (error: any) {
      console.error('Error creating custom role:', error);
      res.status(400).json({ error: error.message || 'Failed to create role.' });
    }
  }

  /**
   * Update custom role
   */
  public static async updateRole(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const roleId = parseInt(req.params.id, 10);
      const { name, description, permissionIds } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
      }

      const role = await RolesService.updateRole(roleId, name, description, permissionIds || [], clinicId);

      // Log audit
      await RolesService.logAudit(
        user.id,
        clinicId,
        'UPDATE_ROLE',
        'custom_role',
        { roleId, name, permissionsCount: permissionIds?.length },
        req.ip
      );

      res.json(role);
    } catch (error: any) {
      console.error('Error updating role:', error);
      res.status(400).json({ error: error.message || 'Failed to update role.' });
    }
  }

  /**
   * Delete custom role
   */
  public static async deleteRole(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const roleId = parseInt(req.params.id, 10);
      await RolesService.deleteRole(roleId, clinicId);

      // Log audit
      await RolesService.logAudit(
        user.id,
        clinicId,
        'DELETE_ROLE',
        'custom_role',
        { roleId },
        req.ip
      );

      res.json({ success: true, message: 'Role deleted successfully.' });
    } catch (error: any) {
      console.error('Error deleting role:', error);
      res.status(400).json({ error: error.message || 'Failed to delete role.' });
    }
  }

  /**
   * Get clinic users with role and permission mappings
   */
  public static async getClinicUsers(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const users = await RolesService.getClinicUsers(clinicId);
      res.json(users);
    } catch (error: any) {
      console.error('Error getting clinic users:', error);
      res.status(500).json({ error: error.message || 'Failed to get users.' });
    }
  }

  /**
   * Assign role to user
   */
  public static async assignUserRole(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const targetUserId = parseInt(req.params.userId, 10);
      const { customRoleId } = req.body;

      const updatedUser = await RolesService.assignUserRole(targetUserId, customRoleId ? parseInt(customRoleId, 10) : null, clinicId);

      // Log audit
      await RolesService.logAudit(
        user.id,
        clinicId,
        'ASSIGN_USER_ROLE',
        'user',
        { targetUserId, customRoleId },
        req.ip
      );

      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error assigning role to user:', error);
      res.status(400).json({ error: error.message || 'Failed to assign role.' });
    }
  }

  /**
   * Get all active permissions for a specific user
   */
  public static async getUserPermissions(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const targetUserId = parseInt(req.params.userId, 10);
      const clinicId = user?.clinicId;

      const permissions = await RolesService.getUserPermissions(targetUserId, clinicId || null);
      res.json(permissions);
    } catch (error: any) {
      console.error('Error getting user permissions:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user permissions.' });
    }
  }

  /**
   * Save user permission overrides
   */
  public static async updateUserPermissions(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const targetUserId = parseInt(req.params.userId, 10);
      const { overrides } = req.body; // array of { permissionId: number, value: boolean }

      const updatedPermissions = await RolesService.updateUserPermissions(targetUserId, clinicId, overrides || []);

      // Log audit
      await RolesService.logAudit(
        user.id,
        clinicId,
        'UPDATE_USER_PERMISSIONS',
        'user',
        { targetUserId, overridesCount: overrides?.length },
        req.ip
      );

      res.json(updatedPermissions);
    } catch (error: any) {
      console.error('Error updating user permissions:', error);
      res.status(400).json({ error: error.message || 'Failed to update overrides.' });
    }
  }

  /**
   * Get audit logs for a clinic
   */
  public static async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      // Superadmins can inspect any clinic, clinic admins only their own
      const clinicId = user?.role === 'superadmin' && req.query.clinicId
        ? parseInt(req.query.clinicId as string, 10)
        : user?.clinicId;

      if (!clinicId && user?.role !== 'superadmin') {
        return res.status(400).json({ error: 'Clinic ID context required' });
      }

      const { userId, action, resource, startDate, endDate } = req.query;
      const filters = {
        userId: userId ? parseInt(userId as string, 10) : undefined,
        action: action ? String(action) : undefined,
        resource: resource ? String(resource) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      };

      const logs = await RolesService.getAuditLogs(clinicId || null, filters);
      res.json(logs);
    } catch (error: any) {
      console.error('Error getting audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs.' });
    }
  }
}
