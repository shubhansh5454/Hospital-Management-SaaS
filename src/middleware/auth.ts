import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'doctor' | 'receptionist' | 'patient';
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Sync with PostgreSQL
    const email = decodedToken.email || '';
    const name = decodedToken.name || email.split('@')[0] || 'User';
    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

    req.user = {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as 'admin' | 'doctor' | 'receptionist' | 'patient',
    };

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token or syncing user:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token or user profile out of sync' });
  }
};

// Role authorization checks
export const requireRoles = (allowedRoles: ('admin' | 'doctor' | 'receptionist' | 'patient')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User identity not verified' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Access restricted to roles: [${allowedRoles.join(', ')}]` });
    }
    
    next();
  };
};
