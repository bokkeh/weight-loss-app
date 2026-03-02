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
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/food-log", label: "Food Log", icon: UtensilsCrossed },
  { href: "/chat", label: "AI Coach", icon: MessageCircle },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-1">
          <span className="text-lg font-bold mr-4 text-primary whitespace-nowrap">
            WeightTrack
          </span>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
