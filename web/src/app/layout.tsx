"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconServer, IconPlus, IconCreditCard } from "@tabler/icons-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Flotte & Instanzen", icon: IconServer },
    { href: "/provision", label: "Bereitstellung", icon: IconPlus },
    { href: "/billing", label: "Tarife & Abrechnung", icon: IconCreditCard },
  ];

  return (
    <html lang="de">
      <body className="min-h-screen bg-paper text-ink antialiased flex flex-col">
        <header className="border-b border-line bg-card/75 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-wider text-ink no-underline group">
              <span className="text-xl text-signal font-extrabold transition-transform group-hover:scale-110">ᚢ</span>
              <span className="font-extrabold tracking-tight">VIRKI</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-signal/15 text-signal border border-signal/30">
                Control Plane
              </span>
            </Link>

            {/* Main Navigation with Active Route Indicators */}
            <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-paper/60 border border-line">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-card text-ink shadow-sm border border-line-strong font-semibold"
                        : "text-ink-soft hover:text-ink hover:bg-card/40"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-signal" : "opacity-70"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Quick Status Pill */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-ink-soft bg-paper/40 px-3 py-1 rounded-full border border-line">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Hub Online</span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>

        <footer className="border-t border-line py-4 px-6 text-center text-xs text-ink-soft">
          VIRKI AI-OS Platform · Single Source of Truth Control Plane
        </footer>
      </body>
    </html>
  );
}
