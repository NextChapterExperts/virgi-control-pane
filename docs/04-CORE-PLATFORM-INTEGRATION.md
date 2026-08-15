# docs/04-CORE-PLATFORM-INTEGRATION.md — Core Platform Appliance Integration

> **Ziel-Repository:** `https://github.com/NextChapterExperts/virgi-platform-dist.git` (`main`)  
> **Lokal verwaltet in:** `/home/peter/Projekte/1110-AI-OS-Core-Platform`

---

## 📦 1. Was ist die provisionierte Appliance?

Jede durch die Control Plane bereitgestellte Instanz ist eine vollständige, autarke **VIRKI AI-OS Core Platform Appliance**. Sie beinhaltet:

1. **Web-Konsole (`core/console-web` auf Port 8090 intern):**
   - Standalone Next.js 15 Anwendung mit nordischer Farbpalette (`--paper`, `--ink`, `--signal`).
   - Routen:
     - `/`: Dashboard & Systemstatus
     - `/company`: Unternehmens-Identität & Root-Profil
     - `/platform/models`: 2-Wege Compute & Model Gateway (Souverän vs. Frontier)
     - `/platform/storage`: 5-Layer Storage & Memory Health
     - `/platform/vms`: VM- und Hardware-Informationen
     - `/search`: Universelle semantische Suche im Company Brain

2. **Orchestrator Engine (`core/orchestrator` auf Port 8091 intern):**
   - FastAPI Backend für Plattform-Funktionalitäten.
   - 5-Schichten Memory Integration (L1 Working Memory, L2 Tactical Memory, L3 Curated Epistemic Graph, L4 Episodic Vector Search, L5 Letta Long-Term Agentic Memory).
   - Dynamic Model Config Store (`/v1/platform/models/config`, `/v1/platform/models/catalog`, `/v1/platform/models/test-connection`).
   - File Ingest Watcher (`core/file_ingest_watcher`) für automatisches Dokumenten-Parsing.

---

## 🔗 2. Der Direkt-Absprung ("🚀 Appliance öffnen")

In der Control Plane (`http://localhost:8280`) besitzt jede Instanz in der Flottentabelle einen Aktionsbutton **`🚀 Appliance öffnen`**.

- **Bei lokalem Docker Stack:** Verweist auf `http://localhost:{web_port}` (z.B. `http://localhost:8204`).
- **Bei GCP Compute Engine VM:** Verweist auf `http://{öffentliche_ip}:8090`.

Beim ersten Aufruf startet der Mandant mit einer sauberen Datenbank (Clean Slate) und kann im Setup-Assistenten sein Unternehmensprofil konfigurieren.
