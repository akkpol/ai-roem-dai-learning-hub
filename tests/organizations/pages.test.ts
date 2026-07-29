import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  loadOrganizationList,
  loadOrganizationWorkspace,
  organizationListView,
  organizationWorkspaceView,
  updateOrganizationIdentity,
} from "@/app/(workspace)/organizations/_components/organization-client";

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

  it("uses real request state helpers for loading, empty, retry, forbidden and stale-update states", async () => {
    const workspace = read("src/app/(workspace)/organizations/_components/organization-workspace.tsx");
    const forms = read("src/app/(workspace)/organizations/_components/organization-forms.tsx");
    expect(workspace).toContain("organizationListView(state)");
    expect(workspace).toContain("organizationWorkspaceView(state)");
    expect(forms).toContain("organizationWorkspaceView(settingsState)");
    expect(forms).toContain("organizationMutationView(feedback?.code)");
    expect(workspace).toContain('from "@/components/ui/skeleton"');
    expect(workspace).toContain("EmptyMedia");
    expect(organizationListView({ kind: "loading" })).toBe("loading");
    expect(organizationListView({ kind: "success", organizations: [] })).toBe("empty");
    expect(organizationListView({ kind: "error", message: "offline", status: 500 })).toBe("retry");
    expect(organizationWorkspaceView({ kind: "error", message: "forbidden", status: 403 })).toBe("forbidden");
    expect(workspace).toContain("ลองอีกครั้ง");
    expect(workspace).toContain("ไม่อนุญาต");
    expect(workspace).not.toContain("learninghub.example");
    expect(workspace).not.toMatch(/รายได้|ผู้เรียนทั้งหมด|conversion/i);

    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return new Response(JSON.stringify({ organizations: [] }), { status: 200 });
    });
    await expect(loadOrganizationList(fetchMock)).resolves.toEqual({ kind: "success", organizations: [] });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "ไม่มีสิทธิ์" }), { status: 403 }));
    await expect(loadOrganizationWorkspace(fetchMock, "00000000-0000-4000-8000-000000000003")).resolves.toMatchObject({ kind: "error", status: 403 });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ organization: { id: "00000000-0000-4000-8000-000000000003" } }), { status: 200 }));
    await expect(updateOrganizationIdentity(fetchMock, "00000000-0000-4000-8000-000000000003", {
      displayName: "ชื่อใหม่", slug: "immutable-slug", description: "", contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok",
    }, 3)).resolves.toMatchObject({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      displayName: "ชื่อใหม่", description: null, contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok", expectedVersion: 3,
    });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: "stale_version", message: "โหลดใหม่" }), { status: 409 }));
    await expect(updateOrganizationIdentity(fetchMock, "00000000-0000-4000-8000-000000000003", {
      displayName: "ชื่อใหม่", slug: "immutable-slug", description: "", contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok",
    }, 3)).resolves.toMatchObject({ ok: false, code: "stale_version" });
  });
});
