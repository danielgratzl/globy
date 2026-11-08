import { join, resolve } from 'node:path';
import { z } from 'zod';
import { serverRoot } from './lib/paths';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('./data'),
  WEB_DIR: z.string().optional(),
  MIGRATIONS_DIR: z.string().optional(),
});

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  dbFile: string;
  webDir: string;
  migrationsDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  const root = serverRoot();
  const dataDir = resolve(e.DATA_DIR);
  return {
    port: e.PORT,
    host: e.HOST,
    dataDir,
    dbFile: join(dataDir, 'globy.db'),
    webDir: resolve(e.WEB_DIR ?? join(root, 'public')),
    migrationsDir: resolve(e.MIGRATIONS_DIR ?? join(root, 'drizzle')),
  };
}
