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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten());
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
