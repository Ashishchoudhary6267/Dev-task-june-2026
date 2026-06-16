"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The original marketing/landing site was removed from this assignment base.
// `/landing` is kept only as a thin redirect so existing in-app links and the
// API 401 handler continue to resolve to the login screen.
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  );
}
