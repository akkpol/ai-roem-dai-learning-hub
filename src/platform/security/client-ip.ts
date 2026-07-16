import { isIP } from "node:net";

export function resolveClientIp(headers: Headers): string {
  const candidate = headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : "unknown";
}
