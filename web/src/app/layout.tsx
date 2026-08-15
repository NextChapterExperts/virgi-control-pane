import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "VIRKI Control Plane · Fleet & Provisioning Hub",
  description: "SaaS Management, Provisioning & Billing für VIRKI AI-OS Appliances",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <header className="border-b border-line bg-card/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-wider text-ink no-underline">
                <span className="text-xl text-signal font-extrabold">ᚢ</span>
                <span>VIRKI</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-signal/15 text-signal border border-signal/30">
                  Control Plane
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-ink-soft">
                <Link href="/" className="hover:text-ink transition-colors">
                  Flotte & Instanzen
                </Link>
                <Link href="/provision" className="hover:text-ink transition-colors">
                  + Neue Bereitstellung
                </Link>
                <Link href="/billing" className="hover:text-ink transition-colors">
                  Abrechnung & Pläne
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/provision" className="btn-primary text-xs py-1.5 px-3">
                + Instanz starten
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
