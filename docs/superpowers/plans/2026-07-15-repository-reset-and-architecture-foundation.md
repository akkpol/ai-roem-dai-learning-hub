# Repository Reset and Architecture Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy AI Closed Beta runtime with a neutral, tested Learning Hub shell and enforce the architecture boundary required for all later work.

**Architecture:** Keep a single Next.js application but move source code under `src/` and reserve `src/modules/` for bounded contexts. This work package deliberately contains no product domain, database, auth, payment, email, storage, or deployment integration; it creates the safe foundation that later vertical slices consume.

**Tech Stack:** Node.js 22, Next.js 16, React 19, TypeScript 5.9, Zod 4, Vitest 4, ESLint 9, GitHub Actions, Vercel

## Global Constraints

- The product is a multi-discipline learning marketplace; AI is only a possible subject category.
- There are no Production users or data to migrate.
- Delete legacy runtime instead of preserving backward compatibility.
- Do not read or modify `.env.local`, `.vercel/`, `.agents/`, `.codex/`, `.openai/`, `node_modules/`, `.next/`, `build/`, `worker/`, or untracked user files.
- Do not call provider, Preview, Production, cron, migration, seed, deployment, email, storage, or payment endpoints.
- Do not implement authentication, database schema, catalog, organization, instructor, learner, commerce, or visual product design.
- Production code must have no demo mode, fake success, or silent provider fallback.
- Use `apply_patch` for all tracked file edits and deletions.
- Do not mark WP-00 as `verified`; the Lead does that only after reviewing the handoff.

---

### Task 1: Reset the package and compiler contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: Node.js 22 and the repository root
- Produces: scripts `architecture`, `dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:watch`; alias `@/* -> src/*`

- [ ] **Step 1: Replace `package.json` with the neutral dependency contract**

```json
{
  "name": "learning-hub",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "architecture": "node scripts/check-architecture.mjs",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ignore-pattern .next",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.2.1",
    "@types/node": "22.19.19",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "eslint": "9.39.4",
    "eslint-config-next": "16.2.10",
    "tailwindcss": "4.2.1",
    "typescript": "5.9.3",
    "vitest": "4.1.0"
  },
  "type": "module"
}
```

- [ ] **Step 2: Regenerate the lockfile without lifecycle scripts**

Run: `npm install --package-lock-only --ignore-scripts`

Expected: exit `0`; `package-lock.json` names the package `learning-hub` and contains none of `@neondatabase/auth`, `@vercel/blob`, `nodemailer`, `@react-pdf/renderer`, `drizzle-orm`, or `pg`.

- [ ] **Step 3: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "scripts/**/*.d.mts",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Replace `vitest.config.ts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Replace `next.config.ts` with provider-neutral headers**

```ts
import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 6: Install the exact reset dependency tree**

Run: `npm ci --ignore-scripts`

Expected: exit `0` with no missing package errors.

- [ ] **Step 7: Commit the package contract**

```powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts next.config.ts
git commit -m "build: reset learning hub toolchain"
```

### Task 2: Remove the legacy runtime and build a neutral application shell

**Files:**
- Delete: `app/**`
- Delete: `components/**`
- Delete: `lib/**`
- Delete: `db/**`
- Delete: `drizzle.config.ts`
- Delete: `drizzle/**`
- Delete: `proxy.ts`
- Delete: `public/images/**`
- Delete: `public/file.svg`
- Delete: `public/globe.svg`
- Delete: `public/window.svg`
- Delete: `tmp/design-qa/**`
- Delete: `tests/domain/**`
- Delete: `tests/integration/**`
- Delete: `scripts/check-migration-safety.mjs`
- Delete: `scripts/provider-preview-smoke.mjs`
- Delete: `scripts/deployed-preview-smoke.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/api/health/live/route.ts`
- Create: `src/modules/README.md`
- Test: `tests/platform/runtime-env.test.ts`
- Create: `src/platform/config/runtime-env.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: neutral package/compiler contract from Task 1
- Produces: `readRuntimeEnv(input)`, `GET /`, and `GET /api/health/live`

- [ ] **Step 1: Write the runtime environment tests**

```ts
import { describe, expect, it } from "vitest";
import { readRuntimeEnv } from "@/platform/config/runtime-env";

describe("readRuntimeEnv", () => {
  it("accepts an explicit application URL", () => {
    expect(
      readRuntimeEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://learning.example.com",
      }),
    ).toEqual({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://learning.example.com",
    });
  });

  it("rejects a malformed application URL", () => {
    expect(() =>
      readRuntimeEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "not-a-url" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/platform/runtime-env.test.ts`

Expected: FAIL because `@/platform/config/runtime-env` does not exist.

- [ ] **Step 3: Delete every tracked path listed under Task 2 Delete using `apply_patch`**

Expected: `git status --short` reports the legacy paths as deleted and does not report changes inside ignored/user-owned directories.

- [ ] **Step 4: Implement `src/platform/config/runtime-env.ts`**

```ts
import { z } from "zod";

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function readRuntimeEnv(input: Record<string, string | undefined>): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}
```

- [ ] **Step 5: Create the neutral application files**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Hub",
  description: "A marketplace for learning across every discipline.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="status-page">
      <p className="eyebrow">LEARNING HUB</p>
      <h1>พื้นที่เรียนรู้สำหรับทุกศาสตร์</h1>
      <p>แพลตฟอร์มกำลังถูกสร้างใหม่บนโครงสร้างที่พร้อมสำหรับผู้เรียน ผู้สอน และสถาบัน</p>
    </main>
  );
}
```

`src/app/api/health/live/route.ts`:

```ts
export function GET() {
  return Response.json({ status: "ok", service: "learning-hub" });
}
```

`src/app/globals.css`:

```css
:root {
  color-scheme: light;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f5ef;
  color: #14213d;
}

* { box-sizing: border-box; }
body { margin: 0; }
.status-page { max-width: 48rem; margin: 0 auto; padding: 20vh 1.5rem 4rem; }
.eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.16em; }
h1 { max-width: 18ch; font-size: clamp(2.5rem, 7vw, 5rem); line-height: 1; margin: 1rem 0; }
p { font-size: 1.05rem; line-height: 1.7; }
```

`src/modules/README.md`:

```md
# Modules

Each bounded context owns its domain, application, infrastructure, presentation, tests, and public `index.ts` contract. Cross-module consumers import only from `@/modules/<module>`.
```

- [ ] **Step 6: Replace `.env.example`**

```dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 7: Run the focused test and typecheck**

Run: `npm test -- tests/platform/runtime-env.test.ts`

Expected: PASS with 2 tests.

Run: `npm run typecheck`

Expected: exit `0`.

- [ ] **Step 8: Commit the neutral runtime**

```powershell
git add -A -- app components lib db drizzle drizzle.config.ts proxy.ts public tmp src tests scripts .env.example
git commit -m "refactor: replace closed beta runtime with neutral shell"
```

### Task 3: Add an executable architecture boundary

**Files:**
- Create: `scripts/check-architecture.mjs`
- Create: `scripts/check-architecture.d.mts`
- Create: `tests/architecture/check-architecture.test.ts`

**Interfaces:**
- Consumes: repository root or a fixture root
- Produces: `checkArchitecture(rootDirectory): string[]` and CLI exit `0|1`

- [ ] **Step 1: Write architecture checker tests**

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkArchitecture } from "../../scripts/check-architecture.mjs";

function fixture() {
  return mkdtempSync(path.join(tmpdir(), "learning-hub-architecture-"));
}

function write(root: string, relativePath: string, contents = "export {};") {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

describe("checkArchitecture", () => {
  it("accepts imports through a module public contract", () => {
    const root = fixture();
    write(root, "src/modules/catalog/index.ts", "export const catalog = true;");
    write(root, "src/app/page.tsx", 'import { catalog } from "@/modules/catalog"; void catalog;');
    expect(checkArchitecture(root)).toEqual([]);
  });

  it("rejects legacy root source directories", () => {
    const root = fixture();
    write(root, "lib/legacy.ts");
    expect(checkArchitecture(root)).toContain("Legacy root directory is forbidden: lib");
  });

  it("rejects deep imports into another module", () => {
    const root = fixture();
    write(root, "src/modules/catalog/domain/course.ts", "export const course = true;");
    write(
      root,
      "src/modules/enrollments/application/grant.ts",
      'import { course } from "@/modules/catalog/domain/course"; void course;',
    );
    expect(checkArchitecture(root)[0]).toMatch(/Deep cross-module import is forbidden/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/architecture/check-architecture.test.ts`

Expected: FAIL because `scripts/check-architecture.mjs` does not exist.

- [ ] **Step 3: Implement `scripts/check-architecture.mjs`**

```js
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenRoots = ["app", "components", "db", "lib"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

export function checkArchitecture(rootDirectory) {
  const violations = [];

  for (const directory of forbiddenRoots) {
    if (existsSync(path.join(rootDirectory, directory))) {
      violations.push(`Legacy root directory is forbidden: ${directory}`);
    }
  }

  for (const filename of walk(path.join(rootDirectory, "src"))) {
    if (!sourceExtensions.has(path.extname(filename))) continue;
    const relative = path.relative(rootDirectory, filename).split(path.sep).join("/");
    const ownerMatch = relative.match(/^src\/modules\/([^/]+)\//);
    const owner = ownerMatch?.[1];
    const source = readFileSync(filename, "utf8");
    const imports = source.matchAll(/(?:from\s+|import\s*\()\s*["']@\/modules\/([^/"']+)\/([^"']+)["']/g);

    for (const match of imports) {
      const target = match[1];
      if (owner !== target) {
        violations.push(
          `Deep cross-module import is forbidden in ${relative}: @/modules/${target}/${match[2]}`,
        );
      }
    }
  }

  return violations;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const violations = checkArchitecture(process.cwd());
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  }
}
```

Create `scripts/check-architecture.d.mts`:

```ts
export function checkArchitecture(rootDirectory: string): string[];
```

- [ ] **Step 4: Run focused tests and the repository checker**

Run: `npm test -- tests/architecture/check-architecture.test.ts`

Expected: PASS with 3 tests.

Run: `npm run architecture`

Expected: exit `0` with no output.

- [ ] **Step 5: Commit the architecture guard**

```powershell
git add scripts/check-architecture.mjs scripts/check-architecture.d.mts tests/architecture/check-architecture.test.ts
git commit -m "test: enforce modular architecture boundary"
```

### Task 4: Replace provider-bound automation with neutral CI

**Files:**
- Delete: `.github/workflows/apply-production-migration.yml`
- Delete: `.github/workflows/migrate-production.yml`
- Delete: `.github/workflows/provider-preview.yml`
- Delete: `.github/workflows/scheduled-notifications.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: scripts and routes created in Tasks 1—3
- Produces: one neutral CI workflow and a cron-free Vercel config

- [ ] **Step 1: Delete the four provider-bound workflows using `apply_patch`**

Expected: only `.github/workflows/ci.yml` remains.

- [ ] **Step 2: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.13.0
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run architecture
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Production HTTP smoke test
        shell: bash
        run: |
          npm run start -- --hostname 127.0.0.1 --port 3000 > /tmp/learning-hub.log 2>&1 &
          server_pid=$!
          trap 'kill $server_pid' EXIT
          for attempt in {1..30}; do
            if curl --silent http://127.0.0.1:3000/api/health/live > /dev/null; then break; fi
            sleep 1
          done
          test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/)" = "200"
          test "$(curl --silent http://127.0.0.1:3000/api/health/live)" = '{"status":"ok","service":"learning-hub"}'
      - run: npm audit --omit=dev --audit-level=high
```

- [ ] **Step 3: Replace `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

- [ ] **Step 4: Verify no provider-bound automation remains**

Run:

```powershell
rg -n "cron|NEON_|DATABASE_URL|GMAIL_|BLOB_|ai-roem-dai|ai-fundamentals|Closed Beta" .github vercel.json .env.example
```

Expected: no output and exit code `1` from `rg` because no match exists.

- [ ] **Step 5: Commit neutral automation**

```powershell
git add -A -- .github/workflows vercel.json
git commit -m "ci: replace provider-bound workflows with neutral gates"
```

### Task 5: Verify the reset and produce the session handoff

**Files:**
- Create: `docs/handoffs/SESSION-001.md`

**Interfaces:**
- Consumes: completed Tasks 1—4
- Produces: review evidence for the Lead; no roadmap status mutation

- [ ] **Step 1: Confirm the final source inventory**

Run: `git ls-files src scripts tests .github`

Expected: `scripts/` contains only `check-architecture.mjs` and `check-architecture.d.mts`; `tests/` contains only `architecture/` and `platform/`; no legacy source path appears.

- [ ] **Step 2: Run the legacy-language scan**

Run:

```powershell
rg -n "AI เริ่มได้|Closed Beta|ai-fundamentals|gemini-workspace" src tests scripts .github package.json vercel.json .env.example
```

Expected: no output and exit code `1` from `rg`.

- [ ] **Step 3: Run all quality gates**

Run each command independently:

```powershell
npm run architecture
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`; tests report 5 passing tests.

- [ ] **Step 4: Run the production-mode HTTP smoke test**

Start:

```powershell
npm run start -- --hostname 127.0.0.1 --port 3000
```

In a second terminal, verify:

```powershell
$home = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/
$health = Invoke-RestMethod http://127.0.0.1:3000/api/health/live
if ($home.StatusCode -ne 200) { throw "Home status was $($home.StatusCode)" }
if ($health.status -ne 'ok' -or $health.service -ne 'learning-hub') { throw 'Health contract mismatch' }
```

Expected: no exception. Stop the server cleanly after the check.

- [ ] **Step 5: Create `docs/handoffs/SESSION-001.md` with observed evidence**

The file must use these headings in this order: `Scope completed`, `Commits`, `Files`, `Verification`, `Dependency reset`, `Out of scope preserved`, and `Risks and review notes`. Under each heading, record actual task titles, commit SHAs/messages, paths, observed command results, package names, and concrete review notes. Write `None observed` under risks only when every gate passed without a warning relevant to later work.

- [ ] **Step 6: Verify the handoff has no placeholders**

Run:

```powershell
rg -n "placeholder|replace me|not run|pending evidence" docs/handoffs/SESSION-001.md
```

Expected: no output and exit code `1`.

- [ ] **Step 7: Commit the handoff**

```powershell
git add docs/handoffs/SESSION-001.md
git commit -m "docs: hand off repository reset evidence"
```

- [ ] **Step 8: Report to the Lead without claiming WP-00 is verified**

Return the final commit SHA, the path `docs/handoffs/SESSION-001.md`, all command results, and any deviation from this plan. Stop; do not begin WP-01.
