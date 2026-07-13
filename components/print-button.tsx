"use client";

export function PrintButton() {
  return <button className="print-button" type="button" onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>;
}
