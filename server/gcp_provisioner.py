"""gcp_provisioner.py — Google Cloud Platform (VM & Cloud Run Container) Lifecycle Manager.

Verwaltet das automatisierte Erstellen, Starten und Löschen von:
1. Google Cloud Compute Engine VMs (dedizierte Ubuntu VMs mit systemd Autostart)
2. Google Cloud Run Serverless Contained Stacks (Cloud Container mit automatischer HTTPS URL)
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

import shutil

log = logging.getLogger("gcp_provisioner")

DEFAULT_PROJECT = os.environ.get("GCP_PROJECT", "strong-zephyr-505611-k4")
DEFAULT_ZONE = os.environ.get("GCP_ZONE", "europe-west3-a")
DEFAULT_REGION = os.environ.get("GCP_REGION", "europe-west3")
DEFAULT_MACHINE_TYPE = os.environ.get("GCP_MACHINE_TYPE", "e2-standard-4")


def _find_gcloud_bin() -> str:
    env_bin = os.environ.get("GCLOUD_BIN", "").strip()
    if env_bin and os.path.exists(env_bin):
        return env_bin
    
    which_bin = shutil.which("gcloud")
    if which_bin:
        return which_bin
        
    for p in [
        "/usr/bin/gcloud",
        "/usr/local/bin/gcloud",
        "/home/peter/.local/share/google-cloud-sdk/bin/gcloud",
        "/root/google-cloud-sdk/bin/gcloud",
    ]:
        if os.path.exists(p):
            return p
            
    return "gcloud"


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


def _run_gcloud(args: List[str]) -> Any:
    gcloud_bin = _find_gcloud_bin()
    env = os.environ.copy()
    sdk_bin_dir = Path(gcloud_bin).parent
    env["PATH"] = f"{sdk_bin_dir}:{env.get('PATH', '')}"

    cmd = [gcloud_bin] + args
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


# -----------------------------------------------------------------------------
# 1. Google Cloud Compute Engine VM Provisioning
# -----------------------------------------------------------------------------

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
    clean_tenant = re.sub(r"[^a-z0-9]+", "-", tenant_id.lower()).strip("-") or "mandant"
    vm_name = f"virki-{clean_tenant}"[:63].rstrip("-")
    
    dist_repo_url = _get_dist_repo_url()
    
    append_log(instance_id, f"🚀 Starte GCP Compute VM Provisionierung für Mandant '{clean_tenant}' ({company_name})...")
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
    git clone --branch main {dist_repo_url} app
fi
cd app/deploy/docker

cat << 'ENVEOF' > .env
AIOS_TENANT_ID={tenant_id}
AIOS_COMPANY_NAME="{company_name}"
AIOS_ADMIN_EMAIL="{admin_email}"
ENVEOF

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
            f"--labels=virki_tenant={clean_tenant.replace('-', '_')},managed_by=virki_control_plane",
            f"--metadata=startup-script={startup_script}",
            "--format=json",
        ]
        _run_gcloud(cmd_create)
        append_log(instance_id, "✓ VM-Instanz erfolgreich in Google Cloud angelegt.")

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
            endpoint_url = f"http://{nat_ip}:8190"
            backend_url = f"http://{nat_ip}:8191"
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


def start_gcp_vm(vm_name: str, zone: str = DEFAULT_ZONE, project: str = DEFAULT_PROJECT) -> None:
    _run_gcloud(["compute", "instances", "start", vm_name, f"--zone={zone}", f"--project={project}"])


def delete_gcp_vm(vm_name: str, zone: str = DEFAULT_ZONE, project: str = DEFAULT_PROJECT) -> None:
    _run_gcloud(["compute", "instances", "delete", vm_name, f"--zone={zone}", f"--project={project}", "--quiet"])


# -----------------------------------------------------------------------------
# 2. Google Cloud Run (Serverless Container Stack) Provisioning
# -----------------------------------------------------------------------------

def provision_gcp_cloud_run_async(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    region: str = DEFAULT_REGION,
    project: str = DEFAULT_PROJECT,
) -> None:
    """Führt das Google Cloud Run Container Deployment asynchron aus."""
    thread = threading.Thread(
        target=_provision_gcp_cloud_run_worker,
        args=(instance_id, tenant_id, company_name, region, project),
        daemon=True,
    )
    thread.start()


def _provision_gcp_cloud_run_worker(
    instance_id: str,
    tenant_id: str,
    company_name: str,
    region: str,
    project: str,
) -> None:
    clean_tenant = re.sub(r"[^a-z0-9]+", "-", tenant_id.lower()).strip("-") or "mandant"
    service_name = f"virki-{clean_tenant}"[:63].rstrip("-")
    instance_dir = Path("/tmp/virki_instances") / clean_tenant
    repo_dir = instance_dir / "repo"

    dist_repo_url = _get_dist_repo_url()
    append_log(instance_id, f"☁️ Starte Google Cloud Run Container Bereitstellung für Mandant '{clean_tenant}' ({company_name})...")
    append_log(instance_id, f"📍 Region: {region} · Projekt: {project} · Service: {service_name}")

    try:
        # 1. Repository klonen / synchronisieren
        instance_dir.mkdir(parents=True, exist_ok=True)
        _sync_platform_repo(repo_dir, instance_id)

        # Entferne eventuelle Symlinks / venv / temp Dateien vor dem Cloud Run Upload
        for item in [".venv", "venv", "node_modules", ".next", ".pytest_cache", "data"]:
            p = repo_dir / item
            if p.is_symlink() or p.is_file():
                try:
                    p.unlink(missing_ok=True)
                except Exception:
                    pass
            elif p.is_dir():
                shutil.rmtree(p, ignore_errors=True)

        # Erstelle strikte .gcloudignore
        gcloudignore_content = """
.git
.gitignore
.gcloudignore
.venv
venv
*.pyc
__pycache__
node_modules
.next
.pytest_cache
data
*.log
"""
        (repo_dir / ".gcloudignore").write_text(gcloudignore_content.strip(), encoding="utf-8")

        # Dockerfile & Entrypoint in Root-Kontext kopieren für Cloud Build
        dockerfile_src = repo_dir / "deploy" / "docker" / "Dockerfile"
        if dockerfile_src.exists():
            shutil.copy2(dockerfile_src, repo_dir / "Dockerfile")
        entrypoint_src = repo_dir / "deploy" / "docker" / "entrypoint.sh"
        if entrypoint_src.exists():
            shutil.copy2(entrypoint_src, repo_dir / "entrypoint.sh")

        # 2. Cloud Run Build & Deploy
        append_log(instance_id, f"🏗️ Erstelle und deploye Container Service '{service_name}' auf Cloud Run...")
        cmd_deploy = [
            "run", "deploy", service_name,
            f"--source={repo_dir}",
            f"--project={project}",
            f"--region={region}",
            "--allow-unauthenticated",
            "--port=8090",
            "--memory=2Gi",
            "--cpu=2",
            f"--set-env-vars=AIOS_TENANT_ID={clean_tenant},AIOS_COMPANY_NAME={company_name}",
            "--quiet",
            "--format=json",
        ]
        deploy_res = _run_gcloud(cmd_deploy)
        
        # 3. URL ermitteln
        service_url = None
        if isinstance(deploy_res, dict):
            status = deploy_res.get("status", {})
            service_url = status.get("url")
        
        if not service_url:
            info = _run_gcloud(["run", "services", "describe", service_name, f"--project={project}", f"--region={region}", "--format=json"])
            if isinstance(info, dict):
                service_url = info.get("status", {}).get("url")

        if service_url:
            append_log(instance_id, f"🎉 Cloud Run Container erfolgreich online: {service_url}")
            update_instance_status(instance_id, "running", endpoint_url=service_url, backend_url=f"{service_url}/api")
        else:
            append_log(instance_id, "✓ Service gestartet (URL wird synchronisiert).")
            update_instance_status(instance_id, "running")

    except Exception as exc:
        err_msg = str(exc)
        append_log(instance_id, f"❌ Fehler beim Cloud Run Container Deployment: {err_msg}", level="ERROR")
        update_instance_status(instance_id, "error")


def delete_gcp_cloud_run(service_name: str, region: str = DEFAULT_REGION, project: str = DEFAULT_PROJECT) -> None:
    _run_gcloud(["run", "services", "delete", service_name, f"--region={region}", f"--project={project}", "--quiet"])
