"""test_control_plane_api.py — Unit & API Tests für die VIRKI Control Plane."""

import pytest
from fastapi.testclient import TestClient
from server.main import app
from server.db import init_db, create_instance, list_instances, get_instance, delete_instance
from server.docker_provisioner import generate_docker_install_script
from server.stripe_billing import list_plans, get_plan_by_id, create_checkout_session

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_cp.db"
    monkeypatch.setattr("server.db.DB_PATH", test_db)
    monkeypatch.setattr("server.db.DB_DIR", tmp_path)
    init_db()


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "virki_control_plane"


def test_instance_crud():
    # 1. Erstellen
    inst = create_instance(
        instance_id="test-inst-1",
        tenant_id="acme",
        name="ACME Corp Appliance",
        instance_type="docker_stack",
        endpoint_url="http://localhost:8190",
        backend_url="http://localhost:8191",
        plan="sovereign",
    )
    assert inst["id"] == "test-inst-1"
    assert inst["status"] == "provisioning"

    # 2. Auslesen
    fetched = get_instance("test-inst-1")
    assert fetched is not None
    assert fetched["name"] == "ACME Corp Appliance"

    # 3. Auflisten
    all_inst = list_instances()
    assert len(all_inst) == 1
    assert all_inst[0]["tenant_id"] == "acme"

    # 4. Löschen
    assert delete_instance("test-inst-1") is True
    assert get_instance("test-inst-1") is None


def test_api_instance_provision_and_list():
    # Provisionierung anstoßen
    payload = {
        "tenant_id": "schulze_gmbh",
        "company_name": "Schulze Bedachungen",
        "admin_email": "info@schulze-bedachung.de",
        "type": "docker_stack",
        "plan": "sovereign",
        "web_port": 8190,
        "api_port": 8191,
    }
    res = client.post("/v1/instances/provision", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    inst = data["instance"]
    assert "schulze_gmbh" in inst["tenant_id"]

    # Liste abfragen
    res_list = client.get("/v1/instances")
    assert res_list.status_code == 200
    items = res_list.json()["instances"]
    assert len(items) >= 1
    assert items[0]["tenant_id"] == "schulze_gmbh"


def test_install_script_generator():
    script = generate_docker_install_script(
        tenant_id="meister_koch",
        company_name="Koch Sanitär",
        web_port=8290,
        api_port=8291,
    )
    assert "#!/bin/bash" in script
    assert "virgi-platform-dist.git" in script
    assert "AIOS_TENANT_ID=\"meister_koch\"" in script
    assert "AIOS_WEB_PORT=8290" in script


def test_billing_plans_and_mock_checkout():
    plans = list_plans()
    assert len(plans) == 3
    assert any(p["id"] == "plan_sovereign_docker" for p in plans)
    assert any(p["id"] == "plan_managed_cloud_vm" for p in plans)

    # API Endpoint Check
    res = client.get("/v1/billing/plans")
    assert res.status_code == 200
    assert len(res.json()["plans"]) == 3

    # Mock Checkout
    checkout = create_checkout_session(
        plan_id="plan_managed_cloud_vm",
        tenant_id="nextchapter",
        company_name="NextChapter Experts",
        customer_email="admin@nextchapter.de",
        success_url="http://localhost:3000/success",
        cancel_url="http://localhost:3000/cancel",
    )
    assert checkout["status"] == "mock_ready"
    assert "session_id" in checkout
    assert "checkout_url" in checkout
