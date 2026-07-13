import assert from "node:assert/strict";

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the deployed Preview smoke test.`);
  return value;
}

const previewUrl = new URL(requireEnvironment("PREVIEW_URL"));
const trustedOidcToken = requireEnvironment("VERCEL_TRUSTED_OIDC_TOKEN");

assert.equal(previewUrl.protocol, "https:", "Preview URL must use HTTPS");
assert.match(
  previewUrl.hostname,
  /^ai-roem-dai-learning-[a-z0-9]+-ak3lab\.vercel\.app$/,
  "Preview URL must be a deployment for the expected Vercel project and team",
);

const headers = {
  "user-agent": "ai-roem-dai-provider-preview-smoke/1.0",
  "x-vercel-trusted-oidc-idp-token": trustedOidcToken,
};

async function request(path, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(new URL(path, previewUrl), {
        ...init,
        redirect: init.redirect ?? "manual",
        headers: { ...headers, ...init.headers },
      });
      if (response.status < 500 || attempt === 6) return response;
      lastError = new Error(`${path} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw lastError;
}

const home = await request("/");
assert.equal(home.status, 200, "Preview home page is unavailable");
const homeHtml = await home.text();
assert.match(homeHtml, /AI เริ่มได้/);
assert.match(homeHtml, /ai-fundamentals/, "Preview must use the seeded Preview catalog, not empty Production data");

const course = await request("/courses/ai-fundamentals");
assert.equal(course.status, 200, "Seeded course detail is unavailable");
assert.match(await course.text(), /AI Fundamentals/);

const protectedPage = await request("/learn", { redirect: "manual" });
assert.ok([302, 303, 307, 308].includes(protectedPage.status), "Protected member route must redirect");
assert.match(protectedPage.headers.get("location") ?? "", /^\/auth\/sign-in/);

const session = await request("/api/auth/get-session", { redirect: "manual" });
assert.equal(session.status, 200, "Neon Auth session endpoint is unavailable through Vercel Preview");

console.log("Deployed Preview smoke passed: catalog DB wiring, course rendering, member protection, and Neon Auth route.");
