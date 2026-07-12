import { prisma } from '../../db/prisma.ts';

export interface AuditLogFilters {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  device?: string;
  browser?: string;
}

export const STANDARD_PERMISSIONS = [
  // Appointments
  { code: 'view_appointments', name: 'View Appointments', group: 'Appointments', description: 'Allows viewing of all appointments in the clinic' },
  { code: 'create_appointments', name: 'Create Appointments', group: 'Appointments', description: 'Allows scheduling new appointments' },
  { code: 'edit_appointments', name: 'Edit Appointments', group: 'Appointments', description: 'Allows rescheduling or updating appointment status' },
  { code: 'delete_appointments', name: 'Cancel/Delete Appointments', group: 'Appointments', description: 'Allows cancelling or deleting scheduled appointments' },

  // Patients
  { code: 'view_patients', name: 'View Patients', group: 'Patients', description: 'Allows viewing of patient profiles and listings' },
  { code: 'create_patients', name: 'Create Patients', group: 'Patients', description: 'Allows registering new patients' },
  { code: 'edit_patients', name: 'Edit Patients', group: 'Patients', description: 'Allows editing patient demographic information' },
  { code: 'delete_patients', name: 'Delete Patients', group: 'Patients', description: 'Allows deleting patient profiles from the database' },

  // EMR Records
  { code: 'view_emr', name: 'View EMR Records', group: 'EMR Records', description: 'Allows viewing patient Electronic Medical Records and history' },
  { code: 'create_emr', name: 'Create EMR Records', group: 'EMR Records', description: 'Allows adding new medical checkups, diagnosis, or prescriptions' },
  { code: 'edit_emr', name: 'Edit EMR Records', group: 'EMR Records', description: 'Allows editing existing medical history entries' },
  { code: 'delete_emr', name: 'Delete EMR Records', group: 'EMR Records', description: 'Allows deleting sensitive patient EMR records' },

  // Billing
  { code: 'view_billing', name: 'View Billing Details', group: 'Billing', description: 'Allows viewing invoices and financial logs' },
  { code: 'manage_billing', name: 'Manage Billing', group: 'Billing', description: 'Allows generating, printing, editing, and deleting invoices' },

  // Pharmacy
  { code: 'view_pharmacy', name: 'View Pharmacy', group: 'Pharmacy', description: 'Allows viewing pharmacy inventory and sales' },
  { code: 'manage_pharmacy', name: 'Manage Pharmacy', group: 'Pharmacy', description: 'Allows adding medicines, modifying stock, and recording sales' },

  // Laboratory
  { code: 'view_lab', name: 'View Laboratory', group: 'Laboratory', description: 'Allows viewing lab orders and diagnostics' },
  { code: 'manage_lab', name: 'Manage Laboratory', group: 'Laboratory', description: 'Allows creating lab test orders, booking slots, and uploading results' },

  // Inventory
  { code: 'view_inventory', name: 'View Inventory', group: 'Inventory', description: 'Allows viewing clinical equipment and products' },
  { code: 'manage_inventory', name: 'Manage Inventory', group: 'Inventory', description: 'Allows adding products, updating stock counts, and recording movements' },

  // Clinic Settings / Management
  { code: 'manage_clinic_settings', name: 'Manage Clinic Settings', group: 'Clinic Administration', description: 'Allows updating clinic profile, services, and plans' },
  { code: 'manage_roles_permissions', name: 'Manage Roles & Permissions', group: 'Clinic Administration', description: 'Allows creating custom clinic roles, editing permission matrix, and overriding user permissions' },
  { code: 'view_audit_logs', name: 'View Audit Logs', group: 'Clinic Administration', description: 'Allows viewing security and action logs for the clinic' },
];

export class RolesService {
  /**
   * Automatically seed standard permissions if they do not exist
   */
  public static async seedPermissions() {
    for (const p of STANDARD_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, group: p.group, description: p.description },
        create: p,
      });
    }
  }

  /**
   * Get all registered system permissions
   */
  public static async getPermissions() {
    await this.seedPermissions(); // ensure permissions are always synced
    return prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get all roles for a clinic (including standard system-defined templates if needed)
   */
  public static async getRoles(clinicId: number) {
    // Return custom roles for this clinic
    const customRoles = await prisma.customRole.findMany({
      where: {
        OR: [
          { clinicId: clinicId },
          { isSystem: true }
        ]
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return customRoles;
  }

  /**
   * Create a new custom role for a clinic with a list of permission IDs
   */
  public static async createRole(clinicId: number, name: string, description: string | null, permissionIds: number[]) {
    // Check if role name already exists in this clinic
    const existing = await prisma.customRole.findFirst({
      where: { name, clinicId },
    });
    if (existing) {
      throw new Error(`Role name "${name}" already exists in this clinic.`);
    }

    const role = await prisma.customRole.create({
      data: {
        name,
        description,
        clinicId,
        isSystem: false,
      },
    });

    // Create role permission mappings
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(pId => ({
          roleId: role.id,
          permissionId: pId,
        })),
      });
    }

    return this.getRoleById(role.id);
  }

  /**
   * Get a single role by ID
   */
  public static async getRoleById(roleId: number) {
    return prisma.customRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * Update an existing custom role details and permission mappings
   */
  public static async updateRole(roleId: number, name: string, description: string | null, permissionIds: number[], clinicId: number) {
    const role = await prisma.customRole.findUnique({
      where: { id: roleId },
    });

    if (!role || (role.clinicId !== clinicId && !role.isSystem)) {
      throw new Error('Role not found or you do not have permission to update it.');
    }

    if (role.isSystem) {
      throw new Error('System roles cannot be modified.');
    }

    // Check if the new name clashes with another role
    const duplicate = await prisma.customRole.findFirst({
      where: {
        name,
        clinicId,
        id: { not: roleId },
      },
    });
    if (duplicate) {
      throw new Error(`Another role named "${name}" already exists.`);
    }

    // Update basic info
    await prisma.customRole.update({
      where: { id: roleId },
      data: { name, description },
    });

    // Sync permissions: delete old, create new
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(pId => ({
          roleId,
          permissionId: pId,
        })),
      });
    }

    return this.getRoleById(roleId);
  }

  /**
   * Delete a custom role
   */
  public static async deleteRole(roleId: number, clinicId: number) {
    const role = await prisma.customRole.findUnique({
      where: { id: roleId },
    });

    if (!role || role.clinicId !== clinicId) {
      throw new Error('Role not found or you do not have permission to delete it.');
    }

    if (role.isSystem) {
      throw new Error('System roles cannot be deleted.');
    }

    // Custom roles deletion cascades to role_permissions and sets null custom_role_id in users
    await prisma.customRole.delete({
      where: { id: roleId },
    });

    return { success: true };
  }

  /**
   * Get users list of a clinic with their current role mappings
   */
  public static async getClinicUsers(clinicId: number) {
    return prisma.user.findMany({
      where: { clinicId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
          }
        },
        userPermissions: {
          include: {
            permission: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Assign a custom role to a user
   */
  public static async assignUserRole(userId: number, customRoleId: number | null, clinicId: number) {
    const user = await prisma.user.findFirst({
      where: { id: userId, clinicId },
    });

    if (!user) {
      throw new Error('User not found in this clinic.');
    }

    if (customRoleId) {
      const role = await prisma.customRole.findUnique({
        where: { id: customRoleId },
      });
      if (!role || (role.clinicId !== clinicId && !role.isSystem)) {
        throw new Error('Selected role does not exist or belongs to another clinic.');
      }
    }

    // Update user's customRoleId
    await prisma.user.update({
      where: { id: userId },
      data: { customRoleId },
    });

    return prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });
  }

  /**
   * Get all active permissions for a user (Role Permissions + Overrides)
   */
  public static async getUserPermissions(userId: number, clinicId: number | null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) return [];

    // If superadmin, they have ALL permissions
    if (user.role === 'superadmin') {
      const allPerms = await this.getPermissions();
      return allPerms.map(p => ({
        code: p.code,
        name: p.name,
        group: p.group,
        allowed: true,
        source: 'Superadmin Privilege',
      }));
    }

    // Map standard roles to default permissions if no custom role is assigned
    let basePermissions: string[] = [];
    if (!user.customRoleId) {
      if (user.role === 'admin') {
        // Admin has almost all clinic level permissions
        basePermissions = STANDARD_PERMISSIONS.map(p => p.code);
      } else if (user.role === 'doctor') {
        basePermissions = [
          'view_appointments', 'create_appointments', 'edit_appointments',
          'view_patients', 'create_patients', 'edit_patients',
          'view_emr', 'create_emr', 'edit_emr',
          'view_pharmacy', 'view_lab', 'manage_lab', 'view_inventory'
        ];
      } else if (user.role === 'receptionist') {
        basePermissions = [
          'view_appointments', 'create_appointments', 'edit_appointments', 'delete_appointments',
          'view_patients', 'create_patients', 'edit_patients',
          'view_billing', 'manage_billing', 'view_pharmacy', 'view_lab'
        ];
      } else if (user.role === 'patient') {
        basePermissions = [
          'view_appointments', 'create_appointments',
          'view_patients', 'view_emr', 'view_billing'
        ];
      }
    } else if (user.customRole) {
      // Load from the assigned custom role
      basePermissions = user.customRole.permissions.map(rp => rp.permission.code);
    }

    const allPerms = await this.getPermissions();
    const permissionMap = new Map<string, { code: string; name: string; group: string; allowed: boolean; source: string }>();

    // Initialize with false, or true if in basePermissions
    for (const p of allPerms) {
      const isBase = basePermissions.includes(p.code);
      permissionMap.set(p.code, {
        code: p.code,
        name: p.name,
        group: p.group,
        allowed: isBase,
        source: isBase ? (user.customRoleId ? `Custom Role: ${user.customRole?.name}` : `Default ${user.role} Role`) : 'Not Assigned',
      });
    }

    // Apply specific user overrides (UserPermission model)
    for (const op of user.userPermissions) {
      permissionMap.set(op.permission.code, {
        code: op.permission.code,
        name: op.permission.name,
        group: op.permission.group,
        allowed: op.value, // value is true/false (grant/deny)
        source: op.value ? 'User-Specific Override (Grant)' : 'User-Specific Override (Deny)',
      });
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Save user permission overrides (direct grants or denials)
   */
  public static async updateUserPermissions(userId: number, clinicId: number, overrides: { permissionId: number, value: boolean }[]) {
    const user = await prisma.user.findFirst({
      where: { id: userId, clinicId },
    });

    if (!user) {
      throw new Error('User not found in this clinic.');
    }

    // Clear old overrides
    await prisma.userPermission.deleteMany({
      where: { userId },
    });

    // Create new overrides
    if (overrides.length > 0) {
      await prisma.userPermission.createMany({
        data: overrides.map(o => ({
          userId,
          permissionId: o.permissionId,
          value: o.value,
        })),
      });
    }

    return this.getUserPermissions(userId, clinicId);
  }

  /**
   * Enterprise Audit Logging
   */
  public static async logAudit(
    userId: number | null,
    clinicId: number | null,
    action: string,
    resource: string,
    details: string | object,
    ipAddress?: string,
    device?: string,
    browser?: string
  ) {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
    
    return prisma.auditLog.create({
      data: {
        userId,
        clinicId,
        action,
        resource,
        details: detailsStr,
        ipAddress,
        device: device || null,
        browser: browser || null,
      },
    });
  }

  /**
   * Extract browser and device from User-Agent and log audit event in one go
   */
  public static async logRequest(
    req: any,
    action: string,
    resource: string,
    details: string | object,
    userIdOverride?: number,
    clinicIdOverride?: number
  ) {
    const userId = userIdOverride || req.user?.id || null;
    const clinicId = clinicIdOverride || req.user?.clinicId || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';
    
    // User-Agent Parsing
    let browser = 'Unknown Browser';
    let device = 'Desktop';
    const uaLower = ua.toLowerCase();
    
    if (uaLower.includes('firefox')) {
      browser = 'Firefox';
    } else if (uaLower.includes('opr') || uaLower.includes('opera')) {
      browser = 'Opera';
    } else if (uaLower.includes('edg')) {
      browser = 'Edge';
    } else if (uaLower.includes('chrome')) {
      browser = 'Chrome';
    } else if (uaLower.includes('safari')) {
      browser = 'Safari';
    } else if (uaLower.includes('msie') || uaLower.includes('trident')) {
      browser = 'Internet Explorer';
    }
    
    if (uaLower.includes('ipad')) {
      device = 'Tablet (iPad)';
    } else if (uaLower.includes('iphone')) {
      device = 'Mobile (iPhone)';
    } else if (uaLower.includes('android')) {
      if (uaLower.includes('mobile')) {
        device = 'Mobile (Android)';
      } else {
        device = 'Tablet (Android)';
      }
    } else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) {
      device = 'Mac Desktop';
    } else if (uaLower.includes('windows')) {
      device = 'Windows Desktop';
    } else if (uaLower.includes('linux')) {
      device = 'Linux Desktop';
    }

    return this.logAudit(userId, clinicId, action, resource, details, ip, device, browser);
  }

  /**
   * Retrieve audit logs with filtering
   */
  public static async getAuditLogs(clinicId: number | null, filters: AuditLogFilters = {}) {
    const whereClause: any = {};
    
    // Enforce isolation
    if (clinicId) {
      whereClause.clinicId = clinicId;
    }

    if (filters.userId) {
      whereClause.userId = filters.userId;
    }

    if (filters.action) {
      whereClause.action = filters.action;
    }

    if (filters.resource) {
      whereClause.resource = filters.resource;
    }

    if (filters.device) {
      whereClause.device = filters.device;
    }

    if (filters.browser) {
      whereClause.browser = filters.browser;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = new Date(filters.endDate);
      }
    }

    return prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // limit to latest 200 logs
    });
  }
}
