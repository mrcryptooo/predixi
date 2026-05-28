import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { AppFooter } from "./AppFooter";

interface PageWrapperProps {
  children: ReactNode;
}

/**
 * Shell layout:
 *   Desktop — fixed 220px sidebar left, content offset right.
 *   Mobile  — fixed MobileHeader top (h-14) + fixed BottomNav bottom (h-[60px]).
 *             Content padded top/bottom accordingly.
 */
export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top header */}
      <MobileHeader />

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Scrollable content area.
           Mobile: top offset = MobileHeader (56px) + safe-area-top (via pt-safe-header)
                   bottom offset = BottomNav (60px) + safe-area-bottom (via pb-safe-nav)
           Desktop: sidebar handles layout — no top/bottom offset needed. */}
      <div className="md:pl-[220px] min-h-screen pt-safe-header md:pt-0 pb-safe-nav md:pb-0 flex flex-col">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
    </>
  );
}
