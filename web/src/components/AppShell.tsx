"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredAuth, logoutUser, switchRole, AuthUser } from "@/lib/auth";
import { IconLogout, IconUserCheck, IconShieldLock } from "@tabler/icons-react";

const USER_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Suche" },
  { href: "/prototype", label: "Fachagenten" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/meetings", label: "Meetings" },
] as const;

const ADMIN_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/admin", label: "Master Cockpit" },
  { href: "/prototype", label: "Fachagenten" },
  { href: "/search", label: "Suche" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/meetings", label: "Meetings" },
  { href: "/company", label: "Unternehmen" },
  { href: "/platform", label: "Plattform" },
] as const;

function matchLength(pathname: string, href: string): number {
  if (href === "/") return pathname === "/" ? 1 : 0;
  if (pathname === href || pathname.startsWith(`${href}/`)) return href.length;
  return 0;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [theme, setTheme] = useState<"medium" | "dark" | "light">("medium");

  useEffect(() => {
    setAuth(getStoredAuth());
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("aios-theme-mode") as "medium" | "dark" | "light" | null;
      if (storedTheme) setTheme(storedTheme);
    }

    const handleAuthChange = () => {
      setAuth(getStoredAuth());
    };

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<"medium" | "dark" | "light">;
      if (customEvent.detail) setTheme(customEvent.detail);
    };

    window.addEventListener("aios-auth-changed", handleAuthChange);
    window.addEventListener("aios-theme-changed", handleThemeChange);
    return () => {
      window.removeEventListener("aios-auth-changed", handleAuthChange);
      window.removeEventListener("aios-theme-changed", handleThemeChange);
    };
  }, []);

  const switchTheme = (mode: "medium" | "dark" | "light") => {
    setTheme(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("aios-theme-mode", mode);
      window.dispatchEvent(new CustomEvent("aios-theme-changed", { detail: mode }));
    }
  };

  const isLoginPage = pathname === "/login";
  const navItems = auth?.role === "admin" ? ADMIN_NAV : USER_NAV;

  const bestMatch = navItems.reduce(
    (best, item) => {
      const len = matchLength(pathname, item.href);
      return len > best.len ? { href: item.href, len } : best;
    },
    { href: "", len: 0 },
  );

  const handleLogout = () => {
    logoutUser();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    } else {
      router.push("/login");
    }
  };

  if (isLoginPage) {
    return <main className="min-h-screen bg-[var(--paper)]">{children}</main>;
  }

  return (
    <div className="shell-bg">
      <header className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-4 px-6 pt-5 pb-2 sm:px-10">
        <div className="relative group/virki">
          <Link href="/" className="brand-mark no-underline flex items-center gap-2">
            <span className="text-xl sm:text-2xl text-signal group-hover/virki:scale-110 transition-transform font-bold" title="Wyrd-Key / Odins Raben">
              ᚢ
            </span>
            <span className="font-mystic text-2xl sm:text-3xl font-extrabold tracking-[0.16em] text-ink uppercase group-hover/virki:text-signal transition-colors">
              VIRKI
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-signal/15 text-signal border border-signal/30">
              CONTROL PLANE
            </span>
          </Link>

          {/* Odin's Ravens Story Hover Popover Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-md opacity-0 pointer-events-none group-hover/virki:opacity-100 group-hover/virki:pointer-events-auto transition-all duration-200 z-50">
            <div className="flex items-center gap-2 mb-2 border-b border-line pb-2">
              <span className="text-lg">🦅</span>
              <h4 className="font-bold text-sm text-ink m-0">VIRKI & Die Raben von Odin</h4>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed mb-2">
              Es war einmal Odin, der Gott der Weisheit, der sein Reich von der Festung <strong className="text-ink">VIRKI</strong> aus regierte. An seiner Seite dienten zwei treue Raben:
            </p>
            <ul className="text-xs text-ink-soft space-y-1 pl-1 list-none mb-2">
              <li className="flex items-start gap-1.5">
                <span>🦅</span>
                <span><strong className="text-ink">MUNINN</strong> <em>(Das Gedächtnis)</em>: Fliegt täglich aus, erfasst Mails, Chats & Wissen und bewahrt es unvergesslich auf.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span>🦅</span>
                <span><strong className="text-ink">HUGINN</strong> <em>(Der Gedanke)</em>: Blickt in die Zukunft, durchdenkt Strategien & führt autonome KI-Workflows aus.</span>
              </li>
            </ul>
            <p className="text-[11px] text-muted italic m-0 pt-1 border-t border-line/50">
              VIRKI vereint Gedächtnis, Gedanke & souveräne Kontrolle in Ihrem KI-Betriebssystem.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-right text-xs text-ink-soft">
          {/* Top-Level Theme Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-black/10 dark:bg-black/20 border border-[var(--line)] text-[10px] font-mono">
            <button
              type="button"
              onClick={() => switchTheme("medium")}
              className={`px-2 py-0.5 rounded transition ${theme === "medium" ? "bg-cyan-600 text-white font-bold" : "text-neutral-400 hover:text-white"}`}
            >
              [ Ausgewogen ]
            </button>
            <button
              type="button"
              onClick={() => switchTheme("dark")}
              className={`px-2 py-0.5 rounded transition ${theme === "dark" ? "bg-cyan-600 text-white font-bold" : "text-neutral-400 hover:text-white"}`}
            >
              [ Dunkel ]
            </button>
            <button
              type="button"
              onClick={() => switchTheme("light")}
              className={`px-2 py-0.5 rounded transition ${theme === "light" ? "bg-cyan-600 text-white font-bold" : "text-neutral-400 hover:text-white"}`}
            >
              [ Hell ]
            </button>
          </div>

          {auth ? (
            <div className="flex items-center gap-2 bg-[color-mix(in_oklab,white_85%,transparent)] border border-[var(--line)] rounded-xl px-2.5 py-1 text-xs">
              <button
                type="button"
                onClick={() => switchRole(auth.role === "admin" ? "user" : "admin")}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer text-left font-mono"
                title={`Klicken um zu ${auth.role === "admin" ? "Endanwender" : "Admin"} zu wechseln`}
              >
                <span className="font-bold text-[var(--ink)]">
                  {auth.username} [{auth.role === "admin" ? "Admin" : "Endanwender"}]
                </span>
                <span className="text-[10px] text-signal font-mono uppercase bg-signal/10 px-1 py-0.5 rounded">
                  [ Wechseln ]
                </span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost py-0.5 px-1.5 text-[11px] text-danger hover:underline inline-flex items-center cursor-pointer ml-1 font-mono"
                title="Abmelden"
              >
                [ Abmelden ]
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-ghost text-xs font-bold text-[var(--signal)] font-mono">
              [ Anmelden ]
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1700px] px-4 pb-16 sm:px-10">{children}</main>
    </div>
  );
}
