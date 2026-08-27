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


import shutil

def _get_dist_repo_url() -> str:
    """Ermittelt dynamisch die GitHub Clone URL mit Token (aus Env oder .env)."""
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        for env_file in [
            Path("/app/deploy/docker/.env"),
            Path(__file__).resolve().parent.parent / "deploy" / "docker" / ".env",
            Path(__file__).resolve().parent.parent / ".env",
        ]:
            if env_file.exists():
                for line in env_file.read_text().splitlines():
                    if line.startswith("GITHUB_TOKEN="):
                        token = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
            if token:
                break

    if token:
        return f"https://x-access-token:{token}@github.com/NextChapterExperts/virgi-platform-dist.git"
    return "https://github.com/NextChapterExperts/virgi-platform-dist.git"


def _sync_platform_repo(repo_dir: Path, instance_id: str) -> None:
    """Synchronisiert das Platform-Repository bevorzugt aus dem lokalen Release-Mirror oder via Git."""
    local_source = Path("/platform-dist")
    if not local_source.exists():
        for p in [Path("/home/peter/Projekte/1110-AI-OS-Core-Platform"), Path.cwd().parent / "1110-AI-OS-Core-Platform"]:
            if p.exists():
                local_source = p
                break
    
    if local_source.exists() and (local_source / "core").exists():
        append_log(instance_id, f"📥 Synchronisiere Plattform-Core aus lokalem Release-Mirror ({local_source})...")
        if repo_dir.exists():
            shutil.rmtree(repo_dir, ignore_errors=True)
        shutil.copytree(
            local_source,
            repo_dir,
            ignore=shutil.ignore_patterns(".venv", "venv", ".next", "node_modules", ".pytest_cache", "data", "*.log"),
            symlinks=False,
        )
        append_log(instance_id, "✓ Lokaler Release-Mirror erfolgreich synchronisiert.")
        return

    # Remote Fallback
    append_log(instance_id, "📥 Klone virgi-platform-dist aus GitHub...")
    dist_repo_url = _get_dist_repo_url()
    if not (repo_dir / ".git").exists():
        subprocess.run(["git", "clone", "--branch", "main", dist_repo_url, str(repo_dir)], check=True, capture_output=True, text=True)
    else:
        subprocess.run(["git", "-C", str(repo_dir), "pull", "origin", "main"], check=True, capture_output=True, text=True)
    append_log(instance_id, "✓ GitHub Repository erfolgreich synchronisiert.")


def generate_install_script(
    tenant_id: str,
    company_name: str,
    web_port: int = 8190,
    api_port: int = 8191,
) -> str:
    """Generiert ein 1-Zeilen Bash Auto-Install Script für den Kunden-Server."""
    dist_repo_url = _get_dist_repo_url()
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
    git clone --branch main {dist_repo_url} repo
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
    selected_skus: Optional[List[str]] = None,
) -> None:
    """Startet einen lokalen Docker Stack im Hintergrund und streamt die Logs."""
    thread = threading.Thread(
        target=_provision_local_docker_stack_worker,
        args=(instance_id, tenant_id, company_name, web_port, api_port, selected_skus),
        daemon=True,
    )
    thread.start()


def _provision_local_docker_stack_worker(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    web_port: int,
    api_port: int,
    selected_skus: Optional[List[str]] = None,
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
        repo_dir = target_dir / "repo"
        _sync_platform_repo(repo_dir, instance_id)

        # Initialisiere Kunden-Projekt-Volume mit ausgewählten SKUs
        projects_dir = target_dir / "data" / "projects"
        projects_dir.mkdir(parents=True, exist_ok=True)
        if selected_skus:
            catalog_src = Path("/home/peter/Projekte/1130-VIRKI-Agent-Platform/catalog/agents")
            for sku in selected_skus:
                sku_src = catalog_src / sku
                if sku_src.exists() and sku_src.is_dir():
                    dest = projects_dir / sku
                    shutil.copytree(sku_src, dest, dirs_exist_ok=True)
                    append_log(instance_id, f"📦 Fachagent-SKU '{sku}' in Mandanten-Volume provisioniert.")

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
      - {projects_dir}:/app/active

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


def stop_local_docker_stack(tenant_id: str) -> None:
    """Stoppt (pausiert) den laufenden Docker Container."""
    subprocess.run(["docker", "stop", f"virki-appliance-{tenant_id}"], capture_output=True, text=True)


def start_local_docker_stack(tenant_id: str) -> None:
    """Startet (reaktiviert) den pausierten Docker Container."""
    subprocess.run(["docker", "start", f"virki-appliance-{tenant_id}"], capture_output=True, text=True)


def delete_local_docker_stack(tenant_id: str) -> None:
    """Entfernt den Docker Container restlos."""
    subprocess.run(["docker", "rm", "-f", f"virki-appliance-{tenant_id}"], capture_output=True, text=True)
