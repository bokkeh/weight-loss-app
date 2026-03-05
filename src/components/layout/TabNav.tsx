"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Scale,
  UtensilsCrossed,
  MessageCircle,
  BookOpen,
  User,
  Menu,
  Download,
} from "lucide-react";
import { FoodLogEntry, WeightEntry } from "@/types";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/food-log", label: "Food Log", icon: UtensilsCrossed },
  { href: "/chat", label: "AI Coach", icon: MessageCircle },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
];

const profileTab = { href: "/profile", label: "Profile", icon: User };

const desktopTabs = [
  ...tabs,
  { href: "/profile", label: "Profile", icon: User },
];

export function TabNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function downloadCSV(filename: string, rows: string[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  async function handleExportCSV() {
    const [allWeight, allFood] = await Promise.all([
      fetch("/api/weight?weeks=520").then((r) => r.json()),
      fetch("/api/food-log?weeks=520").then((r) => r.json()),
    ]);
    downloadCSV("weight-log.csv", [
      ["Date", "Weight (lbs)", "Note"],
      ...(allWeight as WeightEntry[]).map((e) => [e.logged_at, String(e.weight_lbs), e.note ?? ""]),
    ]);
    downloadCSV("food-log.csv", [
      ["Date", "Food", "Meal", "Calories", "Protein(g)", "Carbs(g)", "Fat(g)", "Fiber(g)", "Serving"],
      ...(allFood as FoodLogEntry[]).map((e) => [
        e.logged_at,
        e.food_name,
        e.meal_type ?? "",
        String(e.calories),
        String(e.protein_g),
        String(e.carbs_g),
        String(e.fat_g),
        String(e.fiber_g),
        e.serving_size ?? "",
      ]),
    ]);
    setMenuOpen(false);
  }

  return (
    <>
      {/* Desktop: left sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col bg-background border-r z-50">
        <div className="px-4 py-5 border-b">
          <span className="text-lg font-bold text-primary">WeightTrack</span>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {desktopTabs.map(({ href, label, icon: Icon }) => {
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

      {/* Mobile: hamburger menu */}
      <div className="md:hidden fixed top-1 left-3 z-[60]">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shadow-sm bg-background/95">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-1">
              {[...tabs, profileTab].map(({ href, label, icon: Icon }) => {
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
              <Button
                type="button"
                variant="ghost"
                className="justify-start gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleExportCSV}
              >
                <Download className="h-4 w-4 shrink-0" />
                Export CSV
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

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
