"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconServer,
  IconCpu,
  IconExternalLink,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconTerminal2,
  IconPlus,
  IconReceipt2,
  IconTrendingUp,
} from "@tabler/icons-react";

interface Instance {
  id: string;
  tenant_id: string;
  name: string;
  type: "gcp_vm" | "docker_stack";
  status: "provisioning" | "running" | "stopped" | "error";
  endpoint_url: string;
  backend_url: string;
  zone?: string;
  machine_type?: string;
  plan: "sovereign" | "managed" | "enterprise";
  created_at: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Kosten- & Preiskalkulation pro Instanz-Typ
const PLAN_REVENUE: Record<string, number> = {
  sovereign: 190.0,
  managed: 490.0,
  enterprise: 1490.0,
};

const MACHINE_COST_MONTHLY: Record<string, number> = {
  "e2-standard-4": 113.0, // GCP Frankfurt e2-std-4 + 50GB PD
  "e2-standard-8": 225.0, // GCP Frankfurt e2-std-8 + 100GB PD
  "e2-medium": 32.0,      // GCP Frankfurt e2-med + 30GB PD
};

export default function FleetDashboardPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 8000);
    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/instances`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
      }
    } catch (e) {
      console.error("Fehler beim Laden der Instanzen", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Soll die Instanz '${name}' wirklich gelöscht und gestoppt werden?`)) return;
    try {
      await fetch(`${API_BASE}/v1/instances/${id}`, { method: "DELETE" });
      loadInstances();
    } catch (e) {
      alert("Löschen fehlgeschlagen");
    }
  };

  const openLogsModal = async (id: string) => {
    setSelectedLogsId(id);
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/v1/instances/${id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs.map((l: any) => `[${new Date(l.timestamp * 1000).toLocaleTimeString()}] ${l.level}: ${l.message}`));
      }
    } catch (e) {
      setLogs(["Fehler beim Laden der Logs"]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const getInstanceCost = (inst: Instance): number => {
    if (inst.type === "docker_stack") return 0.0;
    const mType = inst.machine_type || "e2-standard-4";
    return MACHINE_COST_MONTHLY[mType] || 113.0;
  };

  const getInstanceRevenue = (inst: Instance): number => {
    return PLAN_REVENUE[inst.plan] || 490.0;
  };

  // KPIs
  const activeCount = instances.filter((i) => i.status === "running").length;
  const totalCostMonthly = instances
    .filter((i) => i.status === "running" || i.status === "provisioning")
    .reduce((acc, i) => acc + getInstanceCost(i), 0);
  const totalRevenueMonthly = instances
    .filter((i) => i.status === "running")
    .reduce((acc, i) => acc + getInstanceRevenue(i), 0);
  const totalMarginMonthly = totalRevenueMonthly - totalCostMonthly;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
            <IconServer size={28} className="text-signal" />
            Flotten- & Mandanten-Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            Zentrale Übersicht aller bereitgestellten VIRKI AI-OS Instanzen inklusive Live-Kosten, Erlösen und Direkt-Absprung.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadInstances}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
          >
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} /> Aktualisieren
          </button>
          <Link href="/provision" className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4">
            <IconPlus size={16} /> Neue Instanz bereitstellen
          </Link>
        </div>
      </div>

      {/* KPI Cards: Flotte & Kosten/Umsatz */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-line p-5 rounded-2xl">
          <span className="text-xs text-ink-soft uppercase font-bold tracking-wider">Aktive Instanzen</span>
          <div className="text-2xl sm:text-3xl font-black text-ink mt-2 flex items-baseline gap-2">
            <span>{activeCount}</span>
            <span className="text-xs text-ink-soft font-normal">/ {instances.length} Gesamt</span>
          </div>
        </div>

        <div className="bg-card border border-line p-5 rounded-2xl">
          <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1">
            <IconReceipt2 size={13} className="text-amber-500" /> Cloud-Kosten (GCP)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-500 mt-2 flex items-baseline gap-1 font-mono">
            <span>{totalCostMonthly.toFixed(2)} €</span>
            <span className="text-[11px] text-ink-soft font-normal font-sans">/ Monat</span>
          </div>
        </div>

        <div className="bg-card border border-line p-5 rounded-2xl">
          <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1">
            <IconTrendingUp size={13} className="text-emerald-500" /> SaaS-Umsatz (MRR)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2 flex items-baseline gap-1 font-mono">
            <span>{totalRevenueMonthly.toFixed(2)} €</span>
            <span className="text-[11px] text-ink-soft font-normal font-sans">/ Monat</span>
          </div>
        </div>

        <div className="bg-card border border-line p-5 rounded-2xl">
          <span className="text-xs text-ink-soft uppercase font-bold tracking-wider">Netto-Marge (Gewinn)</span>
          <div className="text-2xl sm:text-3xl font-black text-signal mt-2 flex items-baseline gap-1 font-mono">
            <span>+{totalMarginMonthly.toFixed(2)} €</span>
            <span className="text-[11px] text-ink-soft font-normal font-sans">
              ({totalRevenueMonthly > 0 ? ((totalMarginMonthly / totalRevenueMonthly) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* Instanzen Liste */}
      <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-sm text-ink">Bereitgestellte Kunden-Appliances</h2>
          <span className="text-xs text-ink-soft font-mono">Stand: Live</span>
        </div>

        {loading && instances.length === 0 ? (
          <div className="p-12 text-center text-xs text-ink-soft">
            <span className="animate-spin inline-block mr-2">⏳</span> Lade Flotten-Instanzen...
          </div>
        ) : instances.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="text-3xl">🚀</div>
            <h3 className="font-bold text-base text-ink">Noch keine Instanzen bereitgestellt</h3>
            <p className="text-xs text-ink-soft max-w-md mx-auto">
              Starten Sie die erste Google Cloud VM oder stellen Sie einen autarken Docker Container Stack bereit.
            </p>
            <Link href="/provision" className="btn-primary text-xs inline-flex items-center gap-1.5 py-2 px-4">
              <IconPlus size={16} /> Jetzt erste Instanz anlegen
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-paper/50 text-ink-soft uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-4">Mandant / Name</th>
                  <th className="py-3 px-4">Typ & Hardware</th>
                  <th className="py-3 px-4">Kosten & Erlös / Mo</th>
                  <th className="py-3 px-4">Endpunkt / URL</th>
                  <th className="py-3 px-4 text-center">Appliance Öffnen</th>
                  <th className="py-3 px-5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {instances.map((inst) => {
                  const cost = getInstanceCost(inst);
                  const rev = getInstanceRevenue(inst);
                  return (
                    <tr key={inst.id} className="hover:bg-paper/30 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap">
                        {inst.status === "running" && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-500 font-bold font-mono">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            RUNNING
                          </span>
                        )}
                        {inst.status === "provisioning" && (
                          <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold font-mono">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-spin"></span>
                            BOOTSTRAP...
                          </span>
                        )}
                        {inst.status === "error" && (
                          <span className="inline-flex items-center gap-1.5 text-danger font-bold font-mono">
                            <span className="h-2 w-2 rounded-full bg-danger"></span>
                            ERROR
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-medium text-ink">
                        <div className="font-bold text-sm text-ink">{inst.name}</div>
                        <div className="text-[11px] text-ink-soft font-mono">Mandant: {inst.tenant_id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-paper border border-line">
                          {inst.type === "gcp_vm" ? `🏢 GCP VM (${inst.machine_type || "e2-std-4"})` : "🐳 Docker Stack"}
                        </span>
                        <div className="text-[10px] text-ink-soft mt-0.5 capitalize">{inst.plan} Plan</div>
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        <div className="text-amber-500">
                          Kosten: {cost > 0 ? `-${cost.toFixed(0)} €` : "0 € (Self-Hosted)"}
                        </div>
                        <div className="text-emerald-500">
                          Erlös: +{rev.toFixed(0)} €
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        {inst.endpoint_url ? (
                          <span className="text-ink">{inst.endpoint_url}</span>
                        ) : (
                          <span className="text-ink-soft italic">Wird zugewiesen...</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {inst.endpoint_url ? (
                          <a
                            href={inst.endpoint_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 btn-primary text-xs py-1.5 px-3 rounded-lg shadow-sm"
                          >
                            <span>🚀 Öffnen</span>
                            <IconExternalLink size={13} />
                          </a>
                        ) : (
                          <span className="text-ink-soft text-[11px]">In Vorbereitung</span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => openLogsModal(inst.id)}
                          className="btn-secondary text-xs py-1.5 px-2.5 inline-flex items-center gap-1"
                          title="Logs ansehen"
                        >
                          <IconTerminal2 size={13} /> Logs
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(inst.id, inst.name)}
                          className="text-danger hover:underline text-xs py-1.5 px-2 inline-flex items-center gap-1"
                          title="Instanz löschen"
                        >
                          <IconTrash size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {selectedLogsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-line rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-line flex items-center justify-between bg-paper/60">
              <div className="flex items-center gap-2">
                <IconTerminal2 size={18} className="text-signal" />
                <h3 className="font-bold text-sm text-ink">Provisionierungs- & Server-Logs ({selectedLogsId})</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogsId(null)}
                className="text-ink-soft hover:text-ink text-sm font-bold px-2 py-1"
              >
                ✕ Schließen
              </button>
            </div>

            <div className="p-4 bg-black/90 font-mono text-xs text-emerald-400 overflow-y-auto flex-1 space-y-1">
              {loadingLogs ? (
                <div className="text-ink-soft">Lade Logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-ink-soft italic">Noch keine Logs erfasst.</div>
              ) : (
                logs.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
