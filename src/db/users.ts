import { UserRepository } from '../server/repositories/user.ts';

export async function getOrCreateUser(uid: string, email: string, name: string) {
  try {
    // 1. First attempt to fetch the user
    const existing = await UserRepository.findByUid(uid);
    if (existing) {
      return existing;
    }

    // 2. If user doesn't exist, insert with dynamic registration
    // The first user registered can be an 'admin' to facilitate setup, otherwise default to 'doctor' if specified
    const firstUser = await UserRepository.findFirst();
    const initialRole = firstUser ? 'doctor' : 'admin';

    const newUser = await UserRepository.create({
      uid,
      email: email.toLowerCase(),
      name,
      role: initialRole,
    });

    return newUser;
  } catch (error) {
    console.error("Error in getOrCreateUser database query:", error);
    throw new Error("Database query failed during user profile synchronization.", { cause: error });
  }
}

