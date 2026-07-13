import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-sans-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-serif-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI เริ่มได้",
    template: "%s | AI เริ่มได้",
  },
  description: "เรียน AI ให้ใช้ได้จริง ผ่านคอร์สหลายระดับและหลายเครื่องมือ",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} ${notoSerifThai.variable}`}>{children}</body>
    </html>
  );
}
