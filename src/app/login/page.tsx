import Image from "next/image"
import Link from "next/link"

import { LoginForm } from "@/components/login-form"
import { hasGoogleOAuthCredentials } from "@/modules/identity"

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Image src="/favicon.svg" alt="" width={24} height={24} priority />
            Learning Hub
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <LoginForm
              googleEnabled={hasGoogleOAuthCredentials(process.env)}
            />
          </div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex">
        <Image
          src="/favicon.svg"
          alt=""
          width={560}
          height={560}
          className="absolute -right-24 -top-24 opacity-20"
          aria-hidden
        />
        <div className="relative mt-auto flex max-w-xl flex-col gap-4 p-12">
          <p className="text-3xl leading-tight font-semibold text-balance">
            เรียนรู้สิ่งที่อยากรู้ จากผู้สอนและชุมชนที่พร้อมเติบโตไปด้วยกัน
          </p>
          <p className="text-primary-foreground/70">
            พื้นที่เรียนรู้สำหรับทุกศาสตร์ ทุกระดับ และทุกช่วงของการเดินทาง
          </p>
        </div>
      </aside>
    </main>
  )
}
