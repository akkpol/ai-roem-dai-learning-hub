# Learning Hub

Learning Hub คือแพลตฟอร์ม Marketplace การเรียนรู้หลายศาสตร์ที่เชื่อมผู้เรียน ผู้สอน สถาบัน และทีมปฏิบัติการของแพลตฟอร์มเข้าด้วยกัน

โครงการกำลังอยู่ระหว่าง Clean Rebuild โดยไม่มีผู้ใช้หรือข้อมูล Production เดิมที่ต้องย้าย โค้ดปัจจุบันซึ่งสร้างจากแนวคิด AI Closed Beta ถือเป็น legacy และห้ามใช้เป็นข้อกำหนดของผลิตภัณฑ์ใหม่

## Source of truth

- [Product and system design](docs/product/PRODUCT_AND_SYSTEM_DESIGN.md)
- [Lean delivery playbook](docs/project/LEAN_DELIVERY_PLAYBOOK.md)
- [Master roadmap](docs/project/MASTER_ROADMAP.md)
- [UI delivery standard](docs/project/UI_DELIVERY_STANDARD.md)

ห้ามเริ่มฟีเจอร์ใหม่จากข้อความในโค้ด ข้อมูล demo หรือ commit เก่า หากข้อกำหนดไม่อยู่ในเอกสารต้นทาง ให้แก้และอนุมัติเอกสารก่อนพัฒนา

## Current status

เอกสารใน repository ไม่ทำหน้าที่เป็น live status เพราะทำให้ข้อมูลซ้ำและล้าสมัย
ให้ตรวจ `origin/main`, active pull request และ CI/provider evidence ของ commit
เดียวกันตาม [Lean delivery playbook](docs/project/LEAN_DELIVERY_PLAYBOOK.md)

## AI delivery control

Product Owner กำหนดผลลัพธ์และ contract ส่วน Lead เลือก slice กับ risk tier
Implementation, review fixes และ re-review ใช้ branch/PR เดียวกันเมื่อปลอดภัย
และ reuse หลักฐานของ commit เดิม ห้ามขยาย scope หรือประกาศงานว่า verified เอง
