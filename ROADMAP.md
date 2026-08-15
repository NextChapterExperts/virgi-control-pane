# ROADMAP.md — Entwicklungs-Roadmap VIRKI Control Plane

> **Verbindliche Roadmap & Entwicklungsplan für das Control Plane Betreiber-System**  
> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`

---

## 🎯 Vision & Meilensteine

Die Control Plane ist das autarke Betreiber- und Flotten-Management für alle VIRKI AI-OS Appliances.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: REPOSITORY & BACKEND PROVISIONING (Abgeschlossen ✓)            │
│ • SQLite Datenbank für Instanzen & Logs                                 │
│ • GCP Compute Engine Manager (Frankfurt europe-west3-a)                 │
│ • Lokaler Docker Stack Generator & Port-Kollisionsprüfung              │
│ • 1-Line Bash Installer Generator                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: DOCKER CONTAINERISIERUNG & AUTOSTART (Abgeschlossen ✓)         │
│ • Multi-Stage Dockerfile für Backend & Web-Konsole                      │
│ • Docker Compose Stack mit Volume Persistenz & Docker Socket            │
│ • Autostart (restart: unless-stopped & systemd Service)                  │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: SINGLE-PAGE COMMAND CENTER & DIREKT-ABSPRUNG (Abgeschlossen ✓) │
│ • Next.js Betreiber-Cockpit auf Port 8280                               │
│ • Flottentabelle mit Live-Status (RUNNING, BOOTSTRAP, ERROR)            │
│ • Direkt-Absprung ("🚀 Appliance öffnen") in Kunden-Plattformen        │
│ • Live-Log Streamer im Modal                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: DOKUMENTATION & ARCHITEKTUR-STANDARDS (Aktuell In Arbeit 🔄)   │
│ • docs/01-CONTROL-PLANE-ARCHITEKTUR.md                                  │
│ • docs/02-PROVISIONIERUNGS-WORKFLOWS.md                                 │
│ • docs/03-SCHNITTSTELLEN-UND-API-KATALOG.md                             │
│ • docs/04-CORE-PLATFORM-INTEGRATION.md                                  │
│ • Umfassendes README.md                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: ERWEITERTE FLOTTEN-METRIKEN & REMOTE-UPDATES (Geplant 📅)      │
│ • 1-Klick Software-Updates für bestehende Appliances via Git-Pull       │
│ • CPU/RAM/Disk Health-Monitoring über Heartbeat-Agenten                 │
│ • Automatisierte Backups & Snapshot-Verwaltung                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Status & Changelog

- **2026-08-15 (Phase 1–3 abgeschlossen):**
  - Repository initialisiert und auf GitHub synchronisiert.
  - Dual-Provisioning (Docker Stack vs. GCP Compute Engine) implementiert und verifiziert.
  - Single-Page Betreiber-Cockpit live auf Port 8280.
  - Master-Testsuite (`./scripts/run-all-tests.sh`) 100% grün (**5/5 Tests bestanden**).
