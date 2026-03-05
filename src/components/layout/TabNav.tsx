"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Scale,
  UtensilsCrossed,
  MessageCircle,
  BookOpen,
  User,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/food-log", label: "Food Log", icon: UtensilsCrossed },
  { href: "/chat", label: "AI Coach", icon: MessageCircle },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: left sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col bg-background border-r z-50">
        <div className="px-4 py-5 border-b">
          <span className="text-lg font-bold text-primary">WeightTrack</span>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile: bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full px-1 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
