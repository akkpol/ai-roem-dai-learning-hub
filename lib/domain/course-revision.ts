export const courseRevisionStatusValues = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "retired",
] as const;

export type CourseRevisionStatus = (typeof courseRevisionStatusValues)[number];

const allowedTransitions: Record<CourseRevisionStatus, readonly CourseRevisionStatus[]> = {
  draft: ["in_review"],
  in_review: ["changes_requested", "approved"],
  changes_requested: ["in_review"],
  approved: ["retired"],
  retired: [],
};

export function assertRevisionTransition(
  from: CourseRevisionStatus,
  to: CourseRevisionStatus,
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`ไม่สามารถเปลี่ยนสถานะ revision จาก ${from} เป็น ${to}`);
  }
}

export function assertRevisionEditable(status: CourseRevisionStatus) {
  if (status !== "draft" && status !== "changes_requested") {
    throw new Error("เนื้อหาที่ส่งตรวจหรืออนุมัติแล้วแก้ไขไม่ได้ กรุณาสร้าง revision ใหม่");
  }
}

export function getNextRevisionNumber(existing: readonly number[]) {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

export function validateRevisionDraft(input: {
  title: string;
  summary: string;
  modules: ReadonlyArray<{ title: string; lessonCount: number }>;
  assignmentCount: number;
}) {
  const issues: string[] = [];
  if (!input.title.trim()) issues.push("กรุณาระบุชื่อคอร์ส");
  if (input.summary.trim().length < 20) {
    issues.push("คำอธิบายคอร์สควรมีอย่างน้อย 20 ตัวอักษร");
  }
  if (input.modules.length === 0) {
    issues.push("กรุณาเพิ่มอย่างน้อย 1 module");
  } else if (input.modules.some((module) => module.lessonCount < 1)) {
    issues.push("ทุก module ต้องมีอย่างน้อย 1 บทเรียน");
  }
  return issues;
}
