"use client";

import { useEffect, Suspense } from "react";
import { trackEvent } from "@/lib/mixpanel";
import { usePathname, useSearchParams } from "next/navigation";

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track the initial load
  useEffect(() => {
    trackEvent("Application Loaded", {
      environment: process.env.NODE_ENV,
    });
  }, []);

  // Track every time the user navigates between pages
  useEffect(() => {
    if (pathname) {
      trackEvent("Page View", {
        page_path: pathname,
        search_params: searchParams?.toString() || ""
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsInit() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}
