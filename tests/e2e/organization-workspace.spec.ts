import { expect, test, type Page, type Route } from "@playwright/test";

const enabled = Boolean(process.env.ORGANIZATION_E2E_BASE_URL);
const storageStateConfigured = Boolean(process.env.IDENTITY_E2E_ADMIN_STORAGE_STATE);
const allowRealMutations = process.env.ORGANIZATION_E2E_ALLOW_MUTATIONS === "1";
const organizationId = "00000000-0000-4000-8000-000000000071";
const consoleErrors = new Map<string, string[]>();

type Workspace = {
  organization: {
    id: string;
    displayName: string;
    slug: string;
    description: string | null;
    contactEmail: string;
    locale: "th-TH" | "en-US";
    timeZone: string;
    status: "active";
    version: number;
  };
  membership: {
    organizationId: string;
    accountId: string;
    role: "owner" | "manager" | "member";
    status: "active";
  };
};

function workspace(overrides: Partial<Workspace["organization"]> = {}): Workspace {
  return {
    organization: {
      id: organizationId,
      displayName: "สถาบันเรียนรู้ทดสอบ",
      slug: "learning-test-institute",
      description: "พื้นที่เตรียมความพร้อมของผู้สอน",
      contactEmail: "owner@example.test",
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
      status: "active",
      version: 1,
      ...overrides,
    },
    membership: {
      organizationId,
      accountId: "00000000-0000-4000-8000-000000000001",
      role: "owner",
      status: "active",
    },
  };
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installWorkspaceStub(page: Page, initial = workspace()) {
  let current = initial;
  await page.route("**/api/organizations", async (route, request) => {
    if (request.method() === "POST") {
      await fulfillJson(route, current, 201);
      return;
    }
    await fulfillJson(route, {
      organizations: [{
        id: current.organization.id,
        displayName: current.organization.displayName,
        slug: current.organization.slug,
        description: current.organization.description,
        locale: current.organization.locale,
        timeZone: current.organization.timeZone,
        status: current.organization.status,
      }],
    });
  });
  await page.route(`**/api/organizations/${organizationId}**`, async (route, request) => {
    if (request.method() === "PATCH") {
      const update = request.postDataJSON() as Partial<Workspace["organization"]>;
      current = workspace({
        ...current.organization,
        displayName: update.displayName ?? current.organization.displayName,
        description: update.description ?? null,
        contactEmail: update.contactEmail ?? current.organization.contactEmail,
        locale: update.locale ?? current.organization.locale,
        timeZone: update.timeZone ?? current.organization.timeZone,
        version: current.organization.version + 1,
      });
    }
    await fulfillJson(route, current);
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !enabled || testInfo.project.name.includes("support"),
    "Set ORGANIZATION_E2E_BASE_URL to run bounded organization browser acceptance; support has no organization-owner fixture.",
  );
  const errors: string[] = [];
  consoleErrors.set(testInfo.testId, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({}, testInfo) => {
  const errors = consoleErrors.get(testInfo.testId) ?? [];
  consoleErrors.delete(testInfo.testId);
  await testInfo.attach("console-errors", {
    body: Buffer.from(JSON.stringify(errors, null, 2)),
    contentType: "application/json",
  });
  expect(errors.filter((message) => !/Failed to load resource:.*status of (401|403|409|503)/.test(message))).toEqual([]);
});

test("stubbed UI path creates an organization and saves settings", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name.includes("mobile") ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await installWorkspaceStub(page);
  await page.goto("/organizations/new");
  await page.getByLabel("ชื่อองค์กร").fill("สถาบันเรียนรู้ทดสอบ");
  await page.getByLabel("ชื่อ URL").fill("learning-test-institute");
  await page.getByLabel("คำอธิบาย").fill("พื้นที่เตรียมความพร้อมของผู้สอน");
  await page.getByLabel("อีเมลติดต่อ").fill("owner@example.test");
  await page.getByRole("button", { name: "สร้างองค์กร" }).click();
  await expect(page).toHaveURL(`/organizations/${organizationId}`);
  await page.goto(`/organizations/${organizationId}/settings`);
  await expect(page.getByRole("heading", { name: "ตั้งค่าองค์กร" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByLabel("ชื่อองค์กร").fill("สถาบันเรียนรู้ใหม่");
  await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.locator('[data-slot="alert"]').filter({ hasText: "บันทึกข้อมูลองค์กรแล้ว" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("server-first retry and client form mutation states remain safe", async ({ page }) => {
  await page.goto("/organizations");
  await expect(page.getByText("โหลดข้อมูลไม่สำเร็จ")).toBeVisible();
  await expect(page.getByRole("button", { name: "ลองอีกครั้ง" })).toBeVisible();

  await page.route("**/api/organizations", (route, request) => {
    if (request.method() === "POST") {
      return fulfillJson(route, { message: "ชื่อ URL นี้ถูกใช้งานแล้ว", fieldErrors: { slug: "ชื่อ URL นี้ถูกใช้งานแล้ว" } }, 409);
    }
    return fulfillJson(route, { organizations: [] });
  });
  await page.goto("/organizations/new");
  await page.getByLabel("ชื่อองค์กร").fill("สถาบันทดสอบ");
  await page.getByLabel("ชื่อ URL").fill("taken-slug");
  await page.getByLabel("อีเมลติดต่อ").fill("owner@example.test");
  await page.getByRole("button", { name: "สร้างองค์กร" }).click();
  await expect(page.locator('[data-slot="field-error"]')).toHaveText("ชื่อ URL นี้ถูกใช้งานแล้ว");
  await expect(page.getByLabel("ชื่อ URL")).toHaveAttribute("aria-invalid", "true");

  let patchAttempt = 0;
  await page.route(`**/api/organizations/${organizationId}`, (route, request) => {
    if (request.method() === "PATCH") {
      patchAttempt += 1;
      return fulfillJson(route, { code: "stale_version", message: "ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่" }, 409);
    }
    return fulfillJson(route, workspace());
  });
  await page.goto(`/organizations/${organizationId}/settings`);
  await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.getByText("ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่")).toBeVisible();
  await expect(page.getByRole("button", { name: "โหลดข้อมูลใหม่" })).toBeVisible();
  expect(patchAttempt).toBe(1);
});

test("real-stack organization journey is opt-in and requires a disposable authenticated fixture", async ({ page }, testInfo) => {
  test.skip(
    !storageStateConfigured || !allowRealMutations || testInfo.project.name.includes("mobile"),
    "Requires authenticated disposable owner storage state and ORGANIZATION_E2E_ALLOW_MUTATIONS=1; mobile coverage is provided by the bounded stubbed UI path.",
  );
  const slug = `e2e-org-${Date.now()}`;
  await page.goto("/organizations/new");
  await page.getByLabel("ชื่อองค์กร").fill("องค์กรทดสอบ E2E");
  await page.getByLabel("ชื่อ URL").fill(slug);
  await page.getByLabel("อีเมลติดต่อ").fill(process.env.ORGANIZATION_E2E_CONTACT_EMAIL ?? "owner@example.test");
  await page.getByRole("button", { name: "สร้างองค์กร" }).click();
  await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "ตั้งค่าองค์กร" }).click();
  await page.getByLabel("ชื่อองค์กร").fill("องค์กรทดสอบ E2E ที่แก้ไขแล้ว");
  await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.getByRole("alert")).toContainText("บันทึกข้อมูลองค์กรแล้ว");
});
