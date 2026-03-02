"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        e.preventDefault();
        setPullDistance(Math.min(delta * 0.5, THRESHOLD + 20));
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        router.refresh();
        await new Promise((r) => setTimeout(r, 1000));
        setRefreshing(false);
      }
      setPullDistance(0);
      startY.current = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, router]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const ready = pullDistance >= THRESHOLD;
  const visible = pullDistance > 4 || refreshing;

  return (
    <>
      {/* Pull indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-all"
        style={{ height: refreshing ? 52 : pullDistance > 0 ? pullDistance : 0 }}
      >
        {visible && (
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full bg-background border shadow-sm"
            style={{ opacity: refreshing ? 1 : progress }}
          >
            <RefreshCw
              className="h-4 w-4 text-primary"
              style={{
                transform: refreshing ? undefined : `rotate(${progress * 240}deg)`,
                animation: refreshing ? "spin 0.8s linear infinite" : undefined,
              }}
            />
          </div>
        )}
      </div>
      {/* Push content down while pulling */}
      <div style={{ marginTop: refreshing ? 52 : pullDistance > 0 ? pullDistance : 0, transition: pullDistance === 0 ? "margin-top 0.2s ease" : undefined }}>
        {children}
      </div>
    </>
  );
}
