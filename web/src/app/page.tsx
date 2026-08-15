"use client";

import React, { useEffect, useState } from "react";
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
  IconCalculator,
  IconShieldLock,
  IconBolt,
  IconChevronDown,
  IconChevronUp,
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

// Kosten- & Preiskalkulation
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

export default function SinglePageCommandCenter() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form states für Provisionierung
  const [showProvisionForm, setShowProvisionForm] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [deployType, setDeployType] = useState<"gcp_vm" | "docker_stack">("gcp_vm");
  const [plan, setPlan] = useState<"sovereign" | "managed" | "enterprise">("managed");
  const [zone, setZone] = useState("europe-west3-a");
  const [machineType, setMachineType] = useState("e2-standard-4");
  const [webPort, setWebPort] = useState(8190);
  const [apiPort, setApiPort] = useState(8191);
  const [provisioning, setProvisioning] = useState(false);
  const [oneLineScript, setOneLineScript] = useState<string | null>(null);

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

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !companyName) {
      alert("Bitte Mandanten-ID und Firmenname angeben.");
      return;
    }

    setProvisioning(true);
    try {
      const payload = {
        tenant_id: tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        company_name: companyName,
        admin_email: adminEmail || "admin@example.com",
        type: deployType,
        plan,
        zone,
        machine_type: machineType,
        web_port: Number(webPort),
        api_port: Number(apiPort),
      };

      const res = await fetch(`${API_BASE}/v1/instances/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Fehler beim Starten der Bereitstellung");
      
      // Form zurücksetzen und Liste neu laden
      setTenantId("");
      setCompanyName("");
      setAdminEmail("");
      setShowProvisionForm(false);
      loadInstances();
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handleFetchOneLineInstaller = () => {
    if (!tenantId) {
      alert("Bitte zuerst eine Mandanten-ID eingeben.");
      return;
    }
    const cleanTenant = tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const script = `curl -sSL "${API_BASE}/v1/install/${cleanTenant}.sh?company=${encodeURIComponent(companyName || "Kunde")}&web_port=${webPort}&api_port=${apiPort}" | bash`;
    setOneLineScript(script);
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
    <div className="space-y-10">
      {/* Top Banner & KPI Bar */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              <IconServer size={28} className="text-signal" />
              Flotten- & Provisionierungs-Zentrale
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Live-Überwachung aller Kunden-Appliances, Direkt-Bereitstellung und transparente Infrastrukturkosten.
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
            <button
              type="button"
              onClick={() => setShowProvisionForm(!showProvisionForm)}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 shadow-sm"
            >
              {showProvisionForm ? <IconChevronUp size={16} /> : <IconPlus size={16} />}
              <span>{showProvisionForm ? "Formular schließen" : "+ Instanz bereitstellen"}</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
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
      </div>

      {/* SEKTIOM 1: Provisionierungs-Formular (Direkt integriert) */}
      {showProvisionForm && (
        <div className="bg-card border-2 border-signal/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <IconPlus size={20} className="text-signal" /> Neue Kunden-Appliance provisionieren
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Stellen Sie eine neue Google Cloud VM oder einen autarken Docker Container Stack bereit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProvisionForm(false)}
              className="text-xs text-ink-soft hover:text-ink"
            >
              ✕ Schließen
            </button>
          </div>

          <form onSubmit={handleProvisionSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Mandanten-ID (Identifier)*</label>
                <input
                  type="text"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="z.B. meister-schulze"
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Firmenname*</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="z.B. Schulze Bedachungen GmbH"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Admin E-Mail</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@kunde.de"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Switch: GCP VM vs Docker Stack */}
            <div>
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Bereitstellungs-Infrastruktur
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDeployType("gcp_vm");
                    setPlan("managed");
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    deployType === "gcp_vm"
                      ? "bg-signal/10 border-signal ring-2 ring-signal/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-signal uppercase">🏢 Google Cloud VM</span>
                    {deployType === "gcp_vm" && <IconCheck size={16} className="text-signal" />}
                  </div>
                  <p className="text-xs text-ink-soft">
                    Dedizierte Compute Engine VM in Frankfurt (europe-west3) mit Autostart & fester IP.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeployType("docker_stack");
                    setPlan("sovereign");
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    deployType === "docker_stack"
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-amber-500 uppercase">🐳 Docker Stack</span>
                    {deployType === "docker_stack" && <IconCheck size={16} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-ink-soft">
                    Autarker Container-Stack (0 € Cloud-Kosten) für den lokalen Server oder On-Premise.
                  </p>
                </button>
              </div>
            </div>

            {/* Hardware Optionen */}
            {deployType === "gcp_vm" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">GCP Zone</label>
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  >
                    <option value="europe-west3-a">europe-west3-a (Frankfurt)</option>
                    <option value="europe-west3-b">europe-west3-b (Frankfurt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Maschinentyp</label>
                  <select
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  >
                    <option value="e2-standard-4">e2-standard-4 (4 vCPU, 16 GB RAM) — 113 €/Mo</option>
                    <option value="e2-standard-8">e2-standard-8 (8 vCPU, 32 GB RAM) — 225 €/Mo</option>
                    <option value="e2-medium">e2-medium (2 vCPU, 4 GB RAM) — 32 €/Mo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Plan / Erlös</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  >
                    <option value="managed">Managed VM (+490 €/Mo)</option>
                    <option value="enterprise">Enterprise Cluster (+1.490 €/Mo)</option>
                    <option value="sovereign">Souverän (+190 €/Mo)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Web Port</label>
                    <input
                      type="number"
                      value={webPort}
                      onChange={(e) => setWebPort(Number(e.target.value))}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">API Port</label>
                    <input
                      type="number"
                      value={apiPort}
                      onChange={(e) => setApiPort(Number(e.target.value))}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-paper/60 border border-line flex items-center justify-between gap-4">
                  <span className="text-xs text-ink-soft font-mono">1-Line Installer für Kunden-Terminal</span>
                  <button
                    type="button"
                    onClick={handleFetchOneLineInstaller}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <IconTerminal2 size={13} /> Befehl generieren
                  </button>
                </div>

                {oneLineScript && (
                  <div className="bg-black/80 p-3 rounded-lg font-mono text-[11px] text-emerald-400 break-all select-all">
                    {oneLineScript}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={provisioning}
                className="btn-primary text-xs py-2.5 px-6 font-bold shadow-md inline-flex items-center gap-2"
              >
                {provisioning ? (
                  <>
                    <span className="animate-spin">⏳</span> Starte Bereitstellung...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Jetzt Instanz starten
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEKTION 2: Instanzen-Tabelle */}
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
            <button
              type="button"
              onClick={() => setShowProvisionForm(true)}
              className="btn-primary text-xs inline-flex items-center gap-1.5 py-2 px-4"
            >
              <IconPlus size={16} /> Jetzt erste Instanz anlegen
            </button>
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

      {/* SEKTION 3: Infrastruktur- & Provisionierungskosten Kalkulator */}
      <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-line">
          <IconCalculator size={20} className="text-signal" />
          <div>
            <h2 className="font-bold text-sm text-ink">Infrastruktur- & Provisionierungskosten (Kalkulation)</h2>
            <p className="text-xs text-ink-soft">
              Transparente Aufstellung der realen Google Cloud & On-Premise Kosten pro Appliance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: e2-medium */}
          <div className="bg-paper/50 border border-line rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-ink-soft uppercase">Test / Dev</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-line">e2-medium</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 32,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1.5 font-mono text-[11px]">
              <li>• 2 vCPUs (shared core)</li>
              <li>• 4 GB RAM</li>
              <li>• 30 GB Persistent Disk</li>
              <li>• Geeignet für: Test-Instanzen</li>
            </ul>
          </div>

          {/* Card 2: e2-standard-4 */}
          <div className="bg-signal/5 border border-signal/30 rounded-2xl p-5 space-y-3 relative">
            <div className="absolute top-3 right-3 text-[10px] font-bold font-mono bg-signal text-white px-2 py-0.5 rounded">
              STANDARD
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-signal uppercase">Kunden-Standard</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-signal/40 text-signal">e2-standard-4</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 113,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1.5 font-mono text-[11px]">
              <li>• 4 vCPUs (dediziert)</li>
              <li>• 16 GB RAM</li>
              <li>• 50 GB Balanced SSD</li>
              <li>• Erlös: 490 € / Mo (<strong className="text-emerald-500">Marge: +377 €</strong>)</li>
            </ul>
          </div>

          {/* Card 3: e2-standard-8 */}
          <div className="bg-paper/50 border border-line rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-ink-soft uppercase">High Performance</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-line">e2-standard-8</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 225,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1.5 font-mono text-[11px]">
              <li>• 8 vCPUs (dediziert)</li>
              <li>• 32 GB RAM</li>
              <li>• 100 GB Balanced SSD</li>
              <li>• Für große Ingest-Volumen</li>
            </ul>
          </div>
        </div>
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
