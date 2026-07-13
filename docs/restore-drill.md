# Neon restore drill

ทำอย่างน้อยก่อนเปิด Closed Beta และหลัง migration ที่เปลี่ยน data model สำคัญ

## Preconditions

- ใช้ Preview/Drill branch เท่านั้น ห้าม restore ทับ Production ระหว่างการซ้อม
- บันทึก production branch ID, snapshot timestamp และ migration journal ก่อนเริ่ม
- ระบุผู้รับผิดชอบและเวลาที่เริ่มซ้อม

## Drill

1. สร้าง snapshot/restore point ของ branch ต้นทาง
2. สร้าง branch ใหม่จาก restore point
3. ต่อ `DATABASE_URL_UNPOOLED` ของ drill branch และรัน `npm run db:check`
4. ตรวจตารางหลักและจำนวนแถว:

```sql
select 'courses' as table_name, count(*) from courses
union all select 'cohorts', count(*) from cohorts
union all select 'seat_reservations', count(*) from seat_reservations
union all select 'enrollments', count(*) from enrollments
union all select 'certificates', count(*) from certificates
union all select 'notification_outbox', count(*) from notification_outbox;
```

5. ชี้ Vercel Preview ไป drill branch
6. Smoke test: catalog → sign in → reservation → admin confirm → enrollment → certificate verification
7. ตรวจว่า meeting/material route ปฏิเสธผู้ใช้ที่ไม่ได้ enroll
8. รัน Cron ซ้ำสองครั้งและตรวจว่า outbox ไม่มี dedupe key ซ้ำ
9. บันทึก Recovery Time Objective ที่ทำได้จริง, ปัญหา และผู้อนุมัติผล
10. ลบ drill branch หลังหลักฐานครบ โดยไม่แตะ Production branch

## Pass criteria

- Schema journal ตรงกับ repo
- Row counts และ sample records สำคัญครบ
- Auth/session ใช้งานได้กับ restored branch
- Protected resources ไม่รั่ว
- ไม่มี notification ซ้ำหลัง cron replay
- ทีมสามารถสลับ Preview กลับ branch ปกติได้
