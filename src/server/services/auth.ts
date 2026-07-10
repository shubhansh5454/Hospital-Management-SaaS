import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.ts';
import { RegisterInput, LoginInput } from '../validation/auth.ts';

export class AuthService {
  /**
   * Register a new user
   */
  public static async register(input: RegisterInput) {
    const { email, password, name, role } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a local uid compatible with any other features
    const localUid = `local_${crypto.randomUUID()}`;

    // Create user in the database
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role,
        uid: localUid,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to the database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Omit password from output
    const { password: _, refreshToken: __, ...userResponse } = user;

    return {
      user: userResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login an existing user
   */
  public static async login(input: LoginInput) {
    const { email, password } = input;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.password) {
      throw new AppError('Invalid email or password', 401);
    }

    // Compare password hashes
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to the database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Omit password from output
    const { password: _, refreshToken: __, ...userResponse } = user;

    return {
      user: userResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access tokens using a valid refresh token
   */
  public static async refresh(token: string) {
    try {
      // 1. Verify the refresh token
      const decoded = verifyRefreshToken(token);

      // 2. Find user in database and verify the refresh token matches
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.refreshToken !== token) {
        throw new AppError('Invalid refresh token', 401);
      }

      // 3. Generate new tokens
      const newAccessToken = generateAccessToken(user.id, user.role, user.email);
      const newRefreshToken = generateRefreshToken(user.id);

      // 4. Update refresh token in database
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  /**
   * Log out a user by revoking their refresh token
   */
  public static async logout(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { success: true };
  }
}
