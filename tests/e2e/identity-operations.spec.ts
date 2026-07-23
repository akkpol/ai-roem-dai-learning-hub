import { expect, test } from "@playwright/test";

const baseUrlConfigured = Boolean(process.env.IDENTITY_E2E_BASE_URL);
const adminStateConfigured = Boolean(
  process.env.IDENTITY_E2E_ADMIN_STORAGE_STATE,
);
const supportStateConfigured = Boolean(
  process.env.IDENTITY_E2E_SUPPORT_STORAGE_STATE,
);
const targetAccountId =
  process.env.IDENTITY_E2E_TARGET_ACCOUNT_ID ?? "";
const targetEmail = process.env.IDENTITY_E2E_TARGET_EMAIL ?? "";
const allowMutations = process.env.IDENTITY_E2E_ALLOW_MUTATIONS === "1";
const consoleErrors = new Map<string, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const role = testInfo.project.name.includes("support") ? "support" : "admin";
  test.skip(
    !baseUrlConfigured ||
      !targetAccountId ||
      (role === "admin" ? !adminStateConfigured : !supportStateConfigured),
    "Requires production-like URL, disposable target, and role-specific authenticated storage state",
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
  await testInfo.attach("console-errors", {
    body: Buffer.from(JSON.stringify(errors, null, 2)),
    contentType: "application/json",
  });
  consoleErrors.delete(testInfo.testId);
  expect(errors).toEqual([]);
});

test("exact search validates fields and recovers from a transient request error", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("support"),
    "Exact email/account search is platform-admin only by the WP-01 matrix",
  );
  await page.goto("/admin/identity/accounts");
  await expect(
    page.getByRole("heading", { name: "ค้นหาบัญชีแบบเจาะจง" }),
  ).toBeVisible();
  const query = page.getByLabel("UUID หรืออีเมลตัวพิมพ์เล็ก");
  await query.fill("Person@Example.com");
  await page.getByRole("button", { name: "ค้นหาบัญชี" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "กรอก UUID ที่สมบูรณ์",
  );

  let aborted = false;
  await page.route("**/api/admin/identity/accounts?query=*", async (route) => {
    if (!aborted) {
      aborted = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await query.fill(targetEmail || targetAccountId);
  await page.getByRole("button", { name: "ค้นหาบัญชี" }).click();
  await expect(page.getByText("ค้นหาไม่สำเร็จ")).toBeVisible();
  await page.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(page.getByRole("link", { name: "เปิดรายละเอียด" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("role-specific detail is keyboard reachable and preserves destructive focus", async ({
  page,
}, testInfo) => {
  await page.goto(`/admin/identity/accounts/${targetAccountId}`);
  await expect(page.getByRole("heading", { name: "รายละเอียดบัญชี" })).toBeVisible();
  await expect(page.getByText(targetAccountId)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  const support = testInfo.project.name.includes("support");
  const trigger = support
    ? page.getByRole("button", { name: "เพิกถอน session" })
    : page.getByRole("button", { name: /ระงับบัญชี|เปิดใช้งานอีกครั้ง/ });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Reason code")).toBeFocused();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(trigger).toBeFocused();
});

test("authorized disposable-target mutation reaches the real audited route", async ({
  page,
}, testInfo) => {
  test.skip(
    !allowMutations || testInfo.project.name.includes("support"),
    "Requires an explicitly disposable target and IDENTITY_E2E_ALLOW_MUTATIONS=1",
  );
  await page.goto(`/admin/identity/accounts/${targetAccountId}`);
  const trigger = page.getByRole("button", {
    name: /ระงับบัญชี|เปิดใช้งานอีกครั้ง/,
  });
  await trigger.click();
  await page.getByLabel("Reason code").fill("e2e_identity_acceptance");
  await page.getByRole("button", { name: "ยืนยันการดำเนินการ" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "บันทึกการเปลี่ยนแปลงพร้อม audit แล้ว",
  );
});
