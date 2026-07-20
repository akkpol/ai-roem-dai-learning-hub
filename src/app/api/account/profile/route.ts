import { getAccountHttpHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getAccountHttpHandlers().getProfile(request);
}

export function PATCH(request: Request) {
  return getAccountHttpHandlers().updateProfile(request);
}
