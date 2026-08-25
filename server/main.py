"""main.py — FastAPI Backend für die VIRKI Control Plane.

Bietet REST-APIs für Flotten-Management, automatische Provisionierung (Lokal Docker / GCP VM),
Live-Log-Streaming und Installationsskript-Generierung.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import socket
import subprocess
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse, Response
import httpx
from pydantic import BaseModel, Field

from .db import (
    init_db,
    create_instance,
    get_instance,
    list_instances,
    update_instance_status,
    delete_instance,
    get_logs,
    append_log,
)
from .docker_provisioner import (
    generate_docker_install_script,
    provision_local_docker_stack_async,
    stop_local_docker_stack,
    start_local_docker_stack,
    delete_local_docker_stack,
)
from .gcp_provisioner import (
    provision_gcp_vm_async,
    stop_gcp_vm,
    start_gcp_vm,
    delete_gcp_vm,
    provision_gcp_cloud_run_async,
    delete_gcp_cloud_run,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("control_plane_api")

app = FastAPI(
    title="VIRKI Control Plane API",
    description="Flotten-Management und Provisionierungs-Engine für VIRKI AI-OS Appliances",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    log.info("VIRKI Control Plane DB initialisiert.")


# -----------------------------------------------------------------------------
# Pydantic Modelle
# -----------------------------------------------------------------------------

class ProvisionRequest(BaseModel):
    tenant_id: str = Field(..., description="Eindeutige Mandanten-ID, z.B. schulze-bedachungen")
    company_name: str = Field(..., description="Firmenname für das Unternehmensprofil")
    type: Literal["docker_stack", "gcp_cloud_run", "gcp_vm"] = Field(
        "docker_stack", description="Bereitstellungsziel: docker_stack, gcp_cloud_run oder gcp_vm"
    )
    zone: Optional[str] = Field("europe-west3-a", description="GCP-Zone für Cloud-VMs")
    region: Optional[str] = Field("europe-west3", description="GCP-Region für Cloud Run Container")
    machine_type: Optional[str] = Field("e2-standard-4", description="GCP-Maschinentyp")
    web_port: Optional[int] = Field(8190, description="Web-Port bei lokalem Docker-Stack")
    api_port: Optional[int] = Field(8191, description="API-Port bei lokalem Docker-Stack")


# -----------------------------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------------------------

def _get_allocated_host_ports() -> set[int]:
    """Sammelt alle belegten Ports aus laufenden Docker-Containern und der Control-Plane DB."""
    used_ports = {8080, 8090, 8091, 8280, 8190, 8191, 3000, 4000, 5432, 6333, 6334, 8888, 8283}
    
    # 1. Aus laufenden Docker-Containern via docker cli ermitteln
    try:
        res = subprocess.run(
            ["docker", "ps", "--format", "{{.Ports}}"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                for match in re.finditer(r":(\d+)->", line):
                    used_ports.add(int(match.group(1)))
    except Exception as exc:
        log.warning("Konnte Docker Ports nicht abfragen: %s", exc)

    # 2. Aus der Control Plane Datenbank ermitteln
    try:
        for inst in list_instances():
            for url_field in ["endpoint_url", "backend_url"]:
                url = inst.get(url_field) or ""
                match = re.search(r":(\d+)", url)
                if match:
                    used_ports.add(int(match.group(1)))
    except Exception as exc:
        log.warning("Konnte DB Ports nicht abfragen: %s", exc)

    return used_ports


def _find_free_ports(start_web: int = 8200, start_api: int = 8201) -> tuple[int, int]:
    """Findet dynamisch die nächsten garantierten freien Ports für eine neue Appliance."""
    used = _get_allocated_host_ports()
    
    w = max(start_web, 8200)
    a = w + 1
    
    while w in used or a in used:
        w += 2
        a = w + 1
        
    return w, a


# -----------------------------------------------------------------------------
# Endpunkte: Flotten- & Instanzen-Verwaltung
# -----------------------------------------------------------------------------

@app.get("/health")
@app.get("/v1/health")
def api_health():
    return {"status": "ok", "service": "virki-control-plane"}


@app.get("/v1/instances")
def api_list_instances():
    instances = list_instances()
    # Automatische Synchronisation der aktuellen GCP VM IPs
    for inst in instances:
        if inst.get("type") == "gcp_vm" and inst.get("status") in ["running", "stopped"]:
            try:
                vm_name = f"virki-{inst['tenant_id']}"[:63].rstrip("-")
                res = subprocess.run(
                    ["/opt/google-cloud-sdk/bin/gcloud", "compute", "instances", "describe", vm_name, "--format=json"],
                    capture_output=True, text=True, timeout=3
                )
                if res.returncode == 0:
                    info = json.loads(res.stdout)
                    status_gcp = info.get("status", "").lower()
                    nat_ip = None
                    for iface in info.get("networkInterfaces", []):
                        for access in iface.get("accessConfigs", []):
                            if "natIP" in access:
                                nat_ip = access["natIP"]
                                break
                    if nat_ip and f"http://{nat_ip}:8190" != inst.get("endpoint_url"):
                        new_status = "running" if status_gcp == "running" else "stopped"
                        update_instance_status(inst["id"], new_status, endpoint_url=f"http://{nat_ip}:8190", backend_url=f"http://{nat_ip}:8191")
                        inst["endpoint_url"] = f"http://{nat_ip}:8190"
                        inst["backend_url"] = f"http://{nat_ip}:8191"
                        inst["status"] = new_status
            except Exception:
                pass
    return {"status": "ok", "count": len(instances), "instances": instances}


@app.get("/v1/instances/{instance_id}")
def api_get_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    return {"status": "ok", "instance": inst}


@app.post("/v1/instances/provision")
def api_provision_instance(req: ProvisionRequest):
    clean_tenant = re.sub(r"[^a-z0-9]+", "-", req.tenant_id.lower()).strip("-") or "mandant"
    instance_id = f"inst_{clean_tenant}_{uuid.uuid4().hex[:6]}"
    
    if req.type == "gcp_vm":
        # Initialisiere DB-Eintrag für Cloud VM
        inst = create_instance(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            name=f"VIRKI Cloud VM ({req.company_name})",
            instance_type="gcp_vm",
            endpoint_url="",
            backend_url="",
            zone=req.zone or "europe-west3-a",
            machine_type=req.machine_type or "e2-standard-4",
        )
        provision_gcp_vm_async(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            company_name=req.company_name,
            admin_email="admin@lokal.lan",
            zone=req.zone or "europe-west3-a",
            machine_type=req.machine_type or "e2-standard-4",
        )
        return {"status": "ok", "message": "GCP VM Provisionierung gestartet", "instance": inst}

    elif req.type == "gcp_cloud_run":
        # Initialisiere DB-Eintrag für Cloud Run Container
        inst = create_instance(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            name=f"VIRKI Cloud Container ({req.company_name})",
            instance_type="gcp_cloud_run",
            endpoint_url="",
            backend_url="",
            zone=req.region or "europe-west3",
        )
        provision_gcp_cloud_run_async(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            company_name=req.company_name,
            region=req.region or "europe-west3",
        )
        return {"status": "ok", "message": "Google Cloud Run Container Bereitstellung gestartet", "instance": inst}

    else:
        # Lokaler Docker Stack mit Port-Kollisionsschutz
        start_web = req.web_port or 8190
        start_api = req.api_port or 8191
        web_port, api_port = _find_free_ports(start_web, start_api)
        
        endpoint_url = f"http://localhost:{web_port}"
        backend_url = f"http://localhost:{api_port}"
        
        inst = create_instance(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            name=f"VIRKI Docker Appliance ({req.company_name})",
            instance_type="docker_stack",
            endpoint_url=endpoint_url,
            backend_url=backend_url,
        )
        provision_local_docker_stack_async(
            instance_id=instance_id,
            tenant_id=clean_tenant,
            company_name=req.company_name,
            web_port=web_port,
            api_port=api_port,
        )
        return {"status": "ok", "message": "Docker Stack Bereitstellung gestartet", "instance": inst}


@app.post("/v1/instances/{instance_id}/pause")
def api_pause_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    
    tenant_id = inst["tenant_id"]
    if inst["type"] == "docker_stack":
        stop_local_docker_stack(tenant_id)
    elif inst["type"] == "gcp_vm":
        try:
            stop_gcp_vm(f"virki-{tenant_id}", zone=inst.get("zone") or "europe-west3-a")
        except Exception as exc:
            log.warning("GCP VM konnte nicht gestoppt werden: %s", exc)

    update_instance_status(instance_id, "stopped")
    append_log(instance_id, "⏸️ Instanz erfolgreich pausiert (gestoppt).")
    return {"status": "ok", "message": "Instanz pausiert"}


@app.post("/v1/instances/{instance_id}/start")
def api_start_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    
    tenant_id = inst["tenant_id"]
    if inst["type"] == "docker_stack":
        start_local_docker_stack(tenant_id)
    elif inst["type"] == "gcp_vm":
        try:
            start_gcp_vm(f"virki-{tenant_id}", zone=inst.get("zone") or "europe-west3-a")
        except Exception as exc:
            log.warning("GCP VM konnte nicht gestartet werden: %s", exc)

    update_instance_status(instance_id, "running")
    append_log(instance_id, "▶️ Instanz erfolgreich fortgesetzt (gestartet).")
    return {"status": "ok", "message": "Instanz gestartet"}


@app.delete("/v1/instances/{instance_id}")
def api_delete_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    
    tenant_id = inst["tenant_id"]
    # Container & Cloud Ressourcen restlos entfernen
    if inst["type"] == "docker_stack":
        delete_local_docker_stack(tenant_id)
    elif inst["type"] == "gcp_vm":
        try:
            delete_gcp_vm(f"virki-{tenant_id}", zone=inst.get("zone") or "europe-west3-a")
        except Exception as exc:
            log.warning("GCP VM konnte nicht gelöscht werden: %s", exc)
    elif inst["type"] == "gcp_cloud_run":
        try:
            delete_gcp_cloud_run(f"virki-{tenant_id}", region=inst.get("zone") or "europe-west3")
        except Exception as exc:
            log.warning("Cloud Run Service konnte nicht gelöscht werden: %s", exc)

    deleted = delete_instance(instance_id)
    return {"status": "ok", "deleted": deleted}


# -----------------------------------------------------------------------------
# Endpunkte: Logs & Streaming
# -----------------------------------------------------------------------------

@app.get("/v1/instances/{instance_id}/logs")
def api_get_instance_logs(instance_id: str, limit: int = 200):
    logs = get_logs(instance_id, limit=limit)
    return {"status": "ok", "count": len(logs), "logs": logs}


@app.get("/v1/instances/{instance_id}/logs/stream")
async def api_stream_logs(instance_id: str):
    """Server-Sent Events (SSE) Live Log Streamer."""
    async def event_generator():
        last_id = 0
        while True:
            logs = get_logs(instance_id, limit=100)
            new_logs = [l for l in logs if l.get("id", 0) > last_id]
            for entry in new_logs:
                last_id = max(last_id, entry.get("id", 0))
                yield f"data: {json.dumps(entry)}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.api_route("/v1/instances/{instance_id}/proxy", methods=["GET", "POST", "HEAD"])
@app.api_route("/v1/instances/{instance_id}/proxy/{path:path}", methods=["GET", "POST", "HEAD"])
async def api_proxy_instance(instance_id: str, request: Request, path: str = ""):
    """Authentifizierter Reverse-Proxy für Cloud Run Appliances."""
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    
    target_base = (inst.get("endpoint_url") or "").rstrip("/")
    if not target_base:
        raise HTTPException(status_code=400, detail="Keine Endpunkt-URL für diese Instanz vorhanden")
        
    target_url = f"{target_base}/{path}" if path else target_base
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}
    
    # Für Cloud Run: Google Identity Token einfügen
    if inst.get("type") == "gcp_cloud_run":
        try:
            token_res = subprocess.run(
                ["/opt/google-cloud-sdk/bin/gcloud", "auth", "print-identity-token"],
                capture_output=True, text=True, timeout=5
            )
            if token_res.returncode == 0 and token_res.stdout.strip():
                headers["Authorization"] = f"Bearer {token_res.stdout.strip()}"
        except Exception as e:
            log.warning("Konnte Identity Token für Proxy nicht erstellen: %s", e)
            
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                timeout=30.0,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers={k: v for k, v in resp.headers.items() if k.lower() not in ["content-encoding", "content-length", "transfer-encoding"]},
                media_type=resp.headers.get("content-type"),
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Proxy-Fehler beim Verbinden mit Appliance: {exc}")


@app.api_route("/_next/{path:path}", methods=["GET", "HEAD"])
async def proxy_next_static(path: str, request: Request):
    """Leitet Next.js Static Chunks für Cloud Run transparent weiter."""
    for inst in list_instances():
        if inst.get("type") == "gcp_cloud_run" and inst.get("status") == "running":
            target_url = f"{inst['endpoint_url'].rstrip('/')}/_next/{path}"
            headers = {}
            try:
                token_res = subprocess.run(
                    ["/opt/google-cloud-sdk/bin/gcloud", "auth", "print-identity-token"],
                    capture_output=True, text=True, timeout=5
                )
                if token_res.returncode == 0 and token_res.stdout.strip():
                    headers["Authorization"] = f"Bearer {token_res.stdout.strip()}"
            except Exception:
                pass
            async with httpx.AsyncClient(follow_redirects=True) as client:
                try:
                    resp = await client.get(target_url, headers=headers, timeout=15.0)
                    return Response(
                        content=resp.content,
                        status_code=resp.status_code,
                        headers={k: v for k, v in resp.headers.items() if k.lower() not in ["content-encoding", "content-length", "transfer-encoding"]},
                        media_type=resp.headers.get("content-type"),
                    )
                except Exception:
                    pass
    raise HTTPException(status_code=404, detail="Asset not found")


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"])
async def proxy_api_calls(path: str, request: Request):
    """Leitet API-Aufrufe der Next.js UI transparent an Cloud Run weiter."""
    for inst in list_instances():
        if inst.get("type") == "gcp_cloud_run" and inst.get("status") == "running":
            target_url = f"{inst['endpoint_url'].rstrip('/')}/api/{path}"
            if request.url.query:
                target_url += f"?{request.url.query}"
            headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}
            try:
                token_res = subprocess.run(
                    ["/opt/google-cloud-sdk/bin/gcloud", "auth", "print-identity-token"],
                    capture_output=True, text=True, timeout=5
                )
                if token_res.returncode == 0 and token_res.stdout.strip():
                    headers["Authorization"] = f"Bearer {token_res.stdout.strip()}"
            except Exception:
                pass
            body = await request.body()
            async with httpx.AsyncClient(follow_redirects=True) as client:
                try:
                    resp = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        content=body,
                        timeout=30.0,
                    )
                    return Response(
                        content=resp.content,
                        status_code=resp.status_code,
                        headers={k: v for k, v in resp.headers.items() if k.lower() not in ["content-encoding", "content-length", "transfer-encoding"]},
                        media_type=resp.headers.get("content-type"),
                    )
                except Exception:
                    pass
    raise HTTPException(status_code=404, detail="API route not found")
