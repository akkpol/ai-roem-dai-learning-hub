import { Button } from "@/components/ui/button";

export function GoogleSignInForm({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <form action="/api/auth/google" method="post">
      <Button type="submit" variant="outline" className="w-full">
        ดำเนินการต่อด้วย Google
      </Button>
    </form>
  );
}
