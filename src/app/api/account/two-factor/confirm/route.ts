import { getAccountHttpHandlers } from "@/modules/identity";

export function POST(request: Request) {
  return getAccountHttpHandlers().confirmTwoFactor(request);
}
