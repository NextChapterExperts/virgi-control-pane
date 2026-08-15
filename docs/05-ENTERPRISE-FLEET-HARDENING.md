# 05-ENTERPRISE-FLEET-HARDENING.md — Produktionsreife, Flotten-Sicherheit & Disaster Recovery

> **Status:** Strategisches Architektur- & Härtungskonzept für den kommerziellen Produktivbetrieb (Roadmap Phase 7)  
> **Geltungsbereich:** VIRKI Control Plane & Alle verwalteten AI-OS Appliances

---

## 1. Executive Summary

Der aktuelle Stand der VIRKI Control Plane ist als **funktionsfähiger Prototyp** für lokale und cloud-basierte Bereitstellungen (Docker, Cloud Run, Compute Engine VM) optimiert.  
Für den **kommerziellen Verkauf an KMUs und Enterprise-Kunden** mit garantierten SLAs (99.9% Uptime) und strikter DSGVO-Compliance definiert dieses Dokument die 5 Härtungssäulen für den späteren Produktiveinsatz.

---

## 2. Die 5 Härtungssäulen

```
                               ┌────────────────────────┐
                               │  VIRKI CONTROL PLANE   │
                               └───────────┬────────────┘
                                           │
       ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
       ▼                   ▼                               ▼                   ▼
┌──────────────┐    ┌──────────────┐                ┌──────────────┐    ┌──────────────┐
│  AUTOMATED   │    │  ZERO-TRUST  │                │  AUTO-HEAL   │    │  MULTI-CLOUD │
│  BACKUP & DR │    │  MESH TUNNEL │                │  & WATCHDOG  │    │  HETZNER/GCP │
└──────────────┘    └──────────────┘                └──────────────┘    └──────────────┘
```

---

### Säule 1: Automatisierte Backups & Disaster Recovery (DR)

Jede Kunden-Appliance betreibt statusbehaftete Datenbanken (Postgres für Memory & Audit, Qdrant für Vektoren, Letta für Agenten-Zustand).

1. **Stündliche Point-in-Time Backups:**
   - Ein nativer Backup-Cronjob exportiert Postgres-Dumps und Qdrant-Snapshots via Restic in verschlüsselten Cloud-Storage (Google Cloud Storage oder S3-kompatible Storage Box).
   - AES-256 Verschlüsselung auf Client-Seite mit individuellem Mandanten-Schlüssel.
2. **1-Klick Restore & Failover:**
   - Tritt ein Hardware-Defekt oder VM-Verlust auf, stellt die Control Plane mit einem einzigen API-Aufruf eine frische Appliance bereit und zieht den letzten konsistenten Snapshot automatisch ein.
   - Recovery Time Objective (RTO): < 5 Minuten.  
   - Recovery Point Objective (RPO): max. 1 Stunde Datenversatz.

---

### Säule 2: Zero-Trust Vernetzung & Custom Domains

Im Prototyp werden Firewall-Ports direkt freigegeben. In der Enterprise-Stufe gilt: **Keine offenen Ports im öffentlichen Internet**.

1. **WireGuard / Tailscale Overlay-Mesh:**
   - Jede Kunden-VM verbindet sich über einen ausgehenden, verschlüsselten WireGuard-Tunnel mit dem Ingress-Gateway der Control Plane.
   - Öffentliche Port-Freigaben (wie 8190/8191) auf der VM entfallen vollständig.
2. **Automatisches SSL & Custom Domains (Caddy Reverse Proxy):**
   - Kunden binden eigene Domains ein (z. B. `ai.schulze-bedachungen.de` oder `portal.virki.eu`).
   - Caddy terminiert TLS mit automatischer Ausstellung und Erneuerung von Let's Encrypt / ZeroSSL Zertifikaten.

---

### Säule 3: Watchdog Daemon & Auto-Healing

1. **30-Sekunden Heartbeat Telemetrie:**
   - Ein leichtgewichtiger Monitoring-Daemon auf jeder Appliance sendet alle 30 Sekunden Statusberichte (CPU, RAM, Festplattenbelegung, Container-Health) an die Control Plane.
2. **Self-Healing:**
   - Bei Container-Abstürzen greift der lokale Systemd-Watchdog (`Restart=always`).
   - Bleibt der Heartbeat länger als 2 Minuten aus, alarmiert die Control Plane Administratoren per Webhook (Slack/E-Mail) und triggert einen automatischen VM-Restart.

---

### Säule 4: Multi-Cloud Abstraktion (Hetzner Cloud Provider)

1. **Kostenhebel für deutsche KMUs:**
   - Während Google Compute Engine VMs ca. **112,50 € / Monat** kosten, bietet Hetzner Cloud (Serverstandorte Nürnberg und Falkenstein, 100% DSGVO) dedizierte 4 vCPU / 16 GB Instanzen (z. B. CPX31) für **ca. 14,00 € / Monat**.
2. **Provider-Treiber:**
   - Die Control Plane abstrahiert Provider über ein Interface (`DockerProvider`, `GcpProvider`, `HetznerProvider`, `AwsProvider`).

---

### Säule 5: Blue/Green Zero-Downtime Releases

1. **Unterbrechungsfreie Updates:**
   - Neue Releases von `virgi-platform-dist` werden parallel zur laufenden Version gestartet.
   - Der interne Caddy-Proxy schwenkt den Traffic erst um, wenn die neue Version den internen Health-Check (`/health`) mit HTTP 200 quittiert.
   - Automatische Rollback-Logik bei Fehlern.

---

## 3. Aufwandsschätzung & Umsetzungsfahrplan

| Meilenstein | Aufgabenpakete | Geschätzter Aufwand |
| :--- | :--- | :--- |
| **M1: Backup & Restore Engine** | Restic / S3 Export Script + Postgres & Qdrant Snapshot Handler + Control Plane Restore-API | 5–8 Personentage |
| **M2: Zero-Trust & Auto-TLS** | WireGuard Mesh Setup + Caddy Custom Domain Manager mit Let's Encrypt | 4–6 Personentage |
| **M3: Heartbeat & Watchdog** | Go/Python Telemetrie-Agent auf VM + Control Plane Alerting Engine | 4–5 Personentage |
| **M4: Hetzner Cloud Treiber** | HCloud Python SDK Integration + Dynamic SSH Cloud-Init Setup | 3–4 Personentage |
| **M5: Blue/Green Deployments** | Zero-Downtime Proxy-Switching in Docker Compose | 3–4 Personentage |
