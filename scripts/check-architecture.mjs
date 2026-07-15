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

    if (source.includes("MIGRATION_DATABASE_URL")) {
      violations.push(`Migration credential is forbidden in runtime source: ${relative}`);
    }
    if (/drizzle-orm\/[^"']+\/migrator/.test(source)) {
      violations.push(`Migration runner is forbidden in runtime source: ${relative}`);
    }

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
