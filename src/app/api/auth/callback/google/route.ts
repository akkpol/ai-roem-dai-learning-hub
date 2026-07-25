import { getGoogleLoginHandlers } from "@/modules/identity";

export async function GET(request: Request): Promise<Response> {
  return getGoogleLoginHandlers().callback(request);
}
