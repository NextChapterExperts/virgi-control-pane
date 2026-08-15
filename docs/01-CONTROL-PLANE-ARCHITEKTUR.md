# docs/01-CONTROL-PLANE-ARCHITEKTUR.md — VIRKI Control Plane Architektur

> **Status:** Standard & Single Source of Truth für die VIRKI Control Plane  
> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`  
> **Ziel-Appliance (Plattform):** `https://github.com/NextChapterExperts/virgi-platform-dist.git`

---

## 🎯 1. Zweck & Rolle der Control Plane

Die **VIRKI Control Plane** ist das **zentrale Betreiber- und Flotten-Management-System**. Sie ist die übergeordnete Steuerungsebene für den Betrieb, die automatisierte Bereitstellung (Provisionierung) und die Überwachung isolierter Kunden-Appliances (**VIRKI AI-OS Core Platforms**).

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                VIRKI CONTROL PLANE                                      │
│               (Betreiber-Cockpit auf Port 8280 · REST-API auf Port 8080)                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ • Flotten-Überwachung (Health, Status, Logs, Lifecycle)                                 │
│ • Dualer Provisionierungs-Orchestrator (Lokaler Docker Stack vs. Google Cloud VM)       │
│ • Mandanten- & Instanzen-Registry (SQLite Datenbank /app/data/control_plane.db)         │
│ • 1-Line Bash Installer Generator für On-Premise / Remote-Server                        │
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

## 🏛️ 2. Die 3 Säulen der Control Plane

### Säule 1: Flotten- & Mandanten-Verwaltung (Registry)
- **Persistenz:** SQLite-Datenbank (`server/data/control_plane.db`) mit Foreign-Key Support und Cascading Deletes.
- **Tabellen:**
  - `instances`: Speichert Mandanten-ID, Name, Typ (`docker_stack` vs. `gcp_vm`), Status (`provisioning`, `running`, `stopped`, `error`), Endpunkt-URLs, GCP-Zone, Maschinentyp und Metadaten.
  - `instance_logs`: Detaillierte Live-Log-Historie jedes Bereitstellungsschritts mit Zeitstempel und Log-Level.

### Säule 2: Dualer Deployment-Orchestrator
1. **🐳 Lokaler Docker Stack (`docker_provisioner.py`):**
   - Synchronisiert das Distributions-Repository `virgi-platform-dist:main`.
   - Generiert isolierte `docker-compose.yml` Konfigurationen mit mandantenspezifischen Container-Namen und Volume-Mounts (`virki-data-{tenant_id}`).
   - Führt automatische Port-Kollisionsprüfungen durch und weist freie Ports zu.
   - Startet die Appliance via Docker Socket (`docker compose up -d --build`).
2. **🏢 Google Cloud Compute Engine VM (`gcp_provisioner.py`):**
   - Erstellt per `gcloud compute instances create` eine dedizierte Ubuntu-VM im Google-Rechenzentrum Frankfurt (`europe-west3-a`).
   - Überträgt ein Cloud-Init Startup-Script, das Docker installiert, `virgi-platform-dist` klont, den `virki-appliance.service` Systemd-Daemon registriert und den Container-Stack startet.
   - Fragt nach dem Hochfahren die öffentliche NAT-IP ab und aktualisiert den DB-Status auf `running`.

### Säule 3: Betreiber-Oberfläche (Single-Page Command Center)
- **Next.js Web-App (`web/` auf Port 8280):**
  - **KPIs:** Schneller Überblick über alle Instanzen, aktive Container und Cloud-VMs.
  - **Provisionierungs-Wizard:** 1-Klick-Auswahl zwischen lokalem Docker-Stack und GCP VM.
  - **Direkt-Absprung:** Jeder Eintrag besitzt den Button `🚀 Appliance öffnen`, der direkt auf die Kunden-Web-Konsole (Port 8090 / 8190 / 8200 etc.) führt.
  - **Live-Log Terminal:** Modal zur Fehleranalyse und Echtzeit-Verfolgung von Docker-Builds und VM-Bootstraps.

---

## 🔒 3. Sicherheits- und Isolationsebenen

1. **Strikte Mandantentrennung:** Jeder Kunde erhält einen eigenen, isolierten Container-Stack bzw. eine eigene virtuelle Maschine.
2. **Keine geteilten Datenvolumes:** Lokale Stacks nutzen dedizierte Docker Volumes (`virki-data-{tenant_id}`), VMs nutzen isolierte persistente Disks.
3. **Autostart-Garantie:** Auf GCP-VMs sorgt der Systemd-Service `/etc/systemd/system/virki-appliance.service` dafür, dass die Plattform nach jedem VM-Reboot automatisch wieder online ist.
