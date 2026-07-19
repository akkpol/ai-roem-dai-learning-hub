import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const providerPatterns = [
  /^\.github\/workflows\//,
  /^scripts\/ci\//,
  /^scripts\/database\//,
  /^drizzle\//,
  /^drizzle\.config\.ts$/,
  /^\.env\.example$/,
  /^package(?:-lock)?\.json$/,
  /^src\/platform\/(?:config|database|events)\//,
  /^src\/modules\/identity\//,
  /^src\/app\/api\/auth\//,
  /^src\/app\/api\/health\/ready\//,
  /^tests\/acceptance\/identity\//,
  /^tests\/integration\//,
  /^tests\/platform\//,
];

function normalizePath(file) {
  return file.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function planGates(changedFiles) {
  const files = [...new Set(changedFiles.map(normalizePath).filter(Boolean))];

  return {
    code: files.some((file) => !file.toLowerCase().endsWith(".md")),
    provider: files.some((file) =>
      providerPatterns.some((pattern) => pattern.test(file)),
    ),
  };
}

const isCli =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) {
  const result = planGates(readFileSync(0, "utf8").split(/\r?\n/));
  process.stdout.write(`code=${result.code}\nprovider=${result.provider}\n`);
}
