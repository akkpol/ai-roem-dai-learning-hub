import assert from "node:assert/strict";
import pg from "pg";

const { Pool } = pg;

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the provider Preview smoke test.`);
  return value;
}

const runtimeUrl = requireEnvironment("DATABASE_URL");
const authBaseUrl = requireEnvironment("NEON_AUTH_BASE_URL").replace(/\/$/, "");

const runtimePool = new Pool({ connectionString: runtimeUrl, max: 1 });

const requiredTables = [
  "certificates",
  "cohorts",
  "course_materials",
  "courses",
  "enrollments",
  "live_sessions",
  "notification_outbox",
  "profiles",
  "seat_reservations",
  "session_attendance",
];

try {
  const schemaStatus = await runtimePool.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name`,
    [requiredTables],
  );
  const presentTables = new Set(schemaStatus.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !presentTables.has(table));
  assert.deepEqual(missingTables, [], `Missing Preview tables: ${missingTables.join(", ")}`);

  const runtimeStatus = await runtimePool.query(`
    select current_user,
           current_setting('server_version_num')::int as server_version_num,
           has_schema_privilege(current_user, 'public', 'create') as can_create,
           has_table_privilege(current_user, 'courses', 'select') as can_select_courses,
           has_table_privilege(current_user, 'product_events', 'insert') as can_insert_events
  `);
  assert.equal(runtimeStatus.rows[0].current_user, "app_runtime");
  assert.ok(runtimeStatus.rows[0].server_version_num >= 180000, "Preview must use PostgreSQL 18+");
  assert.equal(runtimeStatus.rows[0].can_create, false, "Runtime role must not create schema objects");
  assert.equal(runtimeStatus.rows[0].can_select_courses, true);
  assert.equal(runtimeStatus.rows[0].can_insert_events, true);

  const client = await runtimePool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into product_events (event_name, anonymous_id, properties)
       values ('provider_preview_smoke', 'github-actions', '{}'::jsonb)`,
    );
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const jwksResponse = await fetch(`${authBaseUrl}/.well-known/jwks.json`, {
    redirect: "error",
  });
  assert.equal(jwksResponse.status, 200, "Neon Auth JWKS endpoint is unavailable");
  const jwks = await jwksResponse.json();
  assert.ok(Array.isArray(jwks.keys) && jwks.keys.length > 0, "Neon Auth returned no signing keys");

  console.log("Provider Preview smoke passed: PostgreSQL 18, schema, least-privilege runtime grants, rollback write, and Neon Auth.");
} finally {
  await runtimePool.end();
}
