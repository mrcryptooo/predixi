import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";

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

      {/* Scrollable content area */}
      <div className="md:pl-[220px] min-h-screen pt-14 md:pt-0 pb-[60px] md:pb-0">
        {children}
      </div>
    </>
  );
}
