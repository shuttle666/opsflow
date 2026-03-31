import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const defaultJwtAccessSecret = "dev-access-secret-change-me";

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
    .trim()
    .min(16)
    .default(defaultJwtAccessSecret),
  JWT_ACCESS_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_SESSION_LIMIT: z.coerce.number().int().positive().default(5),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  INVITATION_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  EVIDENCE_DIR: z.string().min(1).default("./uploads/evidence"),
  EVIDENCE_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  ANTHROPIC_API_KEY: z.string().default(""),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  const parsedEnv = envSchema.safeParse(source);

  if (!parsedEnv.success) {
    console.error("Invalid environment variables", parsedEnv.error.flatten());
    throw new Error("Invalid environment variables");
  }

  const env = parsedEnv.data;

  if (
    env.NODE_ENV === "production" &&
    env.JWT_ACCESS_SECRET.trim() === defaultJwtAccessSecret
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET must be explicitly configured in production.",
    );
  }

  return env;
}

export const env = parseEnv(process.env);
