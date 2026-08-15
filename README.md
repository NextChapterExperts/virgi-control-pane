# VIRKI Control Plane — Fleet, Deployment & Billing Hub

> **Souveräner SaaS- & Bereitstellungs-Hub für VIRKI AI-OS Appliances**  
> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`  
> **Ziel-Appliance:** `https://github.com/NextChapterExperts/virgi-platform-dist.git`

---

## 🏛️ Architektur

Die **VIRKI Control Plane** ist das übergeordnete Steuerungs-, Flotten- und Abrechnungs-Portal zur automatisierten Bereitstellung und Wartung von Kunden-Instanzen:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VIRKI CONTROL PLANE & FLEET HUB                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. KUNDEN- & ONBOARDING-PORTAL                                              │
│    • Bezahlseite / Checkout (Stripe Subscriptions)                          │
│    • Mandantenverwaltung & Lizenzierung                                     │
│                                                                             │
│ 2. DUALER DEPLOYMENT-ORCHESTRATOR                                           │
│    ├── Option A: 🏢 Dedicated Google Cloud VM (GCP Compute Engine API)      │
│    └── Option B: 🐳 Managed Docker Appliance (Lokal / On-Prem / Cloud)      │
│                                                                             │
│ 3. LIVE LOG-STREAMER & FLOTTEN-MONITORING                                   │
│    • Live-Logs aller laufenden Instanzen (SSE / WebSocket)                  │
│    • 1-Klick-Updates (Zieht virgi-platform-dist:main aus GitHub)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Verzeichnisstruktur

```text
1120-VIRKI-Control-Plane/
├── server/                    # FastAPI Backend (GCP Manager, Docker Generator, Stripe)
│   ├── gcp_provisioner.py     # GCP Compute Engine Lifecycle (Create, Stop, Delete, SSH)
│   ├── docker_provisioner.py  # Docker Appliance Stack Generator & Installer
│   ├── stripe_billing.py      # Stripe Checkout & Webhook Lifecycle
│   ├── log_streamer.py        # Live-Log Streaming Service
│   └── main.py                # REST API Endpunkte
├── web/                       # Next.js Management Konsole & Bezahlseite
│   ├── src/app/instances/     # Flotten-Übersicht & Instanz-Details
│   ├── src/app/provision/     # Wizard: Neue VM oder Docker-Stack anlegen
│   ├── src/app/logs/          # Live-Log Streaming Konsole
│   └── src/app/billing/       # Stripe Checkout & Pläne
├── scripts/
│   ├── run-all-tests.sh       # Master-Testsuite
│   └── start-control-plane.sh # Lokaler Dev-Starter
└── README.md
```
