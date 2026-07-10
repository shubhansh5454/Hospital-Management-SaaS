import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';

export interface AccessTokenPayload {
  id: number;
  role: string;
  email: string;
}

export interface RefreshTokenPayload {
  id: number;
}

export const generateAccessToken = (userId: number, role: string, email: string): string => {
  return jwt.sign(
    { id: userId, role, email },
    env.JWT_SECRET,
    { expiresIn: '1h' } // 1 hour access token
  );
};

export const generateRefreshToken = (userId: number): string => {
  return jwt.sign(
    { id: userId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7 days refresh token
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};
