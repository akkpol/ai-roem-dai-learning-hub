import { getGoogleLoginHandlers } from "@/modules/identity";

export async function POST(request: Request): Promise<Response> {
  return getGoogleLoginHandlers().start(request);
}
