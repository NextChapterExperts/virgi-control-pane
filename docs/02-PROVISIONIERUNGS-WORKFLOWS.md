# docs/02-PROVISIONIERUNGS-WORKFLOWS.md — Bereitstellungs-Workflows

> **Status:** Verbindlicher Ablauf für die Bereitstellung von VIRKI Appliances

---

## 📋 1. Übersicht der Bereitstellungsarten

| Merkmal | 🐳 Lokaler Docker Stack | 🏢 Google Cloud VM | 💻 1-Line Remote Installer |
| :--- | :--- | :--- | :--- |
| **Zielsystem** | Dieser Server / Dev-Host | GCP Compute Engine (Frankfurt) | Beliebiger Kundenserver (Ubuntu/Debian) |
| **Ausführung** | Hintergrund-Thread (`docker_provisioner.py`) | Hintergrund-Thread (`gcp_provisioner.py`) | Bash-Script per `curl ... \| bash` |
| **Netzwerk/Ports** | Dynamische Localhost-Ports (8190+, 8200+) | Port 8090 (Web) & 8091 (API) auf Public IP | Einstellbare Ports auf Zielmaschine |
| **Autostart** | Docker `restart: unless-stopped` | Systemd Service `virki-appliance.service` | Docker `restart: unless-stopped` |
| **Hosting-Kosten** | 0,00 € (Lokale Ressourcen) | Abhängig vom Maschinentyp (e2-standard-4 etc.) | 0,00 € (Kundenhardware) |

---

## 🐳 2. Workflow: Lokaler Docker Stack

```
1. Client sendet POST /v1/instances/provision (type="docker_stack")
   │
   ▼
2. Control Plane prüft Port-Verfügbarkeit (_find_free_ports)
   │
   ▼
3. Erstellt Datenbank-Eintrag mit Status 'provisioning'
   │
   ▼
4. Hintergrund-Worker (_provision_local_docker_stack_worker):
   ├── Klont / synchronisiert virgi-platform-dist:main nach /tmp/virki_instances/{tenant_id}/repo
   ├── Generiert dynamisches docker-compose.yml:
   │     • container_name: virki-appliance-{tenant_id}
   │     • ports: "{web_port}:8090", "{api_port}:8091"
   │     • volume: virki-data-{tenant_id}:/app/data
   ├── Führt 'docker compose up -d --build' aus
   ├── Streamt alle Build- & Container-Logs in die Datenbank (instance_logs)
   └── Nach erfolgreichem Start: Status 'running', URLs 'http://localhost:{web_port}'
```

---

## 🏢 3. Workflow: Google Cloud Compute VM

```
1. Client sendet POST /v1/instances/provision (type="gcp_vm", zone="europe-west3-a", machine_type="e2-standard-4")
   │
   ▼
2. Erstellt Datenbank-Eintrag mit Status 'provisioning'
   │
   ▼
3. Hintergrund-Worker (_provision_gcp_vm_worker):
   ├── Erstellt Startup-Script mit:
   │     • apt-get update && apt-get install -y docker.io docker-compose-v2
   │     • git clone --branch main https://github.com/NextChapterExperts/virgi-platform-dist.git /opt/virki/app
   │     • Registriert /etc/systemd/system/virki-appliance.service
   │     • Startet 'docker compose up -d --build'
   ├── Führt 'gcloud compute instances create virki-{tenant_id}' aus
   ├── Fragt die zugewiesene öffentliche NAT-IP ab
   └── Nach Bestätigung: Status 'running', URLs 'http://{nat_ip}:8090'
```

---

## 💻 4. Workflow: 1-Line Remote Bash Installer

Für Kunden mit eigener Hardware/Root-Server generiert die Control Plane dynamisch ein maßgeschneidertes Installationsskript:

```bash
curl -sSL "http://localhost:8080/v1/install/{tenant_id}.sh?company={name}&web_port=8190&api_port=8191" | bash
```

**Was das Skript auf dem Zielserver macht:**
1. Prüft, ob Docker installiert ist (installiert Docker bei Bedarf automatisch via `get.docker.com`).
2. Erstellt das Verzeichnis `~/.virki_instances/{tenant_id}`.
3. Klont die offizielle Appliance-Distribution (`virgi-platform-dist:main`).
4. Generiert die Compose-Konfiguration mit isolierten Volumes und Portfreigaben.
5. Startet den Appliance-Stack per `docker compose up -d --build`.
