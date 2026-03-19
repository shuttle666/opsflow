import bcrypt from "bcryptjs";
import { env } from "../../config/env";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

