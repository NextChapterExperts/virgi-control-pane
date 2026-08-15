"""gcp_provisioner.py — Google Cloud Platform VM Lifecycle Manager für die Control Plane.

Erstellt, startet, stoppt und löscht dedizierte Compute Engine VMs,
die direkt aus dem Kunden-Appliance Repository (virgi-platform-dist:main) provisioniert werden.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .db import append_log, update_instance_status

log = logging.getLogger("gcp_provisioner")

GCLOUD_BIN = os.environ.get("GCLOUD_BIN", "/home/peter/.local/share/google-cloud-sdk/bin/gcloud")
DEFAULT_PROJECT = os.environ.get("GCP_PROJECT", "strong-zephyr-505611-k4")
DEFAULT_ZONE = os.environ.get("GCP_ZONE", "europe-west3-a")
DEFAULT_MACHINE_TYPE = os.environ.get("GCP_MACHINE_TYPE", "e2-standard-4")
DIST_REPO_URL = "https://github.com/NextChapterExperts/virgi-platform-dist.git"


def _run_gcloud(args: List[str]) -> Any:
    env = os.environ.copy()
    sdk_bin_dir = Path(GCLOUD_BIN).parent
    env["PATH"] = f"{sdk_bin_dir}:{env.get('PATH', '')}"

    cmd = [GCLOUD_BIN] + args
    log.info("Running gcloud command: %s", " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if res.returncode != 0:
        err = res.stderr.strip() or res.stdout.strip()
        log.error("gcloud error: %s", err)
        raise RuntimeError(f"gcloud Fehler: {err}")

    output = res.stdout.strip()
    if not output:
        return {}
    try:
        return json.loads(output)
    except Exception:
        return output


def provision_gcp_vm_async(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    admin_email: str,
    zone: str = DEFAULT_ZONE,
    machine_type: str = DEFAULT_MACHINE_TYPE,
    project: str = DEFAULT_PROJECT,
) -> None:
    """Führt die GCP VM-Erstellung in einem Hintergrund-Thread aus und loggt jeden Schritt."""
    thread = threading.Thread(
        target=_provision_gcp_vm_worker,
        args=(instance_id, tenant_id, company_name, admin_email, zone, machine_type, project),
        daemon=True,
    )
    thread.start()


def _provision_gcp_vm_worker(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    admin_email: str,
    zone: str,
    machine_type: str,
    project: str,
) -> None:
    sanitized = re.sub(r"[^a-z0-9\-]", "", tenant_id.lower().replace("_", "-"))
    vm_name = f"virki-{sanitized}"
    
    append_log(instance_id, f"🚀 Starte GCP Compute VM Provisionierung für Mandant '{tenant_id}' ({company_name})...")
    append_log(instance_id, f"📍 Zone: {zone} · Maschinentyp: {machine_type} · Projekt: {project}")

    # Startup-Script: Klont virgi-platform-dist:main, richtet systemd Autostart ein und startet Docker-Stack
    startup_script = f"""#!/bin/bash
set -e
exec > >(tee -a /var/log/virki-startup.log) 2>&1
echo "=== VIRKI AI-OS Auto-Bootstrap (Mandant: {tenant_id}) ==="
apt-get update && apt-get install -y git curl docker.io docker-compose-v2
systemctl enable --now docker

mkdir -p /opt/virki
cd /opt/virki
if [ ! -d "app" ]; then
    git clone --branch main {DIST_REPO_URL} app
fi
cd app/deploy/docker

cat << 'ENVEOF' > .env
AIOS_TENANT_ID={tenant_id}
AIOS_COMPANY_NAME="{company_name}"
AIOS_ADMIN_EMAIL="{admin_email}"
ENVEOF

# Systemd Autostart-Service für jeden VM-Start / Reboot einrichten
cat << 'SERVICE_EOF' > /etc/systemd/system/virki-appliance.service
[Unit]
Description=VIRKI AI-OS Core Appliance Docker Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/virki/app/deploy/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable virki-appliance.service

docker compose up -d --build
echo "=== VIRKI Appliance erfolgreich gestartet und Autostart registriert (Port 8090/8091) ==="
"""

    try:
        # 1. VM anlegen
        append_log(instance_id, f"📦 Erstelle Compute Engine Instanz '{vm_name}'...")
        cmd_create = [
            "compute", "instances", "create", vm_name,
            f"--project={project}",
            f"--zone={zone}",
            f"--machine-type={machine_type}",
            "--image-family=ubuntu-2404-lts-amd64",
            "--image-project=ubuntu-os-cloud",
            "--boot-disk-size=50GB",
            "--boot-disk-type=pd-balanced",
            "--tags=http-server,https-server,virki-appliance",
            f"--labels=virki_tenant={sanitized},managed_by=virki_control_plane",
            f"--metadata=startup-script={startup_script}",
            "--format=json",
        ]
        _run_gcloud(cmd_create)
        append_log(instance_id, "✓ VM-Instanz erfolgreich in Google Cloud angelegt.")

        # 2. Öffentliche IP abfragen
        time.sleep(3)
        append_log(instance_id, "🔍 Ermittle öffentliche IP-Adresse...")
        info = _run_gcloud(["compute", "instances", "describe", vm_name, f"--project={project}", f"--zone={zone}", "--format=json"])
        
        nat_ip = None
        if isinstance(info, dict):
            for iface in info.get("networkInterfaces", []):
                for access in iface.get("accessConfigs", []):
                    if "natIP" in access:
                        nat_ip = access["natIP"]
                        break

        if nat_ip:
            endpoint_url = f"http://{nat_ip}:8090"
            backend_url = f"http://{nat_ip}:8091"
            append_log(instance_id, f"🌐 Öffentliche IP zugewiesen: {nat_ip}")
            append_log(instance_id, f"🎉 VIRKI Appliance erreichbar unter: {endpoint_url}")
            update_instance_status(instance_id, "running", endpoint_url=endpoint_url, backend_url=backend_url)
        else:
            append_log(instance_id, "⚠️ Keine öffentliche IP gefunden. VM läuft im privaten Subnetz.", level="WARNING")
            update_instance_status(instance_id, "running")

    except Exception as exc:
        err_msg = str(exc)
        append_log(instance_id, f"❌ Fehler bei der GCP VM Provisionierung: {err_msg}", level="ERROR")
        update_instance_status(instance_id, "error")


def stop_gcp_vm(vm_name: str, zone: str = DEFAULT_ZONE, project: str = DEFAULT_PROJECT) -> None:
    _run_gcloud(["compute", "instances", "stop", vm_name, f"--zone={zone}", f"--project={project}"])


def delete_gcp_vm(vm_name: str, zone: str = DEFAULT_ZONE, project: str = DEFAULT_PROJECT) -> None:
    _run_gcloud(["compute", "instances", "delete", vm_name, f"--zone={zone}", f"--project={project}", "--quiet"])
