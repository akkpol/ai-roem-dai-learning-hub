const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function formatBangkokDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error("วันเวลาไม่ถูกต้อง");

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(value)
    .replace(" ", "T");
}

export function parseBangkokDateTime(value: string): Date {
  const normalized = value.trim();
  if (!DATE_TIME_LOCAL_PATTERN.test(normalized)) {
    throw new Error("วันเวลาไม่ถูกต้อง กรุณาเลือกวันและเวลาใหม่");
  }

  const parsed = new Date(`${normalized}:00+07:00`);
  if (Number.isNaN(parsed.getTime()) || formatBangkokDateTime(parsed) !== normalized) {
    throw new Error("วันเวลาไม่ถูกต้อง กรุณาเลือกวันและเวลาใหม่");
  }
  return parsed;
}

