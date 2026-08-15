"""main.py — FastAPI REST Backend für die VIRKI Control Plane."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from .db import (
    init_db,
    create_instance,
    get_instance,
    list_instances,
    delete_instance,
    get_logs,
    append_log,
)
from .docker_provisioner import (
    generate_docker_install_script,
    provision_local_docker_stack_async,
)
from .gcp_provisioner import (
    provision_gcp_vm_async,
    delete_gcp_vm,
)
from .stripe_billing import (
    list_plans,
    create_checkout_session,
)

app = FastAPI(
    title="VIRKI Control Plane & Fleet Hub API",
    version="1.0.0",
    description="SaaS Management, Provisioning & Billing für VIRKI AI-OS Appliances",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "virki_control_plane", "version": "1.0.0"}


# ==============================================================================
# Instanzen- & Flotten-Management
# ==============================================================================

class ProvisionRequest(BaseModel):
    tenant_id: str
    company_name: str
    admin_email: str
    type: str = "docker_stack"  # "gcp_vm" | "docker_stack"
    plan: str = "sovereign"
    zone: str = "europe-west3-a"
    machine_type: str = "e2-standard-4"
    web_port: int = 8190
    api_port: int = 8191


@app.get("/v1/instances")
def api_list_instances():
    return {"status": "ok", "instances": list_instances()}


@app.get("/v1/instances/{instance_id}")
def api_get_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
    return {"status": "ok", "instance": inst}


import socket


def _is_port_in_use(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False


def _find_free_ports(web_port: int, api_port: int) -> tuple[int, int]:
    w, a = web_port, api_port
    while _is_port_in_use(w) or _is_port_in_use(a):
        w += 2
        a += 2
    return w, a


@app.post("/v1/instances/provision")
def api_provision_instance(req: ProvisionRequest):
    instance_id = f"inst_{req.tenant_id}_{uuid.uuid4().hex[:6]}"
    
    if req.type == "gcp_vm":
        # Initialisiere DB-Eintrag
        inst = create_instance(
            instance_id=instance_id,
            tenant_id=req.tenant_id,
            name=f"VIRKI Cloud VM ({req.company_name})",
            instance_type="gcp_vm",
            endpoint_url="",
            backend_url="",
            zone=req.zone,
            machine_type=req.machine_type,
            plan=req.plan,
        )
        # Starte GCP Provisionierung im Hintergrund
        provision_gcp_vm_async(
            instance_id=instance_id,
            tenant_id=req.tenant_id,
            company_name=req.company_name,
            admin_email=req.admin_email,
            zone=req.zone,
            machine_type=req.machine_type,
        )
        return {"status": "ok", "message": "GCP VM Provisionierung gestartet", "instance": inst}

    else:
        # Lokaler oder gemanagter Docker Stack
        web_port, api_port = _find_free_ports(req.web_port, req.api_port)
        endpoint_url = f"http://localhost:{web_port}"
        backend_url = f"http://localhost:{api_port}"
        inst = create_instance(
            instance_id=instance_id,
            tenant_id=req.tenant_id,
            name=f"VIRKI Docker Appliance ({req.company_name})",
            instance_type="docker_stack",
            endpoint_url=endpoint_url,
            backend_url=backend_url,
            plan=req.plan,
        )
        provision_local_docker_stack_async(
            instance_id=instance_id,
            tenant_id=req.tenant_id,
            company_name=req.company_name,
            web_port=web_port,
            api_port=api_port,
        )
        return {"status": "ok", "message": "Docker Stack Bereitstellung gestartet", "instance": inst}


@app.delete("/v1/instances/{instance_id}")
def api_delete_instance(instance_id: str):
    inst = get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Instanz nicht gefunden")
        
    if inst["type"] == "gcp_vm":
        try:
            sanitized = inst["tenant_id"].lower().replace("_", "-")
            delete_gcp_vm(f"virki-{sanitized}", zone=inst.get("zone") or "europe-west3-a")
        except Exception:
            pass

    deleted = delete_instance(instance_id)
    return {"status": "ok", "deleted": deleted}


# ==============================================================================
# Live-Log Streaming (SSE)
# ==============================================================================

@app.get("/v1/instances/{instance_id}/logs")
def api_get_logs(instance_id: str, limit: int = 200):
    return {"status": "ok", "logs": get_logs(instance_id, limit=limit)}


@app.get("/v1/instances/{instance_id}/logs/stream")
async def api_stream_logs(instance_id: str):
    """Server-Sent Events (SSE) Stream für Live-Logs während und nach der Provisionierung."""
    async def log_generator():
        last_id = 0
        while True:
            logs = get_logs(instance_id, limit=500)
            new_logs = [l for l in logs if l["id"] > last_id]
            for l in new_logs:
                last_id = l["id"]
                yield f"data: {l['level']}: {l['message']}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


# ==============================================================================
# 1-Line Installer Download
# ==============================================================================

@app.get("/v1/install/{tenant_id}.sh", response_class=PlainTextResponse)
def api_get_install_script(tenant_id: str, company: str = "Unternehmen", web_port: int = 8190, api_port: int = 8191):
    """Gibt das personalisierte Bash-Installationsskript für den Kunden zurück."""
    return generate_docker_install_script(
        tenant_id=tenant_id,
        company_name=company,
        web_port=web_port,
        api_port=api_port,
    )


# ==============================================================================
# Abrechnung & Stripe Checkout
# ==============================================================================

class CheckoutRequest(BaseModel):
    plan_id: str
    tenant_id: str
    company_name: str
    customer_email: str
    success_url: str
    cancel_url: str


@app.get("/v1/billing/plans")
def api_list_plans():
    return {"status": "ok", "plans": list_plans()}


@app.post("/v1/billing/checkout")
def api_create_checkout(req: CheckoutRequest):
    try:
        session = create_checkout_session(
            plan_id=req.plan_id,
            tenant_id=req.tenant_id,
            company_name=req.company_name,
            customer_email=req.customer_email,
            success_url=req.success_url,
            cancel_url=req.cancel_url,
        )
        return {"status": "ok", **session}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
