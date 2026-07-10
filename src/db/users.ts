import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name: string) {
  try {
    // 1. First attempt to fetch the user
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      return existing[0];
    }

    // 2. If user doesn't exist, insert with dynamic registration
    // The first user registered can be an 'admin' to facilitate setup, otherwise default to 'patient' or 'doctor' if specified
    const allUsers = await db.select({ id: users.id }).from(users).limit(1);
    const initialRole = allUsers.length === 0 ? 'admin' : 'doctor'; // First user is Admin, others default to doctor for testing/demo SaaS

    const result = await db.insert(users)
      .values({
        uid,
        email,
        name,
        role: initialRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Error in getOrCreateUser database query:", error);
    throw new Error("Database query failed during user profile synchronization.", { cause: error });
  }
}
