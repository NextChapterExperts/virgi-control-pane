"""stripe_billing.py — Stripe Checkout & Subscription Management für die VIRKI Control Plane."""

import os
from typing import Any, Dict, List, Optional

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

PRICING_PLANS: List[Dict[str, Any]] = [
    {
        "id": "plan_sovereign_docker",
        "name": "VIRKI Souverän (Self-Hosted)",
        "type": "docker_stack",
        "price_monthly": 190.00,
        "currency": "EUR",
        "features": [
            "100% On-Premise & DSGVO-autark",
            "5-Schichten Memory Engine (L1–L5)",
            "Unternehmenssuche & PDF-Ingest",
            "Lokale Monster-Modelle (Qwen / Mistral)",
            "Self-Hosted Docker Stack",
        ],
        "popular": False,
    },
    {
        "id": "plan_managed_cloud_vm",
        "name": "VIRKI Managed Cloud VM",
        "type": "gcp_vm",
        "price_monthly": 490.00,
        "currency": "EUR",
        "features": [
            "Dedicated Google Cloud VM (Frankfurt europe-west3)",
            "Vollständig gemanagt & gewartet",
            "Automatisches tägliches Backup",
            "Frontier Reasoning (Claude 3.7 / R1 via OpenRouter)",
            "SSL/TLS & Eigene Subdomain",
            "1-Klick Flotten-Updates",
        ],
        "popular": True,
    },
    {
        "id": "plan_enterprise_cluster",
        "name": "VIRKI Enterprise Dedicated Cluster",
        "type": "gcp_vm",
        "price_monthly": 1490.00,
        "currency": "EUR",
        "features": [
            "Eigener dedizierter GPU-Inferenz-Server (A100/H100)",
            "Souveränes Frontier-Inferenz-Cluster",
            "Individuelle Fachagenten-Pipelines",
            "24/7 SLA & Enterprise Support",
            "Multi-Mandanten-Architektur",
        ],
        "popular": False,
    },
]


def list_plans() -> List[Dict[str, Any]]:
    return PRICING_PLANS


def get_plan_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    for p in PRICING_PLANS:
        if p["id"] == plan_id:
            return p
    return None


def create_checkout_session(
    plan_id: str,
    tenant_id: str,
    company_name: str,
    customer_email: str,
    success_url: str,
    cancel_url: str,
) -> Dict[str, Any]:
    plan = get_plan_by_id(plan_id)
    if not plan:
        raise ValueError(f"Ungültiger Tarif: {plan_id}")

    if not STRIPE_SECRET_KEY:
        # Mock-Checkout im Entwicklungs- / Test-Modus
        return {
            "session_id": f"mock_cs_{tenant_id}_{plan_id}",
            "checkout_url": f"{success_url}?session_id=mock_cs_{tenant_id}_{plan_id}&mock=true",
            "plan": plan,
            "status": "mock_ready",
        }

    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            payment_method_types=["card", "sepa_debit"],
            line_items=[
                {
                    "price_data": {
                        "currency": plan["currency"].lower(),
                        "product_data": {
                            "name": plan["name"],
                            "description": f"VIRKI AI-OS Subscription für {company_name}",
                        },
                        "unit_amount": int(plan["price_monthly"] * 100),
                        "recurring": {"interval": "month"},
                    },
                    "quantity": 1,
                }
            ],
            mode="subscription",
            customer_email=customer_email,
            client_reference_id=tenant_id,
            metadata={"tenant_id": tenant_id, "plan_id": plan_id, "company_name": company_name},
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return {
            "session_id": session.id,
            "checkout_url": session.url,
            "plan": plan,
            "status": "live",
        }
    except Exception as e:
        raise RuntimeError(f"Stripe Checkout Fehler: {str(e)}")
