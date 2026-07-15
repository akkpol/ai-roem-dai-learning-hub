import { z } from "zod";

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function readRuntimeEnv(input: Record<string, string | undefined>): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}
