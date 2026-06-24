"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Keying on the pathname forces React to remount the subtree on every real
// route change, which retriggers the CSS fade-in below on mount. There is no
// "isNavigating" boolean to track, so back/forward navigation can't leave the
// app stuck mid-transition -- the browser's own history change is what
// drives this, the same way it already drives the route change itself.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div key={usePathname()} className="page-transition">
      {children}
    </div>
  );
}
