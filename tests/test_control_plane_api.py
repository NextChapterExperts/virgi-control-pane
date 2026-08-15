"""test_control_plane_api.py — Master Tests für die VIRKI Control Plane."""

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server.db import init_db, get_db_connection
from server.docker_provisioner import generate_docker_install_script

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    yield


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["service"] == "virki-control-plane"


def test_instance_crud():
    # Instanzen abfragen
    res = client.get("/v1/instances")
    assert res.status_code == 200
    assert "instances" in res.json()


def test_api_instance_provision_and_list():
    # Provision Request
    payload = {
        "tenant_id": "schulze_gmbh",
        "company_name": "Schulze Bedachungen",
        "type": "docker_stack",
        "web_port": 8190,
        "api_port": 8191,
    }
    res = client.post("/v1/instances/provision", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    inst = data["instance"]
    assert "schulze-gmbh" in inst["tenant_id"]

    # Liste abfragen
    res_list = client.get("/v1/instances")
    assert res_list.status_code == 200
    items = res_list.json()["instances"]
    assert len(items) >= 1
    assert any("schulze-gmbh" in item["tenant_id"] for item in items)


def test_api_gcp_cloud_run_provision():
    payload = {
        "tenant_id": "cloud_kunde",
        "company_name": "Cloud Kunde GmbH",
        "type": "gcp_cloud_run",
        "region": "europe-west3",
    }
    res = client.post("/v1/instances/provision", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    inst = data["instance"]
    assert inst["type"] == "gcp_cloud_run"
    assert "cloud-kunde" in inst["tenant_id"]


def test_instance_pause_start_delete():
    # 1. Anlegen
    payload = {
        "tenant_id": "test_pause_mandant",
        "company_name": "Pause Test GmbH",
        "type": "docker_stack",
        "web_port": 8390,
        "api_port": 8391,
    }
    res = client.post("/v1/instances/provision", json=payload)
    assert res.status_code == 200
    inst_id = res.json()["instance"]["id"]

    # 2. Pausieren
    res_pause = client.post(f"/v1/instances/{inst_id}/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["status"] == "ok"
    
    inst = client.get(f"/v1/instances/{inst_id}").json()["instance"]
    assert inst["status"] == "stopped"

    # 3. Starten
    res_start = client.post(f"/v1/instances/{inst_id}/start")
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "ok"
    
    inst = client.get(f"/v1/instances/{inst_id}").json()["instance"]
    assert inst["status"] == "running"

    # 4. Löschen
    res_del = client.delete(f"/v1/instances/{inst_id}")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True
    
    # 5. Nicht mehr auffindbar
    assert client.get(f"/v1/instances/{inst_id}").status_code == 404


def test_install_script_generator():
    script = generate_docker_install_script(
        tenant_id="meister_koch",
        company_name="Koch Sanitär",
        web_port=8290,
        api_port=8291,
    )
    assert "#!/bin/bash" in script
    assert "virgi-platform-dist.git" in script
    assert "AIOS_TENANT_ID=meister_koch" in script
    assert "8290" in script
