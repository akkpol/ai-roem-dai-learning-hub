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
const allowedConsoleErrors = new Map<string, RegExp[]>();

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
  const allowed = allowedConsoleErrors.get(testInfo.testId) ?? [];
  const unexpected = errors.filter(
    (message) => !allowed.some((pattern) => pattern.test(message)),
  );
  await testInfo.attach("console-errors", {
    body: Buffer.from(JSON.stringify(errors, null, 2)),
    contentType: "application/json",
  });
  consoleErrors.delete(testInfo.testId);
  allowedConsoleErrors.delete(testInfo.testId);
  expect(unexpected).toEqual([]);
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

  let searchAttempts = 0;
  allowedConsoleErrors.set(testInfo.testId, [
    /Failed to load resource:.*status of 503/,
  ]);
  await page.route("**/api/admin/identity/accounts?query=*", async (route) => {
    searchAttempts += 1;
    if (searchAttempts === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily_unavailable" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [
          {
            accountId: targetAccountId,
            displayName: "บัญชีทดสอบ",
            status: "active",
            emailVerified: true,
            twoFactorEnabled: true,
          },
        ],
      }),
    });
  });
  await query.fill(targetEmail || targetAccountId);
  await page.getByRole("button", { name: "ค้นหาบัญชี" }).click();
  await expect(page.getByRole("link", { name: "เปิดรายละเอียด" })).toBeVisible();
  await query.fill("second@example.com");
  await page.getByRole("button", { name: "ค้นหาบัญชี" }).click();
  await expect(page.getByText("ค้นหาไม่สำเร็จ")).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิดรายละเอียด" })).toHaveCount(0);
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

test("exact search renders a no-result state without stale navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("support"),
    "Exact email/account search is platform-admin only by the WP-01 matrix",
  );
  await page.route("**/api/admin/identity/accounts?query=*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    }),
  );
  await page.goto("/admin/identity/accounts");
  await page
    .getByLabel("UUID หรืออีเมลตัวพิมพ์เล็ก")
    .fill("nobody@example.com");
  await page.getByRole("button", { name: "ค้นหาบัญชี" }).click();
  await expect(page.getByText("ไม่พบบัญชีที่ตรงกัน")).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิดรายละเอียด" })).toHaveCount(0);
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
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await dialog.getByLabel("Reason code").focus();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(trigger).toBeFocused();

  if (support) {
    await expect(page.getByRole("button", { name: "เพิ่มบทบาท" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ถอนบทบาท" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ระงับบัญชี" })).toHaveCount(0);
  }
});

test("destructive action keeps validation, pending, and request errors in the dialog", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("support"),
    "Lifecycle mutation validation is platform-admin only",
  );
  await page.goto(`/admin/identity/accounts/${targetAccountId}`);
  const trigger = page.getByRole("button", {
    name: /ระงับบัญชี|เปิดใช้งานอีกครั้ง/,
  });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", {
    name: "ยืนยันการดำเนินการ",
  });
  await confirm.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/ใช้ reason code ตัวพิมพ์เล็ก/)).toBeVisible();

  await dialog.getByLabel("Reason code").fill("e2e_request_retry");
  allowedConsoleErrors.set(testInfo.testId, [
    /Failed to load resource:.*status of 503/,
  ]);
  let releaseFailure: (() => void) | undefined;
  let actionAttempts = 0;
  await page.route(
    `**/api/admin/identity/accounts/${targetAccountId}`,
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      actionAttempts += 1;
      if (actionAttempts > 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      await new Promise<void>((resolve) => {
        releaseFailure = resolve;
      });
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily_unavailable" }),
      });
    },
  );
  const firstAttempt = confirm.click();
  await expect(
    dialog.getByRole("button", { name: "กำลังบันทึก…" }),
  ).toBeDisabled();
  releaseFailure?.();
  await firstAttempt;
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ดำเนินการไม่สำเร็จ")).toBeVisible();
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "บันทึกการเปลี่ยนแปลงพร้อม audit แล้ว",
  );
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
