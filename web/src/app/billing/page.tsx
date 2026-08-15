"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCreditCard,
  IconCheck,
  IconShieldLock,
  IconBolt,
  IconServer,
  IconArrowRight,
} from "@tabler/icons-react";

interface PricingPlan {
  id: string;
  name: string;
  type: string;
  price_monthly: number;
  currency: string;
  features: string[];
  popular: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function BillingPlansPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/billing/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    setSelectedPlan(planId);
    try {
      const payload = {
        plan_id: planId,
        tenant_id: "demo_kunde",
        company_name: "Demo Kunde",
        customer_email: "kunde@example.com",
        success_url: window.location.origin + "/provision",
        cancel_url: window.location.href,
      };

      const res = await fetch(`${API_BASE}/v1/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e: any) {
      alert(`Checkout-Fehler: ${e.message}`);
    } finally {
      setSelectedPlan(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight flex items-center justify-center gap-3">
          <IconCreditCard size={32} className="text-signal" />
          VIRKI AI-OS Lizenzmodelle & Abonnements
        </h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          Wählen Sie das passende Bereitstellungs- und Betriebsmodell für Ihre Organisation — vom 100% DSGVO-souveränen On-Premise Stack bis zur voll gemanagten Cloud Appliance.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-ink-soft">Lade Tarife...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`rounded-3xl p-7 flex flex-col justify-between border transition-all relative ${
                p.popular
                  ? "bg-gradient-to-b from-card to-paper border-signal shadow-xl ring-2 ring-signal/30"
                  : "bg-card border-line hover:border-line-strong shadow-sm"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-signal text-white text-[10px] font-bold font-mono uppercase px-3 py-1 rounded-full shadow-md">
                  Beliebteste Wahl
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold font-mono text-ink-soft uppercase tracking-wider">
                    {p.type === "gcp_vm" ? "🏢 Cloud VM" : "🐳 Docker On-Prem"}
                  </span>
                  {p.type === "gcp_vm" ? (
                    <IconBolt size={20} className="text-signal" />
                  ) : (
                    <IconShieldLock size={20} className="text-amber-500" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-ink mb-2">{p.name}</h3>

                <div className="my-6 pb-6 border-b border-line">
                  <span className="text-4xl font-black text-ink">{p.price_monthly.toFixed(0)} €</span>
                  <span className="text-xs text-ink-soft ml-1">/ Monat zzgl. USt.</span>
                </div>

                <ul className="space-y-3 mb-8 text-xs text-ink-soft">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <IconCheck size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout(p.id)}
                disabled={selectedPlan === p.id}
                className={`w-full py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  p.popular
                    ? "btn-primary shadow-md"
                    : "btn-secondary hover:bg-paper"
                }`}
              >
                {selectedPlan === p.id ? (
                  <>
                    <span className="animate-spin">⏳</span> Erstelle Checkout...
                  </>
                ) : (
                  <>
                    <span>Jetzt buchen & starten</span>
                    <IconArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
