export function assertInstructorScope(
  assignedCohortIds: readonly string[],
  requestedCohortId: string,
) {
  if (!assignedCohortIds.includes(requestedCohortId)) {
    throw new Error("คุณไม่ได้รับมอบหมายให้ดูแลรุ่นเรียนนี้");
  }
}

export function normalizeAttendanceBatch(
  rows: ReadonlyArray<{ enrollmentId: string; attendancePercent: number }>,
) {
  const seen = new Set<string>();
  return rows.map((row) => {
    const enrollmentId = row.enrollmentId.trim();
    if (!enrollmentId) throw new Error("กรุณาระบุ enrollment");
    if (seen.has(enrollmentId)) throw new Error("พบ enrollment ซ้ำใน attendance batch");
    if (!Number.isInteger(row.attendancePercent) || row.attendancePercent < 0 || row.attendancePercent > 100) {
      throw new Error("Attendance ต้องเป็นจำนวนเต็ม 0–100");
    }
    seen.add(enrollmentId);
    return { enrollmentId, attendancePercent: row.attendancePercent };
  });
}

export function learnerRiskLevel(input: {
  progressPercent: number;
  attendancePercent: number;
  overdueAssignments: number;
}) {
  if (
    input.progressPercent < 25 ||
    input.attendancePercent < 70 ||
    input.overdueAssignments >= 2
  ) {
    return "high" as const;
  }
  if (
    input.progressPercent < 60 ||
    input.attendancePercent < 85 ||
    input.overdueAssignments > 0
  ) {
    return "medium" as const;
  }
  return "low" as const;
}
