"""docker_provisioner.py — Autarker Docker-Stack Provisioner für die VIRKI Control Plane.

Klont das Kunden-Appliance Repository (virgi-platform-dist:main),
erzeugt dynamische Docker Compose Spezifikationen und startet den Appliance-Stack
lokal auf dem Zielserver oder der Control-Plane VM.
"""

from __future__ import annotations

import logging
import os
import subprocess
import threading
from pathlib import Path
from typing import Dict, Any

from .db import append_log, update_instance_status

log = logging.getLogger("docker_provisioner")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
if GITHUB_TOKEN:
    DIST_REPO_URL = f"https://x-access-token:{GITHUB_TOKEN}@github.com/NextChapterExperts/virgi-platform-dist.git"
else:
    DIST_REPO_URL = "https://github.com/NextChapterExperts/virgi-platform-dist.git"


def generate_install_script(
    tenant_id: str,
    company_name: str,
    web_port: int = 8190,
    api_port: int = 8191,
) -> str:
    """Generiert ein 1-Zeilen Bash Auto-Install Script für den Kunden-Server."""
    return f"""#!/bin/bash
set -e

echo "=== VIRKI AI-OS Appliance Setup (Mandant: {tenant_id}) ==="

if ! command -v docker &> /dev/null; then
    echo "📦 Installiere Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

INSTALL_DIR="$HOME/.virki_instances/{tenant_id}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ ! -d "repo" ]; then
    echo "📂 Klone VIRKI Appliance Repository..."
    git clone --branch main {DIST_REPO_URL} repo
else
    echo "🔄 Aktualisiere Repository..."
    cd repo && git pull origin main && cd ..
fi

cd repo/deploy/docker

cat << 'COMPOSEEOF' > docker-compose.yml
services:
  ai-os-core:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile
    image: virki-appliance-{tenant_id}:latest
    container_name: virki-appliance-{tenant_id}
    restart: unless-stopped
    ports:
      - "{web_port}:8090"
      - "{api_port}:8091"
    environment:
      - NODE_ENV=production
      - PORT=8090
      - HOST=0.0.0.0
      - ORCHESTRATOR_URL=http://127.0.0.1:8091
      - DATA_DIR=/app/data
      - AIOS_TENANT_ID={tenant_id}
      - AIOS_COMPANY_NAME={company_name}
    volumes:
      - virki-data-{tenant_id}:/app/data

volumes:
  virki-data-{tenant_id}:
    name: virki-data-{tenant_id}
COMPOSEEOF

echo "🚀 Starte Docker Appliance Stack (Port Web: {web_port}, API: {api_port})..."
docker compose up -d --build

echo ""
echo "======================================================================"
echo "🎉 VIRKI Core Platform erfolgreich bereitgestellt!"
echo "👉 Web-Konsole: http://localhost:{web_port}/"
echo "👉 API-Backend: http://localhost:{api_port}/"
echo "======================================================================"
"""


generate_docker_install_script = generate_install_script


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
    
    # Nutze geteilten Pfad /tmp/virki_instances falls beschreibbar, sonst Fallback auf Home
    try:
        target_dir = Path("/tmp/virki_instances") / tenant_id
        target_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        target_dir = Path.home() / ".virki_instances" / tenant_id
        target_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        append_log(instance_id, f"📂 Synchronisiere virgi-platform-dist (Branch: main)...")
        repo_dir = target_dir / "repo"
        if not (repo_dir / ".git").exists():
            subprocess.run(["git", "clone", "--branch", "main", DIST_REPO_URL, str(repo_dir)], check=True, capture_output=True, text=True)
        else:
            subprocess.run(["git", "fetch"], cwd=str(repo_dir), check=True)
            subprocess.run(["git", "checkout", "main"], cwd=str(repo_dir), check=True)
            subprocess.run(["git", "pull", "origin", "main"], cwd=str(repo_dir), check=True)
            
        append_log(instance_id, "✓ Repository erfolgreich synchronisiert.")

        docker_dir = repo_dir / "deploy" / "docker"
        append_log(instance_id, f"⚙️ Generiere Docker-Compose Konfiguration (Web: {web_port}, API: {api_port})...")

        # Dynamisches docker-compose.yml schreiben
        compose_content = f"""services:
  ai-os-core:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile
    image: virki-appliance-{tenant_id}:latest
    container_name: virki-appliance-{tenant_id}
    restart: unless-stopped
    ports:
      - "{web_port}:8090"
      - "{api_port}:8091"
    environment:
      - NODE_ENV=production
      - PORT=8090
      - HOST=0.0.0.0
      - ORCHESTRATOR_URL=http://127.0.0.1:8091
      - DATA_DIR=/app/data
      - AIOS_TENANT_ID={tenant_id}
      - AIOS_COMPANY_NAME={company_name}
    volumes:
      - virki-data-{tenant_id}:/app/data

volumes:
  virki-data-{tenant_id}:
    name: virki-data-{tenant_id}
"""
        (docker_dir / "docker-compose.yml").write_text(compose_content, encoding="utf-8")

        append_log(instance_id, "🔨 Baue und starte Docker-Container Stack...")

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
