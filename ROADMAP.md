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
│ PHASE 3: SINGLE-PAGE COMMAND CENTER & LIVE-DIAGNOSE (Abgeschlossen ✓)   │
│ • Next.js Betreiber-Cockpit auf Port 8280                               │
│ • Flottentabelle mit Live-Status (RUNNING, STOPPED, BOOTSTRAP, ERROR)   │
│ • Direkt-Absprung ("🚀 Appliance öffnen") in Kunden-Plattformen        │
│ • Integriertes Live-Log Terminal unten mit Auto-Close & Copy-Button     │
│ • Instanz-Lifecycle: Pausieren, Fortsetzen, Neu starten & Löschen       │
│ • Transparente Live-Ist-Kostenberechnung (Lokal vs. GCP Cloud)          │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: CLOUD RUN CONTAINER & PROXY ROUTING (Abgeschlossen ✓)          │
│ • Serverless GCP Cloud Run Container Deployment                         │
│ • Dynamische IAM-Berechtigungsvergabe & Rollen-Prüfung                  │
│ • Authentifizierter Reverse-Proxy für Domain-Restricted-Sharing Bypass  │
│ • Automatische Echtzeit-IP-Synchronisation für GCP Compute VMs          │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: DOKUMENTATION & ARCHITEKTUR-STANDARDS (Abgeschlossen ✓)        │
│ • docs/01-CONTROL-PLANE-ARCHITEKTUR.md                                  │
│ • docs/02-PROVISIONIERUNGS-WORKFLOWS.md                                 │
│ • docs/03-SCHNITTSTELLEN-UND-API-KATALOG.md                             │
│ • docs/04-CORE-PLATFORM-INTEGRATION.md                                  │
│ • docs/05-ENTERPRISE-FLEET-HARDENING.md                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: DYNAMISCHE APPLIANCE-CONFIG & .ENV-WIZARD ENGINE (Geplant 📅)  │
│ • Provisionierungs-Wizard in Next.js Konsole (:8280) für alle Parameter │
│ • Automatische Erstellung der kundenspezifischen `.env` & Mount-Pfade   │
│ • Management von API-Keys (OpenRouter, Anthropic, OpenAI, Gemini)       │
│ • Definition von Storage- & Projekt-Volumes (lokal, NFS, Nextcloud)     │
│ • E-Mail/IMAP Konfiguration für Mail-&-Triage Fachagenten               │
│ • 2-Wege Modell-Profil (Sovereign vs. Hybrid Frontier) pro Kunde        │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 7: PRODUKTIONSREIFE, HÄRTUNG & DISASTER RECOVERY (Geplant 📅)    │
│ • Automatisierte Backup & Snapshot Engine (Postgres, Qdrant, Letta)     │
│ • Zero-Trust Mesh (WireGuard / Tailscale) — keine offenen Ports         │
│ • Custom Domains & automatisches TLS (Caddy / Let's Encrypt)            │
│ • Watchdog Daemon & Auto-Healing (30s Heartbeats + Failover)            │
│ • Hetzner Cloud Multi-Provider Driver (Günstiges KMU-Hosting ab 14 €)   │
│ • Blue/Green Zero-Downtime Updates für Plattform-Kern-Releases          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Status & Changelog

### 2026-08-15 (Phasen 1–5 abgeschlossen · 100% Tests Grün)
- **Multi-Target Provisioning:** Lokaler Docker-Stack, Serverless Google Cloud Run Container und Dedicated Google Compute Engine VMs (Frankfurt `europe-west3-a`) voll funktionsfähig.
- **Port-Kollisionsschutz:** Dynamische Inspektion belegter Docker-Ports auf dem Host zur Vermeidung von Port-Konflikten.
- **Instanz-Lifecycle:** Vollständige Unterstützung von `Pausieren` (Stop), `Fortsetzen` (Start), `Neu starten` und `Löschen` mit sofortiger asynchroner Reaktionszeit (`--async`).
- **Live-Log Drawer:** Automatisches Aufklappen des Terminals beim Starten einer Appliance, automatisches Schließen bei Erfolg (`RUNNING`) nach 2,5s und Offenbleiben bei Fehlern mit `📋 Logs kopieren`.
- **Echtzeit-Kostenkontrolle:** Transparente Berechnung der tatsächlichen Ist-Kosten auf Basis der realen Laufzeit in Euro pro Stunde.
- **Transparenter Reverse-Proxy:** Authentifiziertes Proxying für Cloud Run Container zur Umgehung von Google Workspace Domain-Restriktionen.
- **Automatische IP-Synchronisation:** Live-Abgleich geänderter Ephemeral-IPs von Google Compute VMs.
- **Master-Testsuite:** `./scripts/run-all-tests.sh` läuft zu 100% fehlerfrei (**6/6 Pytest Tests bestanden**).
- **Roadmap Phase 7:** Spezifikation der Enterprise-Härtung (Backup, DR, WireGuard, Auto-Healing, Hetzner Provider) dokumentiert.
