# VIRKI Control Plane — Flotten- & Provisionierungs-Zentrale

> **Zentrales Betreiber-Cockpit für die automatisierte Bereitstellung und Verwaltung souveräner VIRKI AI-OS Appliances.**  
> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`  
> **Ziel-Appliance (Plattform-Code):** `https://github.com/NextChapterExperts/virgi-platform-dist.git`

---

## 🎯 1. Zweck & Aufgabe der Control Plane

Die **VIRKI Control Plane** ist das übergeordnete Betreiber-Werkzeug. Sie dient **ausschließlich dem Plattform-Betreiber** zur Bereitstellung, Überwachung und Lebenszyklus-Steuerung aller Kunden-Appliances.

### Kernaufgaben:
1. **Dualer Provisionierungs-Orchestrator:**
   - **🐳 Lokale Bereitstellung (Docker Stack):** Startet isolierte Appliance-Container direkt auf dem Host-System mit automatischer Port-Kollisionsprüfung und getrennten Volumes (`virki-data-{tenant_id}`).
   - **🏢 Cloud-Bereitstellung (Google Cloud Compute Engine VM):** Startet dedizierte Ubuntu-VMs im Google-Rechenzentrum Frankfurt (`europe-west3-a`) mit Cloud-Init Bootstrap und Systemd-Autostart (`virki-appliance.service`).
   - **💻 1-Line Remote Installer:** Erzeugt dynamische Bash-Befehle (`curl ... | bash`) zur schlüsselfertigen Installation auf On-Premise / Kunden-Hardware.
2. **Flotten-Cockpit & Direkt-Absprung:**
   - Echtzeit-Überwachung des Status aller Mandanten (`RUNNING` 🟢, `BOOTSTRAP` ⏳, `ERROR` 🔴).
   - **`🚀 Appliance öffnen` Button:** Direkter Absprunglink in die jeweilige Web-Konsole des Mandanten.
   - **Live-Log Terminal:** Streaming von Build- und Boot-Protokollen im Modal.
3. **Mandanten-Registry & Persistenz:**
   - SQLite-Datenbank (`data/control_plane.db`) für Instanz-Metadaten, Endpunkte und Logs.

---

## 🏛️ 2. Architektur & Systemüberblick

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                VIRKI CONTROL PLANE                                      │
│               (Web-Konsole auf Port 8280 · REST-Backend auf Port 8080)                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ • Next.js Single-Page Command Center (web/src/app/page.tsx)                             │
│ • FastAPI Backend (server/main.py, db.py, docker_provisioner.py, gcp_provisioner.py)     │
│ • Docker Multi-Container Stack (deploy/docker/docker-compose.yml)                       │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
┌───────────────────────────────────────┐       ┌───────────────────────────────────────┐
│       ZIEL A: LOKALER DOCKER STACK    │       │     ZIEL B: GOOGLE CLOUD VM (GCP)     │
│   (Bare-Metal / Dev / Serverless)     │       │     (Dedicated Compute Engine VM)     │
├───────────────────────────────────────┤       ├───────────────────────────────────────┤
│ • Docker Socket Injection             │       │ • Frankfurt (europe-west3-a)          │
│ • Autarke Container-Isolierung        │       │ • Ubuntu 24.04 LTS + pd-balanced SSD  │
│ • Dynamische Ports (8190+, 8200+...)  │       │ • Systemd Autostart Service           │
│ • 0,00 € Cloud-Kosten                 │       │ • Öffentliche IP & Auto-Bootstrap     │
└───────────────────────────────────────┘       └───────────────────────────────────────┘
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │       VIRKI AI-OS CORE PLATFORM APPLIANCE     │
                    │         (virgi-platform-dist:main)            │
                    ├───────────────────────────────────────────────┤
                    │ 1. Web-Konsole (Next.js Standalone, Port 8090)│
                    │ 2. Orchestrator Engine (FastAPI, Port 8091)   │
                    │ 3. 5-Schichten Memory (L1-L5 Company Brain)   │
                    │ 4. 2-Wege Modell Gateway (Souverän vs Frontier│
                    │ 5. File Ingest Watcher & Workflow Runner      │
                    └───────────────────────────────────────────────┘
```

---

## 📂 3. Verzeichnis- & Skript-Inventar

```text
1120-VIRKI-Control-Plane/
├── server/                        # FastAPI Backend & Provisionierungs-Engine
│   ├── main.py                    # REST API Endpunkte & Port-Kollisionslogik
│   ├── db.py                      # SQLite Datenbank-Layer (Instanzen, Logs)
│   ├── docker_provisioner.py      # Docker Stack Generator & Background Worker
│   ├── gcp_provisioner.py         # Google Cloud VM Manager & Startup-Script Generator
│   ├── stripe_billing.py          # Plan-Definitionen & Checkout-Session Generator
│   └── requirements.txt           # Python Abhängigkeiten (FastAPI, Uvicorn, etc.)
│
├── web/                           # Next.js 15 Betreiber-Frontend
│   ├── src/app/page.tsx           # Single-Page Command Center (Flotte, Provisioning, Logs)
│   ├── src/app/layout.tsx         # Header & globales Layout
│   └── src/app/globals.css        # Nordische Farbpalette & Design-System
│
├── deploy/docker/                 # Container-Setup für den Control-Plane Betrieb
│   ├── Dockerfile.backend         # Python 3.11 + Docker CLI + Git
│   ├── Dockerfile.web             # Multi-Stage Node 20 Standalone Build
│   └── docker-compose.yml         # Compose-Konfiguration mit Autostart & Socket-Mount
│
├── docs/                          # Ausführliche Architektur- & Schnittstellen-Dokumentation
│   ├── 01-CONTROL-PLANE-ARCHITEKTUR.md     # System-Architektur & Sicherheitsmodell
│   ├── 02-PROVISIONIERUNGS-WORKFLOWS.md    # Detailabläufe für Docker & Cloud VMs
│   ├── 03-SCHNITTSTELLEN-UND-API-KATALOG.md# REST Endpunkte & Datenmodelle
│   └── 04-CORE-PLATFORM-INTEGRATION.md     # Zusammenspiel mit virgi-platform-dist
│
├── scripts/
│   ├── run-all-tests.sh           # Master-Testsuite (100% grün erforderlich)
│   └── start-control-plane.sh     # Lokaler Entwicklungsserver-Starter
│
├── AGENTS.md                      # Verbindlicher 6-Schritte Entwicklungs-Workflow
├── ROADMAP.md                     # Release- und Feature-Roadmap
└── README.md                      # Diese Übersicht
```

---

## 🚀 4. Start & Betrieb

### 4.1 Synchroner Betrieb im VIRKI Ökosystem (Empfohlen)
Die Control Plane ist über `systemd --user` Services nahtlos in das Gesamt-Ökosystem eingebunden:
- `aios-control-plane-backend.service` (Port 8080)
- `aios-control-plane-web.service` (Port 8280)

```bash
# Gesamtes Ökosystem inklusive Control Plane steuern
/home/peter/Projekte/1000-VIRKI-Umbrella/scripts/virki-stack.sh status
/home/peter/Projekte/1000-VIRKI-Umbrella/scripts/virki-stack.sh restart
```

- **Betreiber-Cockpit:** [`http://localhost:8280`](http://localhost:8280)
- **REST-API / Swagger Docs:** [`http://localhost:8080/docs`](http://localhost:8080/docs)

### 4.2 Manueller Start oder Docker-Container
```bash
# Manuell lokal starten
./scripts/start-control-plane.sh

# Oder im Docker-Container betreiben
cd deploy/docker && docker compose up -d
```

### 4.3 Testsuite ausführen
```bash
./scripts/run-all-tests.sh
```

---

## 📖 5. Weiterführende Dokumentation
- [Architektur & Sicherheitsmodell](docs/01-CONTROL-PLANE-ARCHITEKTUR.md)
- [Provisionierungs-Workflows (Docker & GCP)](docs/02-PROVISIONIERUNGS-WORKFLOWS.md)
- [REST-API & Schnittstellenkatalog](docs/03-SCHNITTSTELLEN-UND-API-KATALOG.md)
- [Core Platform Integration](docs/04-CORE-PLATFORM-INTEGRATION.md)
- [Entwicklungs-Roadmap](ROADMAP.md)
