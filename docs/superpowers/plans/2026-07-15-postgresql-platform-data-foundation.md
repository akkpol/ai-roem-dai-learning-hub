# SESSION-002 PostgreSQL and Platform Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างฐาน PostgreSQL ที่แยกสิทธิ์ application/migration, ใช้ Drizzle migration ที่ review ได้, มี transaction และ transactional domain-event outbox, readiness endpoint และ integration tests บน PostgreSQL จริง โดยยังไม่เพิ่ม authentication

**Architecture:** `src/platform/database` เป็นเจ้าของ runtime connection, transaction และ readiness; `src/platform/events` เป็นเจ้าของ domain-event outbox. Migration รันจาก operator script ด้วย `MIGRATION_DATABASE_URL` เท่านั้น และ runtime/build ห้าม import migrator.

**Tech Stack:** Node.js 24.18.0, Next.js 16.2.10, TypeScript 5.9.3, Neon PostgreSQL 18, Drizzle ORM 0.45.2, Drizzle Kit 0.31.10, node-postgres 8.22.0, Vitest 4.1.0, Vercel Preview

## Global Constraints

- ทำเฉพาะ SESSION-002; ห้ามเพิ่ม Better Auth, account, profile, email, auth UI, role หรือ permission
- ใช้ PostgreSQL แบบ provider-neutral; primary key ใหม่เป็น UUID; timestamp เป็น timezone-aware UTC
- `DATABASE_URL` เป็น application credential ที่แก้ schema ไม่ได้
- `MIGRATION_DATABASE_URL` เป็น operator credential แยกและห้ามถูกอ่านจาก `src/**`
- Application startup, build และ start ห้าม auto-migrate
- Build และ unit tests ต้องผ่านโดยไม่มี database secret
- Readiness ต้องตอบ `503` เมื่อ config/database ใช้ไม่ได้และห้ามเปิดเผย secret/schema
- Migration อยู่ใน `drizzle/`, commit เข้า Git และผ่าน empty-database test
- Dependency pin exact; ไม่มี demo mode, fake success หรือ provider fallback
- ใช้ isolated worktree/branch `codex/session-002-postgresql-foundation`; ห้ามทำบน `main`
- ห้ามเริ่ม SESSION-003 หรือเปลี่ยน WP-01 เป็น `verified`
- Provider acceptance ใช้ Neon project `ai-roem-dai-learning-hub` บน branch ชั่วคราว และ Vercel project ชื่อเดียวกันบน Preview deployment; ห้ามทดสอบ destructive flow บน Neon default branch หรือ Vercel Production

## Approved test environments

- Neon project: `ai-roem-dai-learning-hub`, PostgreSQL 18, region `aws-ap-southeast-1`
- ทุก execution สร้าง Neon branch ชั่วคราว `session-002-<short-sha>` และ database `learning_hub_session_002_test`
- ใช้ direct connection สำหรับ migration และ pooled connection สำหรับ application/readiness
- หลัง Lead เก็บหลักฐานครบให้ลบ Neon branch ชั่วคราว; ห้ามพิมพ์ connection string ลง log, handoff หรือ PR
- Vercel project: `ai-roem-dai-learning-hub` ในทีม `AK3Lab`; ใช้ Preview deployment ของ PR เท่านั้น
- Vercel Preview ต้อง build โดยไม่มี `MIGRATION_DATABASE_URL`; runtime รับเฉพาะ pooled `DATABASE_URL`

## File Map

| Path | Responsibility |
|---|---|
| `drizzle.config.ts` / `drizzle/**` | credential-free generation และ reviewed SQL |
| `compose.yaml` / `infra/postgres/local-init.sql` | PostgreSQL และ local/CI roles |
| `src/platform/database/**` | config, pool, transaction, schema export, readiness |
| `src/platform/events/**` | outbox types, schema และ transactional operations |
| `scripts/database/**` | migration credential และ operator runner |
| `tests/integration/database/**` | empty migration, role, rollback และ dedupe tests |
| `src/app/api/health/ready/route.ts` | minimal public readiness |

---

### Task 1: Pin the toolchain and forbid runtime migrations

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/check-architecture.mjs`, `tests/architecture/check-architecture.test.ts`; create `vitest.integration.config.ts`, `drizzle.config.ts`

**Interfaces:** Produces scripts `db:generate`, `db:migrate`, `test:integration` and forbids migration credential/runner under `src/**`.

- [ ] **Step 1: Add failing architecture tests**

~~~ts
it("rejects migration credentials in runtime source", () => {
  const root = fixture();
  write(root, "src/platform/database/client.ts", "void process.env.MIGRATION_DATABASE_URL;");
  expect(checkArchitecture(root)[0]).toMatch(/Migration credential is forbidden/);
});

it("rejects migration runners in runtime source", () => {
  const root = fixture();
  write(root, "src/platform/database/client.ts",
    'import { migrate } from "drizzle-orm/node-postgres/migrator"; void migrate;');
  expect(checkArchitecture(root)[0]).toMatch(/Migration runner is forbidden/);
});
~~~

Run: `npm test -- tests/architecture/check-architecture.test.ts`  
Expected: FAIL because the checker does not report the new violations.

- [ ] **Step 2: Implement the architecture rules**

Add after reading each runtime source file:

~~~js
if (source.includes("MIGRATION_DATABASE_URL")) {
  violations.push(`Migration credential is forbidden in runtime source: ${relative}`);
}
if (/drizzle-orm\/[^"']+\/migrator/.test(source)) {
  violations.push(`Migration runner is forbidden in runtime source: ${relative}`);
}
~~~

- [ ] **Step 3: Install exact packages and scripts**

~~~powershell
npm install --save-exact drizzle-orm@0.45.2 pg@8.22.0
npm install --save-dev --save-exact @types/pg@8.20.0 drizzle-kit@0.31.10 tsx@4.23.1
~~~

Add to `package.json`:

~~~json
"db:generate": "drizzle-kit generate --config=drizzle.config.ts",
"db:migrate": "tsx scripts/database/migrate.ts",
"test:integration": "vitest run --config vitest.integration.config.ts"
~~~

Add `"scripts/**/*.ts"` to `tsconfig.json` include. Replace `vitest.config.ts`:

~~~ts
import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "tests/integration/**"],
  },
});
~~~

Create `vitest.integration.config.ts`:

~~~ts
import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    globalSetup: ["tests/integration/database/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
~~~

Create credential-free `drizzle.config.ts`:

~~~ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/platform/database/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
~~~

- [ ] **Step 4: Verify and commit**

Run `npm test -- tests/architecture/check-architecture.test.ts`, `npm run typecheck`, `npm run architecture`. Expected: all exit 0 and architecture has 5 tests.

~~~powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts vitest.integration.config.ts drizzle.config.ts scripts/check-architecture.mjs tests/architecture/check-architecture.test.ts
git commit -m "build: add postgres migration toolchain"
~~~

### Task 2: Define database roles and migration-only config

**Files:** Create `compose.yaml`, `infra/postgres/local-init.sql`, `scripts/database/migration-env.ts`, `tests/platform/migration-env.test.ts`; modify `.env.example`

**Interfaces:** Produces group role `learning_hub_app`, local login `learning_hub_app_local` and `readMigrationDatabaseUrl(input)`.

- [ ] **Step 1: Write the failing migration config test**

~~~ts
import { describe, expect, it } from "vitest";
import { readMigrationDatabaseUrl } from "../../scripts/database/migration-env";
describe("readMigrationDatabaseUrl", () => {
  it("accepts a separate postgres migration URL", () => {
    expect(readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: "postgresql://migrator:secret@localhost/learning_hub_test",
    })).toContain("migrator");
  });
  it("rejects missing or shared credentials", () => {
    expect(() => readMigrationDatabaseUrl({})).toThrow();
    const url = "postgresql://same:secret@localhost/learning_hub_test";
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL: url, MIGRATION_DATABASE_URL: url,
    })).toThrow(/must be separate/);
  });
});
~~~

Run `npm test -- tests/platform/migration-env.test.ts`. Expected: FAIL because the module is missing.

- [ ] **Step 2: Implement migration validation**

~~~ts
import { z } from "zod";
const postgresUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "Expected a PostgreSQL URL");
export function readMigrationDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  const migrationUrl = postgresUrl.parse(input.MIGRATION_DATABASE_URL);
  if (input.DATABASE_URL === migrationUrl) {
    throw new Error("MIGRATION_DATABASE_URL must be separate from DATABASE_URL");
  }
  return migrationUrl;
}
~~~

- [ ] **Step 3: Create role bootstrap and local service**

`infra/postgres/local-init.sql`:

~~~sql
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learning_hub_app') THEN
    EXECUTE 'CREATE ROLE learning_hub_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learning_hub_app_local') THEN
    EXECUTE 'CREATE ROLE learning_hub_app_local LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION';
  END IF;
END
$$;
ALTER ROLE learning_hub_app_local PASSWORD 'local_app_password';
GRANT learning_hub_app TO learning_hub_app_local;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
~~~

`compose.yaml`:

~~~yaml
services:
  postgres:
    image: postgres:18.4-alpine3.24
    environment:
      POSTGRES_DB: learning_hub_test
      POSTGRES_USER: learning_hub_migrator
      POSTGRES_PASSWORD: local_migration_password
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U learning_hub_migrator -d learning_hub_test"]
      interval: 2s
      timeout: 3s
      retries: 20
    volumes:
      - learning_hub_postgres:/var/lib/postgresql/data
      - ./infra/postgres/local-init.sql:/docker-entrypoint-initdb.d/010-local-roles.sql:ro
volumes:
  learning_hub_postgres:
~~~

Replace `.env.example`:

~~~dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://learning_hub_app_local:local_app_password@127.0.0.1:5432/learning_hub_test
MIGRATION_DATABASE_URL=postgresql://learning_hub_migrator:local_migration_password@127.0.0.1:5432/learning_hub_test
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_QUERY_TIMEOUT_MS=10000
~~~

- [ ] **Step 4: Verify and commit**

Run `npm test -- tests/platform/migration-env.test.ts`. Expected: 2 tests pass. Docker เป็นทางเลือกสำหรับ local development; acceptance หลักใช้ Neon branch ชั่วคราวและ GitHub CI PostgreSQL.

~~~powershell
git add compose.yaml infra/postgres/local-init.sql scripts/database/migration-env.ts tests/platform/migration-env.test.ts .env.example
git commit -m "chore: define postgres role contract"
~~~

### Task 3: Implement runtime config, pool and transaction boundary

**Files:** Create `src/platform/database/config.ts`, `client.ts`, `transaction.ts`, `schema.ts`, `tests/platform/database-config.test.ts`

**Interfaces:** Produces `readDatabaseConfig`, `createDatabaseConnection`, `getRuntimeDatabaseConnection`, `withTransaction`.

- [ ] **Step 1: Write RED config tests**

~~~ts
import { describe, expect, it } from "vitest";
import { readDatabaseConfig } from "@/platform/database/config";
describe("readDatabaseConfig", () => {
  it("parses postgres and bounded settings", () => {
    expect(readDatabaseConfig({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      DATABASE_POOL_MAX: "12",
    })).toMatchObject({ poolMax: 12, connectionTimeoutMs: 5000 });
  });
  it("rejects wrong protocol and unsafe pool size", () => {
    expect(() => readDatabaseConfig({ DATABASE_URL: "https://example.com" })).toThrow();
    expect(() => readDatabaseConfig({
      DATABASE_URL: "postgresql://app:secret@localhost/db",
      DATABASE_POOL_MAX: "101",
    })).toThrow();
  });
});
~~~

Run `npm test -- tests/platform/database-config.test.ts`. Expected: FAIL because the module is missing.

- [ ] **Step 2: Implement config**

~~~ts
import { z } from "zod";
const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);
const schema = z.object({
  DATABASE_URL: z.string().url().refine((value) =>
    ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "DATABASE_URL must use PostgreSQL"),
  DATABASE_POOL_MAX: integer(10, 1, 100),
  DATABASE_CONNECTION_TIMEOUT_MS: integer(5000, 100, 60_000),
  DATABASE_IDLE_TIMEOUT_MS: integer(30_000, 1000, 300_000),
  DATABASE_QUERY_TIMEOUT_MS: integer(10_000, 100, 120_000),
});
export type DatabaseConfig = {
  url: string; poolMax: number; connectionTimeoutMs: number;
  idleTimeoutMs: number; queryTimeoutMs: number;
};
export function readDatabaseConfig(input: Record<string, string | undefined>): DatabaseConfig {
  const value = schema.parse(input);
  return {
    url: value.DATABASE_URL,
    poolMax: value.DATABASE_POOL_MAX,
    connectionTimeoutMs: value.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMs: value.DATABASE_IDLE_TIMEOUT_MS,
    queryTimeoutMs: value.DATABASE_QUERY_TIMEOUT_MS,
  };
}
~~~

- [ ] **Step 3: Implement pool and transaction**

Create empty `schema.ts` as `export {};`. Create `client.ts`:

~~~ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readDatabaseConfig, type DatabaseConfig } from "./config";
import * as schema from "./schema";
export type AppDatabase = NodePgDatabase<typeof schema>;
export type DatabaseConnection = {
  db: AppDatabase; pool: Pool; close(): Promise<void>;
};
export function createDatabaseConnection(config: DatabaseConfig): DatabaseConnection {
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    query_timeout: config.queryTimeoutMs,
    statement_timeout: config.queryTimeoutMs,
    application_name: "learning-hub",
  });
  pool.on("error", (error: Error & { code?: string }) => {
    console.error("database.pool.idle_client_error", {
      errorName: error.name, errorCode: error.code ?? "unknown",
    });
  });
  return { db: drizzle({ client: pool, schema }), pool, close: () => pool.end() };
}
const cache = globalThis as typeof globalThis & { learningHubDatabase?: DatabaseConnection };
export function getRuntimeDatabaseConnection(): DatabaseConnection {
  cache.learningHubDatabase ??= createDatabaseConnection(readDatabaseConfig(process.env));
  return cache.learningHubDatabase;
}
~~~

`transaction.ts`:

~~~ts
import type { AppDatabase } from "./client";
export type DatabaseTransaction =
  Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export function withTransaction<T>(
  database: AppDatabase,
  work: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(work);
}
~~~

- [ ] **Step 4: Verify and commit**

Run `npm test -- tests/platform/database-config.test.ts`, `npm run lint` and `npm run typecheck`. Expected: all exit 0.

~~~powershell
git add src/platform/database tests/platform/database-config.test.ts
git commit -m "feat: add database runtime boundary"
~~~

### Task 4: Create reviewed outbox migration and role tests

**Files:** Create `src/platform/events/domain-event.ts`, `schema.ts`, `scripts/database/run-migrations.ts`, `migrate.ts`, `drizzle/**` and `tests/integration/database/{global-setup,migrations.integration.test,roles.integration.test}.ts`; modify `src/platform/database/schema.ts`.

**Interfaces:** Produces `platform_event_outbox`, `platform_event_consumptions` and `runMigrations(url)`.

- [ ] **Step 1: Define the exact event contract**

~~~ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export interface DomainEventInput<T extends JsonObject = JsonObject> {
  eventType: string; aggregateType: string; aggregateId: string;
  payload: T; occurredAt: Date; availableAt?: Date;
}
~~~

`schema.ts`:

~~~ts
import { sql } from "drizzle-orm";
import {
  check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import type { JsonObject } from "./domain-event";
export const platformEventOutbox = pgTable("platform_event_outbox", {
  id: uuid("id").primaryKey(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  state: text("state").notNull().default("pending"),
  availableAt: timestamp("available_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  attemptCount: integer("attempt_count").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("platform_event_outbox_dispatch_idx").on(table.state, table.availableAt),
  index("platform_event_outbox_aggregate_idx").on(
    table.aggregateType, table.aggregateId, table.occurredAt),
  check("platform_event_outbox_state_check",
    sql`${table.state} in ('pending','publishing','retry_wait','published','dead_letter')`),
  check("platform_event_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
]);
export const platformEventConsumptions = pgTable("platform_event_consumptions", {
  consumerName: text("consumer_name").notNull(),
  eventId: uuid("event_id").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [primaryKey({
  name: "platform_event_consumptions_pk",
  columns: [table.consumerName, table.eventId],
})]);
~~~

Export both tables from `src/platform/database/schema.ts`:

~~~ts
export { platformEventConsumptions, platformEventOutbox } from "@/platform/events/schema";
~~~

- [ ] **Step 2: Generate and harden SQL**

Run `npm run db:generate -- --name=platform_event_outbox`, then append:

~~~sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO learning_hub_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE platform_event_outbox, platform_event_consumptions TO learning_hub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learning_hub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO learning_hub_app;
~~~

Expected: migration creates only the two tables, constraints/indexes and grants.

- [ ] **Step 3: Implement operator runner**

~~~ts
// scripts/database/run-migrations.ts
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
export async function runMigrations(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1,
    connectionTimeoutMillis: 10_000, application_name: "learning-hub-migrator" });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
      migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations",
    });
  } finally { await pool.end(); }
}
~~~

~~~ts
// scripts/database/migrate.ts
import { readMigrationDatabaseUrl } from "./migration-env";
import { runMigrations } from "./run-migrations";
try {
  await runMigrations(readMigrationDatabaseUrl(process.env));
  console.info("database.migration.completed");
} catch (error) {
  console.error("database.migration.failed", {
    errorName: error instanceof Error ? error.name : "unknown",
  });
  process.exitCode = 1;
}
~~~

- [ ] **Step 4: Add guarded integration setup and tests**

`global-setup.ts`:

~~~ts
import { Client } from "pg";
import { readMigrationDatabaseUrl } from "../../../scripts/database/migration-env";
import { runMigrations } from "../../../scripts/database/run-migrations";
export default async function setup() {
  const url = readMigrationDatabaseUrl(process.env);
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  const remoteAck = process.env.REMOTE_TEST_DATABASE_RESET_ACK === name;
  if (!name.endsWith("_test") || (!local && !remoteAck)) {
    throw new Error("Refusing destructive integration reset");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally { await client.end(); }
  await runMigrations(url);
}
~~~

`migrations.integration.test.ts`:

~~~ts
import { Client } from "pg";
import { expect, it } from "vitest";
import { readMigrationDatabaseUrl } from "../../../scripts/database/migration-env";
import { runMigrations } from "../../../scripts/database/run-migrations";
it("migrates an empty database and repeats safely", async () => {
  const url = readMigrationDatabaseUrl(process.env);
  await runMigrations(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  const result = await client.query<{ name: string }>(
    "select to_regclass('public.platform_event_outbox')::text as name");
  await client.end();
  expect(result.rows[0]?.name).toBe("platform_event_outbox");
});
~~~

`roles.integration.test.ts` must connect using `DATABASE_URL` and contain:

~~~ts
await client.query(
  "insert into platform_event_outbox " +
    "(id,event_type,aggregate_type,aggregate_id,payload,occurred_at) " +
    "values ($1,$2,$3,$4,$5::jsonb,now())",
  [crypto.randomUUID(), "platform.test.v1", "test", crypto.randomUUID(), "{}"],
);
await expect(client.query("create table forbidden_by_app_role(id integer)")).rejects.toThrow();
await expect(client.query('select * from drizzle."__drizzle_migrations"')).rejects.toThrow();
~~~

Run `npm run db:migrate` and `npm run test:integration` against the local URLs. Expected: all pass; never run reset against a remote/non-test database.

~~~powershell
git add src/platform/events src/platform/database/schema.ts scripts/database drizzle tests/integration
git commit -m "feat: add transactional event outbox schema"
~~~

### Task 5: Implement transactional outbox operations

**Files:** Create `src/platform/events/outbox.ts`, `index.ts` and `tests/integration/database/outbox.integration.test.ts`.

**Interfaces:** Produces `enqueueDomainEvent(tx,input): Promise<string>` and `registerEventConsumption(tx,input): Promise<boolean>`.

- [ ] **Step 1: Write RED tests**

Test A opens `withTransaction`, enqueues an event, throws `force rollback`, then asserts no row for the aggregate UUID. Test B enqueues one event and asserts the first `registerEventConsumption` returns true and the same consumer/event returns false.

Run focused integration test. Expected: FAIL because exports do not exist.

- [ ] **Step 2: Implement exact operations**

~~~ts
import type { DatabaseTransaction } from "@/platform/database/transaction";
import type { DomainEventInput } from "./domain-event";
import { platformEventConsumptions, platformEventOutbox } from "./schema";
export async function enqueueDomainEvent(
  tx: DatabaseTransaction, input: DomainEventInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await tx.insert(platformEventOutbox).values({
    id, eventType: input.eventType, aggregateType: input.aggregateType,
    aggregateId: input.aggregateId, payload: input.payload,
    occurredAt: input.occurredAt, availableAt: input.availableAt ?? input.occurredAt,
  });
  return id;
}
export async function registerEventConsumption(
  tx: DatabaseTransaction, input: { consumerName: string; eventId: string },
): Promise<boolean> {
  const rows = await tx.insert(platformEventConsumptions).values(input)
    .onConflictDoNothing().returning({ eventId: platformEventConsumptions.eventId });
  return rows.length === 1;
}
~~~

Export the two functions and event types from `src/platform/events/index.ts`. Run full integration and typecheck; expected PASS.

~~~powershell
git add src/platform/events tests/integration/database/outbox.integration.test.ts
git commit -m "feat: add transactional outbox contract"
~~~

### Task 6: Add secret-free database readiness

**Files:** Create `src/platform/database/readiness.ts`, `src/app/api/health/ready/route.ts` and `tests/platform/database-readiness.test.ts`.

**Interfaces:** Produces `probeDatabase`, `createReadyHandler` and `GET /api/health/ready`.

- [ ] **Step 1: Write RED tests**

Injected successful probe must return 200 with `{"status":"ready","service":"learning-hub","dependencies":{"database":"ready"}}`. Injected error containing a fake secret must return 503 with `{"status":"unavailable","service":"learning-hub","dependencies":{"database":"unavailable"}}` and no error detail.

- [ ] **Step 2: Implement**

~~~ts
// readiness.ts
import { sql } from "drizzle-orm";
import type { AppDatabase } from "./client";
export async function probeDatabase(db: Pick<AppDatabase, "execute">): Promise<void> {
  await db.execute(sql`select 1`);
}
~~~

~~~ts
// route.ts
import { getRuntimeDatabaseConnection } from "@/platform/database/client";
import { probeDatabase } from "@/platform/database/readiness";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function createReadyHandler(probe: () => Promise<void>) {
  return async function GET() {
    try {
      await probe();
      return Response.json({ status: "ready", service: "learning-hub",
        dependencies: { database: "ready" } });
    } catch {
      return Response.json({ status: "unavailable", service: "learning-hub",
        dependencies: { database: "unavailable" } }, { status: 503 });
    }
  };
}
export const GET = createReadyHandler(async () =>
  probeDatabase(getRuntimeDatabaseConnection().db));
~~~

Unset DB URLs; run unit test and build. Expected: both pass without connection. Runtime without URL returns 503; migrated local DB returns 200.

~~~powershell
git add src/platform/database/readiness.ts src/app/api/health/ready/route.ts tests/platform/database-readiness.test.ts
git commit -m "feat: add database readiness probe"
~~~

### Task 7: Require PostgreSQL in CI and hand off

**Files:** Modify `.github/workflows/ci.yml` and trackers; create `docs/handoffs/SESSION-002.md`.

**Interfaces:** Produces observed PostgreSQL, Neon branch และ Vercel Preview evidence; WP-01 remains unverified.

- [ ] **Step 1: Add CI service and gates**

~~~yaml
services:
  postgres:
    image: postgres:18.4-alpine3.24
    env:
      POSTGRES_DB: learning_hub_test
      POSTGRES_USER: learning_hub_migrator
      POSTGRES_PASSWORD: local_migration_password
    ports: ["5432:5432"]
    options: >-
      --health-cmd "pg_isready -U learning_hub_migrator -d learning_hub_test"
      --health-interval 2s --health-timeout 3s --health-retries 20
~~~

After install, pipe `infra/postgres/local-init.sql` into `docker exec -i ${{ job.services.postgres.id }} psql`, then run migration with both CI URLs. After unit tests run integration with both URLs. Keep build without URLs. Give only app URL to HTTP smoke and assert exact readiness 200 JSON.

- [ ] **Step 2: Run gates**

Run architecture, lint, typecheck, unit, build and `npm audit --omit=dev --audit-level=high`. Expected all exit 0. Integration must passใน GitHub CI และ Neon branch ชั่วคราว; unavailable Docker is NOT RUN, never PASS.

- [ ] **Step 3: Write handoff and trackers**

`docs/handoffs/SESSION-002.md` must state `Lead review`, delivered items, deferred SESSION-003/006/WP-11 scope, exact observed command results/test counts, CI URL/result and risks. Never claim an unrun check. Set only the active SESSION-002 checkpoint to review; do not mark whole WP-01 verified.

~~~powershell
git add .github/workflows/ci.yml docs/handoffs/SESSION-002.md docs/project
git commit -m "ci: verify postgres platform foundation"
git status --short
git diff --check main...HEAD
git log --oneline main..HEAD
~~~

Expected: clean tree, no whitespace error and only SESSION-002 scope.

### Task 8: Verify on Neon and Vercel Preview, then clean the test branch

**Files:** Modify `docs/handoffs/SESSION-002.md` with observed provider evidence only; never write secrets.

**Interfaces:** Consumes the merged PR candidate; produces Neon schema/integration evidence, Vercel build/runtime evidence and cleanup confirmation.

- [ ] **Step 1: Create an isolated Neon branch through the Neon Postgres plugin**

Create `session-002-<short-sha>` under project `ai-roem-dai-learning-hub`. On that branch create database `learning_hub_session_002_test`, bootstrap the migration/application roles, and request a direct migration URL plus pooled application URL. Keep both only in process environment.

- [ ] **Step 2: Run remote migration and integration acceptance**

Set `REMOTE_TEST_DATABASE_RESET_ACK=learning_hub_session_002_test`; the integration guard may allow a remote reset only when this exact acknowledgement equals the parsed database name. Run `npm run db:migrate` and `npm run test:integration`, then use the Neon plugin to verify the two platform tables, indexes, constraints and app-role privileges. Expected: all pass and no Identity/Auth table exists.

- [ ] **Step 3: Verify the PR Preview through the Vercel plugin**

Wait for the PR Preview in Vercel project `ai-roem-dai-learning-hub`. Inspect build logs, runtime errors and fetch `/api/health/live` plus `/api/health/ready`. Expected: build is READY, liveness 200, readiness 200 with the exact minimal JSON, and no runtime secret/SQL appears in logs. Production deployment is out of scope.

- [ ] **Step 4: Record evidence and delete the Neon test branch**

Record only project/branch name, migration journal result, test counts, Preview deployment URL, HTTP results and cleanup result. Delete the temporary Neon branch through the plugin after evidence is captured. If Preview environment cannot receive the pooled URL, report BLOCKED rather than placing a connection string in Git, PR text or public logs.

## Self-Review Record

- Tasks 1–8 cover the SESSION-002 output and approved Neon/Vercel acceptance.
- Separate roles, empty migration, rollback, dedupe and readiness have explicit tests.
- Runtime cannot read migration credential/import migrator; build requires no DB secret.
- Better Auth, Identity, email and UI remain outside scope.
- Placeholder scan is clear; every code-changing step has concrete content and named interfaces.

## Execution Handoff

Plan saved at `docs/superpowers/plans/2026-07-15-postgresql-platform-data-foundation.md`. Use Inline Execution with `superpowers:executing-plans` in the dedicated SESSION-002 task. Keep one Coding Session active; do not dispatch parallel implementation agents.
