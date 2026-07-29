import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("organization workspace pages", () => {
  it("provides the four organization entry points and uses the approved foundation", () => {
    const listPage = read("src/app/(workspace)/organizations/page.tsx");
    const newPage = read("src/app/(workspace)/organizations/new/page.tsx");
    const workspacePage = read("src/app/(workspace)/organizations/[organizationId]/page.tsx");
    const settingsPage = read("src/app/(workspace)/organizations/[organizationId]/settings/page.tsx");
    const forms = read("src/app/(workspace)/organizations/_components/organization-forms.tsx");

    expect(listPage).toContain("OrganizationList");
    expect(newPage).toContain("OrganizationCreateForm");
    expect(workspacePage).toContain("OrganizationWorkspace");
    expect(settingsPage).toContain("OrganizationSettingsForm");
    expect(forms).toContain('from "@/components/ui/field"');
    expect(forms).toContain('from "@/components/ui/textarea"');
    expect(forms).toContain('from "@/components/ui/spinner"');
    expect(forms).toContain("data-invalid=");
    expect(forms).toContain("aria-invalid=");
    expect(forms).toContain("window.location.assign");
    expect(forms).not.toMatch(/<button\b|<input\b|<textarea\b|<select\b|<label\b/);
  });

  it("covers loading, empty, retry, forbidden and stale-update states without fake dashboard metrics", () => {
    const workspace = read("src/app/(workspace)/organizations/_components/organization-workspace.tsx");
    const forms = read("src/app/(workspace)/organizations/_components/organization-forms.tsx");
    expect(workspace).toContain('from "@/components/ui/skeleton"');
    expect(workspace).toContain("EmptyMedia");
    expect(workspace).toContain("ลองอีกครั้ง");
    expect(workspace).toContain("ไม่อนุญาต");
    expect(forms).toContain("stale_version");
    expect(forms).toContain("slug");
    expect(workspace).not.toMatch(/รายได้|ผู้เรียนทั้งหมด|conversion/i);
  });
});
