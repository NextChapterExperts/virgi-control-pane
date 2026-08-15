import "./globals.css";

export const metadata = {
  title: "VIRKI Control Plane · Command Center",
  description: "Zentrales Admin Command Center für Flotte, Provisionierung & Infrastrukturkosten",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-paper text-ink antialiased flex flex-col">
        <header className="border-b border-line bg-card/75 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5 font-bold text-base tracking-wider text-ink">
              <span className="text-xl text-signal font-extrabold">ᚢ</span>
              <span className="font-extrabold tracking-tight">VIRKI</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-signal/15 text-signal border border-signal/30">
                Admin Command Center
              </span>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-ink-soft bg-paper/60 px-3 py-1 rounded-full border border-line">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Control Plane Online</span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>

        <footer className="border-t border-line py-4 px-6 text-center text-xs text-ink-soft font-mono">
          VIRKI AI-OS Platform · Single Source of Truth Administration Cockpit
        </footer>
      </body>
    </html>
  );
}
