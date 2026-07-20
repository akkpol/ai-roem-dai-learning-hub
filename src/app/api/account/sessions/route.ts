import { getAccountHttpHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getAccountHttpHandlers().listSessions(request);
}

export function DELETE(request: Request) {
  return getAccountHttpHandlers().revokeSession(request);
}
