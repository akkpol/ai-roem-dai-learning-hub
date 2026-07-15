export type CommunityScope = {
  enrolled: boolean;
  assignedInstructor: boolean;
  admin: boolean;
};

export function assertCommunityAccess(scope: CommunityScope) {
  if (!scope.enrolled && !scope.assignedInstructor && !scope.admin) {
    throw new Error("คุณไม่มีสิทธิ์เข้าชุมชนของรุ่นเรียนนี้");
  }
}

export function assertFlatReply(parentReplyId: string | null | undefined) {
  if (parentReplyId) throw new Error("Q&A รุ่นแรกไม่รองรับ reply ซ้อน");
}

export function assertThreadReplyable(status: "open" | "resolved" | "locked") {
  if (status === "locked") throw new Error("กระทู้นี้ถูกล็อกและไม่รับคำตอบเพิ่ม");
}

export function canModerateCommunity(input: {
  assignedInstructor: boolean;
  admin: boolean;
}) {
  return input.assignedInstructor || input.admin;
}
