import { prisma } from './prisma.ts';

export async function getOrCreateUser(uid: string, email: string, name: string) {
  try {
    // 1. First attempt to fetch the user
    const existing = await prisma.user.findUnique({
      where: { uid }
    });
    if (existing) {
      return existing;
    }

    // 2. If user doesn't exist, insert with dynamic registration
    // The first user registered can be an 'admin' to facilitate setup, otherwise default to 'doctor' if specified
    const firstUser = await prisma.user.findFirst();
    const initialRole = firstUser ? 'doctor' : 'admin';

    const newUser = await prisma.user.create({
      data: {
        uid,
        email,
        name,
        role: initialRole,
      }
    });

    return newUser;
  } catch (error) {
    console.error("Error in getOrCreateUser database query:", error);
    throw new Error("Database query failed during user profile synchronization.", { cause: error });
  }
}

