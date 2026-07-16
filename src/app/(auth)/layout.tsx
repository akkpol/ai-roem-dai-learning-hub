import type { ReactNode } from "react";

import "./auth-form.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-shell">{children}</main>;
}
