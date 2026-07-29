"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function OrganizationRetryButton() {
  const router = useRouter();
  return <Button variant="outline" className="min-h-11" onPress={() => router.refresh()}>ลองอีกครั้ง</Button>;
}
