"""docker_provisioner.py — Docker Appliance Stack Manager & One-Line Installer Generator.

Verwaltet das lokale oder Remote-Deployment von Docker Stacks aus virgi-platform-dist:main
und generiert kundenindividuelle Onboarding-Installationsskripte.
"""

from __future__ import annotations

import logging
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict

from .db import append_log, update_instance_status

log = logging.getLogger("docker_provisioner")

DIST_REPO_URL = "https://github.com/NextChapterExperts/virgi-platform-dist.git"


def generate_docker_install_script(
    tenant_id: str,
    company_name: str,
    web_port: int = 8190,
    api_port: int = 8191,
) -> str:
    """Generiert ein sofort ausführbares 1-Zeilen-Installationsskript für den Kunden."""
    return f"""#!/bin/bash
# ==============================================================================
# VIRKI AI-OS Core Appliance — Automated 1-Line Installer
# Mandant: {tenant_id} ({company_name})
# ==============================================================================

set -e

echo "🚀 Starte Installation der VIRKI AI-OS Core Platform für '{company_name}'..."

# 1. Docker & Git prüfen
command -v docker >/dev/null 2>&1 || {{ echo "❌ Docker ist nicht installiert. Bitte installieren Sie Docker zuerst."; exit 1; }}
command -v git >/dev/null 2>&1 || {{ echo "❌ Git ist nicht installiert. Bitte installieren Sie Git zuerst."; exit 1; }}

# 2. Verzeichnis anlegen
INSTALL_DIR="$HOME/virki-appliance-{tenant_id}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 3. Neuestes Core-Platform Release aus GitHub clonen
echo "📦 Lade die neueste virgi-platform-dist Distribution herunter..."
if [ -d "repo" ]; then
    cd repo && git fetch && git checkout main && git pull origin main && cd ..
else
    git clone --branch main {DIST_REPO_URL} repo
fi

# 4. Umgebungskonfiguration schreiben
cd repo/deploy/docker

cat << 'EOF' > .env
AIOS_TENANT_ID="{tenant_id}"
AIOS_COMPANY_NAME="{company_name}"
AIOS_WEB_PORT={web_port}
AIOS_API_PORT={api_port}
EOF

# 5. Docker Stack starten
echo "🐳 Baue und starte die VIRKI Core Appliance..."
docker compose up -d --build

echo ""
echo "======================================================================"
echo "🎉 VIRKI Core Platform erfolgreich bereitgestellt!"
echo "👉 Web-Konsole: http://localhost:{web_port}/"
echo "👉 API-Backend: http://localhost:{api_port}/"
echo "======================================================================"
"""


def provision_local_docker_stack_async(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    web_port: int = 8190,
    api_port: int = 8191,
) -> None:
    """Startet einen lokalen Docker Stack im Hintergrund und streamt die Logs."""
    thread = threading.Thread(
        target=_provision_local_docker_stack_worker,
        args=(instance_id, tenant_id, company_name, web_port, api_port),
        daemon=True,
    )
    thread.start()


def _provision_local_docker_stack_worker(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    web_port: int,
    api_port: int,
) -> None:
    append_log(instance_id, f"🐳 Starte Bereitstellung des Docker-Stacks für '{company_name}' (Port {web_port}/{api_port})...")
    
    target_dir = Path.home() / f".virki_instances" / tenant_id
    target_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        append_log(instance_id, f"📂 Klone {DIST_REPO_URL} (Branch: main)...")
        repo_dir = target_dir / "repo"
        if not (repo_dir / ".git").exists():
            subprocess.run(["git", "clone", "--branch", "main", DIST_REPO_URL, str(repo_dir)], check=True, capture_output=True, text=True)
        else:
            subprocess.run(["git", "fetch"], cwd=str(repo_dir), check=True)
            subprocess.run(["git", "checkout", "main"], cwd=str(repo_dir), check=True)
            subprocess.run(["git", "pull", "origin", "main"], cwd=str(repo_dir), check=True)
            
        append_log(instance_id, "✓ Repository erfolgreich synchronisiert.")

        docker_dir = repo_dir / "deploy" / "docker"
        append_log(instance_id, "🔨 Baue Docker-Container Stack (Multi-Stage Node/Python Build)...")

        # Docker Compose up
        env = os.environ.copy()
        env["AIOS_TENANT_ID"] = tenant_id
        env["AIOS_COMPANY_NAME"] = company_name
        
        proc = subprocess.Popen(
            ["docker", "compose", "up", "-d", "--build"],
            cwd=str(docker_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )

        for line in iter(proc.stdout.readline, ""):
            clean_line = line.strip()
            if clean_line:
                append_log(instance_id, f"  [docker] {clean_line}")

        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"Docker Compose beendete mit Fehlercode {proc.returncode}")

        endpoint_url = f"http://localhost:{web_port}"
        backend_url = f"http://localhost:{api_port}"
        append_log(instance_id, f"🎉 Docker Container Stack erfolgreich gestartet!")
        append_log(instance_id, f"👉 Web-Konsole: {endpoint_url}")
        append_log(instance_id, f"👉 API-Backend: {backend_url}")
        
        update_instance_status(instance_id, "running", endpoint_url=endpoint_url, backend_url=backend_url)

    except Exception as exc:
        err_msg = str(exc)
        append_log(instance_id, f"❌ Docker Bereitstellung fehlgeschlagen: {err_msg}", level="ERROR")
        update_instance_status(instance_id, "error")
