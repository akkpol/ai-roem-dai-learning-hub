import { Button } from "@/components/ui/button";

export function GoogleSignInForm({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <form action="/api/auth/google" method="post">
      <Button type="submit" variant="outline" className="w-full">
        เข้าสู่ระบบด้วย Google
      </Button>
    </form>
  );
}
