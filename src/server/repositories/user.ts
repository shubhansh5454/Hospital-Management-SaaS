import { prisma } from '../../db/prisma.ts';
import { Prisma } from '@prisma/client';

export class UserRepository {
  /**
   * Find a user by email (case-insensitive)
   */
  public static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find a user by id
   */
  public static async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by uid (e.g. Firebase UID or custom local uid)
   */
  public static async findByUid(uid: string) {
    return prisma.user.findUnique({
      where: { uid },
    });
  }

  /**
   * Find any first user (used during setup/initialization check)
   */
  public static async findFirst() {
    return prisma.user.findFirst();
  }

  /**
   * Create a new user
   */
  public static async create(data: Prisma.UserCreateInput) {
    if (data.email) {
      data.email = data.email.toLowerCase();
    }
    return prisma.user.create({
      data,
    });
  }

  /**
   * Update a user's refresh token
   */
  public static async updateRefreshToken(id: number, refreshToken: string | null) {
    return prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  }

  /**
   * Update a user's role
   */
  public static async updateRole(id: number, role: 'superadmin' | 'admin' | 'doctor' | 'receptionist' | 'patient') {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }
}
