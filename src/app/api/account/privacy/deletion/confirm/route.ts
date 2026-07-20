import { getAccountHttpHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getAccountHttpHandlers().renderDeletionConfirmation(request);
}

export function POST(request: Request) {
  return getAccountHttpHandlers().confirmDeletion(request);
}
