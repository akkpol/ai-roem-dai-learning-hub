export type CourseLevel = "เริ่มต้น" | "ประยุกต์ใช้" | "เชี่ยวชาญ";

export type CourseTool =
  | "ChatGPT"
  | "Claude"
  | "Gemini"
  | "Copilot"
  | "อื่น ๆ";

export type CourseField =
  | "งานออฟฟิศ"
  | "การตลาด"
  | "คอนเทนต์"
  | "ธุรกิจ"
  | "เขียนโปรแกรม";

export type Course = {
  id: string;
  title: string;
  level: CourseLevel;
  tools: CourseTool[];
  fields: CourseField[];
  format: "คลาสสด" | "วิดีโอย้อนหลัง";
  duration: string;
  instructor: string;
  avatar: string;
  availability: string;
  time?: string;
  certificate: boolean;
  cover: "fundamentals" | "chat-claude" | "gemini" | "analytics";
};

export const levels: CourseLevel[] = ["เริ่มต้น", "ประยุกต์ใช้", "เชี่ยวชาญ"];

export const tools: CourseTool[] = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Copilot",
  "อื่น ๆ",
];

export const fields: CourseField[] = [
  "งานออฟฟิศ",
  "การตลาด",
  "คอนเทนต์",
  "ธุรกิจ",
  "เขียนโปรแกรม",
];

export const courses: Course[] = [
  {
    id: "ai-fundamentals",
    title: "AI Fundamentals: เริ่มต้นอย่างเข้าใจและปลอดภัย",
    level: "เริ่มต้น",
    tools: ["ChatGPT", "Claude", "Gemini"],
    fields: ["งานออฟฟิศ", "ธุรกิจ"],
    format: "คลาสสด",
    duration: "5 ชั่วโมง",
    instructor: "ดร. ณัฐพงศ์ วงศ์ไอที",
    avatar: "/images/avatar-natthapong.webp",
    availability: "เริ่ม 20 ก.ค. 2569",
    time: "19:00–21:00 น. (เสาร์)",
    certificate: true,
    cover: "fundamentals",
  },
  {
    id: "chatgpt-claude-writing",
    title: "ChatGPT และ Claude สำหรับงานเขียน",
    level: "เริ่มต้น",
    tools: ["ChatGPT", "Claude"],
    fields: ["คอนเทนต์", "การตลาด", "งานออฟฟิศ"],
    format: "วิดีโอย้อนหลัง",
    duration: "3 ชั่วโมง 40 นาที",
    instructor: "อ. ปริญญา ศรีสมบัติ",
    avatar: "/images/avatar-kanyaporn.webp",
    availability: "เรียนได้ทันที",
    certificate: true,
    cover: "chat-claude",
  },
  {
    id: "gemini-workspace",
    title: "Gemini สำหรับ Google Workspace",
    level: "เริ่มต้น",
    tools: ["Gemini"],
    fields: ["งานออฟฟิศ", "ธุรกิจ"],
    format: "คลาสสด",
    duration: "4 ชั่วโมง",
    instructor: "อ. ธนิตต์ วัฒนกุล",
    avatar: "/images/avatar-natthapong.webp",
    availability: "เริ่ม 27 ก.ค. 2569",
    time: "19:00–21:00 น. (อาทิตย์)",
    certificate: true,
    cover: "gemini",
  },
  {
    id: "ai-data-business",
    title: "AI วิเคราะห์ข้อมูลสำหรับธุรกิจ",
    level: "ประยุกต์ใช้",
    tools: ["ChatGPT", "Gemini", "อื่น ๆ"],
    fields: ["ธุรกิจ", "การตลาด"],
    format: "วิดีโอย้อนหลัง",
    duration: "4 ชั่วโมง 30 นาที",
    instructor: "ผศ. ดร. วิภา โล้ทอง",
    avatar: "/images/avatar-kanyaporn.webp",
    availability: "เรียนได้ทันที",
    certificate: true,
    cover: "analytics",
  },
  {
    id: "copilot-office",
    title: "Copilot สำหรับงานออฟฟิศแบบมืออาชีพ",
    level: "ประยุกต์ใช้",
    tools: ["Copilot"],
    fields: ["งานออฟฟิศ"],
    format: "คลาสสด",
    duration: "4 ชั่วโมง",
    instructor: "อ. ปริญญา ศรีสมบัติ",
    avatar: "/images/avatar-kanyaporn.webp",
    availability: "เริ่ม 3 ส.ค. 2569",
    time: "19:00–21:00 น. (จันทร์)",
    certificate: true,
    cover: "chat-claude",
  },
  {
    id: "ai-automation-code",
    title: "สร้าง Workflow อัตโนมัติด้วย AI",
    level: "เชี่ยวชาญ",
    tools: ["Claude", "อื่น ๆ"],
    fields: ["เขียนโปรแกรม", "ธุรกิจ"],
    format: "วิดีโอย้อนหลัง",
    duration: "6 ชั่วโมง",
    instructor: "ดร. ณัฐพงศ์ วงศ์ไอที",
    avatar: "/images/avatar-natthapong.webp",
    availability: "เรียนได้ทันที",
    certificate: true,
    cover: "analytics",
  },
];
