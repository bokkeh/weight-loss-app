import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TabNav } from "@/components/layout/TabNav";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WeightTrack - Your Personal Weight Loss Tracker",
  description: "Track your weight, log food, chat with an AI coach, and store your favorite recipes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <TabNav />
        <PullToRefresh>
          <main className="min-h-screen md:pl-56">
            <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:max-w-4xl md:px-8 md:py-8 md:pb-8">
              {children}
            </div>
          </main>
        </PullToRefresh>
      </body>
    </html>
  );
}

