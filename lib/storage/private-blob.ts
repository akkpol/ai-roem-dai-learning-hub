import { get, put, type PutBlobResult } from "@vercel/blob";

export async function putPrivateDocument(
  pathname: string,
  body: Parameters<typeof put>[1],
  contentType: string,
): Promise<PutBlobResult> {
  return put(pathname, body, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });
}

export async function getPrivateDocument(pathname: string) {
  return get(pathname, { access: "private", useCache: false });
}
