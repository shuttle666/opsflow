import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://opsflow:opsflow@localhost:5432/opsflow"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default("dev-access-secret-change-me"),
  JWT_ACCESS_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_SESSION_LIMIT: z.coerce.number().int().positive().default(5),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  INVITATION_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten());
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
