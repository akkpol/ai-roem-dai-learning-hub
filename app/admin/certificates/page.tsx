export default function AdminCertificatesPage() {
  return (
    <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">CERTIFICATES</p><h1>อนุมัติและดู audit trail</h1><p>คอร์สแบบ admin approval จะรอผู้สอนตรวจ ก่อนออกใบประกาศ private</p></div></div><div className="admin-table"><div className="table-row certificate-admin-row table-head"><span>ผู้เรียน</span><span>หลักสูตร</span><span>เกณฑ์</span><span>สถานะ</span><span>การทำงาน</span></div><div className="table-row certificate-admin-row"><strong>ชลิตา วงศ์ดี</strong><span>AI Fundamentals</span><span>100 / 84 / 78</span><span><b className="status-badge">รออนุมัติ</b></span><span><button type="button">อนุมัติและออกใบประกาศ</button></span></div><div className="table-row certificate-admin-row"><strong>กาญจนา ตั้งใจเรียน</strong><span>AI Fundamentals</span><span>100 / 92 / 86</span><span><b className="status-badge" data-status="confirmed">ออกแล้ว</b></span><span><button type="button">ดู audit</button></span></div></div>
    </main>
  );
}
