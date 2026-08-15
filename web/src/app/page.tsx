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
  created_at: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Reale GCP-Infrastrukturkosten (Frankfurt europe-west3)
const MACHINE_COST_MONTHLY: Record<string, number> = {
  "e2-standard-4": 113.0, // 4 vCPU, 16 GB RAM + 50 GB Balanced Disk
  "e2-standard-8": 225.0, // 8 vCPU, 32 GB RAM + 100 GB Balanced Disk
  "e2-medium": 32.0,      // 2 vCPU, 4 GB RAM + 30 GB Standard Disk
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
  const [deployType, setDeployType] = useState<"docker_stack" | "gcp_vm">("docker_stack");
  const [zone, setZone] = useState("europe-west3-a");
  const [machineType, setMachineType] = useState("e2-standard-4");
  const [webPort, setWebPort] = useState(8190);
  const [apiPort, setApiPort] = useState(8191);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 6000);
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
      alert("Bitte Mandanten-ID und Name angeben.");
      return;
    }

    setProvisioning(true);
    try {
      const payload = {
        tenant_id: tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        company_name: companyName,
        admin_email: adminEmail || "admin@lokal.lan",
        type: deployType,
        plan: "sovereign",
        zone: deployType === "gcp_vm" ? zone : "",
        machine_type: deployType === "gcp_vm" ? machineType : "",
        web_port: Number(webPort),
        api_port: Number(apiPort),
      };

      const res = await fetch(`${API_BASE}/v1/instances/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Fehler beim Starten der Bereitstellung");
      
      // Form zurücksetzen & Ports für nächste Instanz hochzählen
      setTenantId("");
      setCompanyName("");
      setWebPort((prev) => prev + 10);
      setApiPort((prev) => prev + 10);
      setShowProvisionForm(false);
      loadInstances();
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Soll die Instanz '${name}' wirklich gestoppt und entfernt werden?`)) return;
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

  // KPIs
  const activeCount = instances.filter((i) => i.status === "running").length;
  const gcpCount = instances.filter((i) => i.type === "gcp_vm").length;
  const dockerCount = instances.filter((i) => i.type === "docker_stack").length;
  const totalCostMonthly = instances
    .filter((i) => i.status === "running" || i.status === "provisioning")
    .reduce((acc, i) => acc + getInstanceCost(i), 0);

  return (
    <div className="space-y-10">
      {/* Header & KPI Bar */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              <IconServer size={28} className="text-signal" />
              VIRKI Control Plane
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Betreiber-Cockpit: Lokale Docker Stacks & Google Cloud VMs bereitstellen, überwachen und Kosten steuern.
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
              <span>{showProvisionForm ? "Formular schließen" : "+ Neue Instanz bereitstellen"}</span>
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
              <IconShieldLock size={14} className="text-amber-500" /> Lokale Docker Stacks
            </span>
            <div className="text-2xl sm:text-3xl font-black text-ink mt-2 flex items-baseline gap-1 font-mono">
              <span>{dockerCount}</span>
              <span className="text-[11px] text-emerald-500 font-normal font-sans ml-2">0,00 € Host-Kosten</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1">
              <IconBolt size={14} className="text-signal" /> Google Cloud VMs
            </span>
            <div className="text-2xl sm:text-3xl font-black text-ink mt-2 flex items-baseline gap-1 font-mono">
              <span>{gcpCount}</span>
              <span className="text-[11px] text-ink-soft font-normal font-sans ml-2">in Frankfurt</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1">
              <IconReceipt2 size={14} className="text-amber-500" /> Monatliche Cloud-Kosten
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-500 mt-2 flex items-baseline gap-1 font-mono">
              <span>{totalCostMonthly.toFixed(2)} €</span>
              <span className="text-[11px] text-ink-soft font-normal font-sans">/ Monat</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEKTION 1: Bereitstellungs-Formular (Aufklappbar) */}
      {showProvisionForm && (
        <div className="bg-card border-2 border-signal/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
                <IconPlus size={20} className="text-signal" /> Neue VIRKI AI-OS Appliance starten
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Stellen Sie eine neue Instanz entweder direkt lokal als Docker Stack oder als Cloud-VM in Google Cloud bereit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProvisionForm(false)}
              className="text-xs text-ink-soft hover:text-ink cursor-pointer"
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
                <label className="block text-xs font-semibold text-ink mb-1">Name / Mandant*</label>
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
                  placeholder="admin@lokal.lan"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Switch: Lokaler Docker Stack vs GCP VM */}
            <div>
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Bereitstellungs-Ziel
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeployType("docker_stack")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    deployType === "docker_stack"
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-amber-500 uppercase flex items-center gap-1.5">
                      <IconShieldLock size={15} /> 🐳 Lokaler Docker Stack (0,00 €)
                    </span>
                    {deployType === "docker_stack" && <IconCheck size={16} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Startet sofort als Container-Stack auf dieser Maschine/VM. Schnellste Bereitstellung & 0 € Zusatzkosten.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeployType("gcp_vm")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    deployType === "gcp_vm"
                      ? "bg-signal/10 border-signal ring-2 ring-signal/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-signal uppercase flex items-center gap-1.5">
                      <IconBolt size={15} /> 🏢 Google Cloud VM (Frankfurt)
                    </span>
                    {deployType === "gcp_vm" && <IconCheck size={16} className="text-signal" />}
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Startet eine dedizierte Compute Engine VM in Frankfurt mit eigener IP und automatischem Systemd-Autostart.
                  </p>
                </button>
              </div>
            </div>

            {/* Details je nach Ziel */}
            {deployType === "docker_stack" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Web Konsole Port</label>
                  <input
                    type="number"
                    value={webPort}
                    onChange={(e) => setWebPort(Number(e.target.value))}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  />
                  <p className="text-[10px] text-ink-soft mt-1">URL: http://localhost:{webPort}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">API Backend Port</label>
                  <input
                    type="number"
                    value={apiPort}
                    onChange={(e) => setApiPort(Number(e.target.value))}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  />
                  <p className="text-[10px] text-ink-soft mt-1">API: http://localhost:{apiPort}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                  <label className="block text-xs font-semibold text-ink mb-1">Maschinentyp & Kosten</label>
                  <select
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  >
                    <option value="e2-standard-4">e2-standard-4 (4 vCPU, 16 GB RAM) — 113,00 € / Mo</option>
                    <option value="e2-standard-8">e2-standard-8 (8 vCPU, 32 GB RAM) — 225,00 € / Mo</option>
                    <option value="e2-medium">e2-medium (2 vCPU, 4 GB RAM) — 32,00 € / Mo</option>
                  </select>
                </div>
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
          <h2 className="font-bold text-sm text-ink">Bereitgestellte Instanzen & Mandanten</h2>
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
              Starten Sie einen lokalen Docker Stack oder eine dedizierte Google Cloud VM mit einem Klick.
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
                  <th className="py-3 px-4">Bereitstellung</th>
                  <th className="py-3 px-4">Hosting-Kosten / Mo</th>
                  <th className="py-3 px-4">Endpunkt / URL</th>
                  <th className="py-3 px-4 text-center">Appliance Öffnen</th>
                  <th className="py-3 px-5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {instances.map((inst) => {
                  const cost = getInstanceCost(inst);
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
                          {inst.type === "gcp_vm" ? `🏢 GCP VM (${inst.machine_type || "e2-std-4"})` : "🐳 Lokal Docker"}
                        </span>
                        {inst.type === "gcp_vm" && (
                          <div className="text-[10px] text-ink-soft mt-0.5">{inst.zone || "Frankfurt"}</div>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        {cost > 0 ? (
                          <span className="text-amber-500 font-bold">{cost.toFixed(2)} € / Mo</span>
                        ) : (
                          <span className="text-emerald-500 font-bold">0,00 € (Lokal)</span>
                        )}
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

      {/* SEKTION 3: Infrastrukturkosten Übersicht */}
      <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-line">
          <IconCalculator size={20} className="text-signal" />
          <div>
            <h2 className="font-bold text-sm text-ink">Infrastrukturkosten-Übersicht (Hosting-Preise)</h2>
            <p className="text-xs text-ink-soft">
              Reale Monatskosten der Bereitstellungsoptionen (GCP Frankfurt europe-west3 vs. Lokale Docker Stacks).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 0: Docker Local */}
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-emerald-500 uppercase">🐳 Lokal Docker</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-500">Self-Hosted</span>
            </div>
            <div className="text-2xl font-black text-emerald-500 font-mono">0,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1 font-mono text-[11px]">
              <li>• Eigener Server / Bare-Metal</li>
              <li>• Unbegrenzte Ressourcen</li>
              <li>• Keine Cloud-Rechnung</li>
            </ul>
          </div>

          {/* Card 1: e2-medium */}
          <div className="bg-paper/50 border border-line rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-ink-soft uppercase">🏢 GCP Test</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-line">e2-medium</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 32,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1 font-mono text-[11px]">
              <li>• 2 vCPUs (shared)</li>
              <li>• 4 GB RAM · 30 GB Disk</li>
              <li>• Für Test-Instanzen</li>
            </ul>
          </div>

          {/* Card 2: e2-standard-4 */}
          <div className="bg-signal/5 border border-signal/30 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-signal uppercase">🏢 GCP Standard</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-signal/40 text-signal">e2-standard-4</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 113,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1 font-mono text-[11px]">
              <li>• 4 vCPUs (dediziert)</li>
              <li>• 16 GB RAM · 50 GB SSD</li>
              <li>• Empfohlener Standard</li>
            </ul>
          </div>

          {/* Card 3: e2-standard-8 */}
          <div className="bg-paper/50 border border-line rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-ink-soft uppercase">🏢 GCP High Load</span>
              <span className="text-xs font-mono bg-paper px-2 py-0.5 rounded border border-line">e2-standard-8</span>
            </div>
            <div className="text-2xl font-black text-ink font-mono">~ 225,00 € <span className="text-xs text-ink-soft font-sans font-normal">/ Mo</span></div>
            <ul className="text-xs text-ink-soft space-y-1 font-mono text-[11px]">
              <li>• 8 vCPUs (dediziert)</li>
              <li>• 32 GB RAM · 100 GB SSD</li>
              <li>• Für große Datenmengen</li>
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
                <h3 className="font-bold text-sm text-ink">Logs ({selectedLogsId})</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogsId(null)}
                className="text-ink-soft hover:text-ink text-sm font-bold px-2 py-1 cursor-pointer"
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
