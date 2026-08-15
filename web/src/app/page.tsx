"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  IconServer,
  IconExternalLink,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconTerminal2,
  IconPlus,
  IconShieldLock,
  IconBolt,
  IconCloud,
  IconChevronUp,
  IconPlayerPause,
  IconPlayerPlay,
  IconCopy,
  IconCoin,
} from "@tabler/icons-react";

interface Instance {
  id: string;
  tenant_id: string;
  name: string;
  type: "gcp_vm" | "gcp_cloud_run" | "docker_stack";
  status: "provisioning" | "running" | "stopped" | "error";
  endpoint_url: string;
  backend_url: string;
  zone?: string;
  machine_type?: string;
  created_at: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function ControlPlaneCockpit() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  
  // Live Log Streaming & Auto-Close / Keep-Open states
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [selectedLogsInstance, setSelectedLogsInstance] = useState<Instance | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoCloseTriggered, setAutoCloseTriggered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [deployType, setDeployType] = useState<"docker_stack" | "gcp_cloud_run" | "gcp_vm">("docker_stack");
  const [provisioning, setProvisioning] = useState(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 4000);
    const clock = setInterval(() => setNow(Date.now()), 2000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

  // Live polling for selected logs
  useEffect(() => {
    if (!selectedLogsId) {
      setLogs([]);
      setSelectedLogsInstance(null);
      setAutoCloseTriggered(false);
      return;
    }

    let isSubscribed = true;
    const fetchLogsAndStatus = async () => {
      try {
        const [logsRes, instRes] = await Promise.all([
          fetch(`${API_BASE}/v1/instances/${selectedLogsId}/logs`),
          fetch(`${API_BASE}/v1/instances/${selectedLogsId}`),
        ]);

        if (!isSubscribed) return;

        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs(data.logs.map((l: any) => `[${new Date(l.timestamp * 1000).toLocaleTimeString()}] ${l.level}: ${l.message}`));
        }

        if (instRes.ok) {
          const instData = await instRes.json();
          const inst = instData.instance as Instance;
          setSelectedLogsInstance(inst);

          // Wenn die Instanz erfolgreich auf "running" gewechselt ist: Nach 2.5s automatisch schließen!
          if (inst.status === "running" && !autoCloseTriggered) {
            setAutoCloseTriggered(true);
            setTimeout(() => {
              if (isSubscribed) {
                setSelectedLogsId(null);
                loadInstances();
              }
            }, 2500);
          }
        }
      } catch (e) {
        console.error("Fehler beim Abrufen der Live-Logs", e);
      } finally {
        if (isSubscribed) setLoadingLogs(false);
      }
    };

    fetchLogsAndStatus();
    const pollInterval = setInterval(fetchLogsAndStatus, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [selectedLogsId, autoCloseTriggered]);

  // Scroll to bottom when logs update
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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
    if (!companyName.trim()) {
      alert("Bitte einen Mandanten- bzw. Firmennamen eingeben.");
      return;
    }

    setProvisioning(true);
    try {
      const tenantId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mandant";
      const payload = {
        tenant_id: tenantId,
        company_name: companyName.trim(),
        type: deployType,
        region: "europe-west3",
        zone: "europe-west3-a",
        machine_type: "e2-standard-4",
      };

      const res = await fetch(`${API_BASE}/v1/instances/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Fehler beim Starten der Bereitstellung");
      const data = await res.json();
      
      setCompanyName("");
      setShowForm(false);
      
      // Öffne sofort die Live-Logs unten!
      if (data.instance && data.instance.id) {
        setSelectedLogsId(data.instance.id);
        setSelectedLogsInstance(data.instance);
        setAutoCloseTriggered(false);
      }
      
      loadInstances();
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/instances/${id}/pause`, { method: "POST" });
      if (!res.ok) throw new Error("Pausieren fehlgeschlagen");
      loadInstances();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/instances/${id}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Starten fehlgeschlagen");
      loadInstances();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Soll die Instanz '${name}' wirklich gestoppt und unwiderruflich gelöscht werden?`)) return;
    setActionLoadingId(id);
    try {
      await fetch(`${API_BASE}/v1/instances/${id}`, { method: "DELETE" });
      if (selectedLogsId === id) {
        setSelectedLogsId(null);
      }
      loadInstances();
    } catch (e) {
      alert("Löschen fehlgeschlagen");
    } finally {
      setActionLoadingId(null);
    }
  };

  const openLogsModal = (id: string) => {
    setAutoCloseTriggered(false);
    setSelectedLogsId(id);
    const inst = instances.find((i) => i.id === id) || null;
    setSelectedLogsInstance(inst);
  };

  const copyLogsToClipboard = () => {
    const text = logs.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Berechnung der tatsächlichen Ist-Kosten (Bisher aufgelaufen)
  const calculateActualCost = (inst: Instance) => {
    const createdAtMs = (inst.created_at || (Date.now() / 1000 - 3600)) * 1000;
    const runtimeHours = Math.max(0.01, (now - createdAtMs) / (1000 * 3600));

    if (inst.type === "docker_stack") {
      return {
        costVal: 0,
        costStr: "0,00 €",
        rateVal: 0,
        rateStr: "0,00 € / Std.",
        runtimeStr: `${runtimeHours.toFixed(1)} Std.`,
        detail: "Lokal / On-Premise",
      };
    }

    if (inst.type === "gcp_cloud_run") {
      const rate = inst.status === "running" ? 0.02 : 0.00;
      const cost = 0.01 + runtimeHours * rate;
      return {
        costVal: cost,
        costStr: `${cost.toFixed(2)} €`,
        rateVal: rate,
        rateStr: inst.status === "running" ? "~ 0,02 € / Std." : "0,00 € (Pausiert)",
        runtimeStr: `${runtimeHours.toFixed(1)} Std.`,
        detail: "Serverless Pay-per-Request",
      };
    }

    if (inst.type === "gcp_vm") {
      const rate = inst.status === "running" ? 0.154 : 0.006;
      const cost = runtimeHours * rate;
      return {
        costVal: cost,
        costStr: `${cost.toFixed(2)} €`,
        rateVal: rate,
        rateStr: inst.status === "running" ? "0,154 € / Std." : "0,006 € / Std. (Disk)",
        runtimeStr: `${runtimeHours.toFixed(1)} Std.`,
        detail: inst.status === "running" ? "e2-std-4 (24/7 Compute)" : "VM pausiert (nur SSD)",
      };
    }

    return {
      costVal: 0,
      costStr: "0,00 €",
      rateVal: 0,
      rateStr: "0,00 € / Std.",
      runtimeStr: "-",
      detail: "",
    };
  };

  // Metriken & Aggregierte Kosten
  const activeCount = instances.filter((i) => i.status === "running").length;
  const dockerCount = instances.filter((i) => i.type === "docker_stack").length;
  const gcpRunCount = instances.filter((i) => i.type === "gcp_cloud_run").length;
  const gcpVmCount = instances.filter((i) => i.type === "gcp_vm").length;

  // Gesamte tatsächlich aufgelaufene Kosten und aktueller Stundensatz
  const totalAccumulatedCost = instances.reduce((sum, inst) => sum + calculateActualCost(inst).costVal, 0);
  const totalCurrentRate = instances.reduce((sum, inst) => sum + calculateActualCost(inst).rateVal, 0);

  return (
    <div className="space-y-8 pb-32">
      {/* Header & Metriken */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              <IconServer size={28} className="text-signal" />
              VIRKI Control Plane
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Betreiber-Cockpit: Appliances lokal, als Google Cloud Container oder als Dedicated VM bereitstellen und Ist-Kosten überwachen.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadInstances}
              className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 cursor-pointer"
            >
              <IconRefresh size={14} className={loading ? "animate-spin" : ""} /> Aktualisieren
            </button>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 shadow-sm cursor-pointer"
            >
              {showForm ? <IconChevronUp size={16} /> : <IconPlus size={16} />}
              <span>{showForm ? "Formular schließen" : "+ Neue Appliance starten"}</span>
            </button>
          </div>
        </div>

        {/* 5 Schlanke Metrik-Karten inkl. Ist-Kosten */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider">Laufende Instanzen</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2 font-mono flex items-baseline gap-2">
              <span>{activeCount}</span>
              <span className="text-xs text-ink-soft font-normal">/ {instances.length} Gesamt</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1.5">
              <IconShieldLock size={14} className="text-amber-500" /> Lokale Docker
            </span>
            <div className="text-2xl sm:text-3xl font-black text-ink mt-2 font-mono flex items-baseline gap-2">
              <span>{dockerCount}</span>
              <span className="text-[11px] text-emerald-500 font-bold">0 € Cloud</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1.5">
              <IconCloud size={14} className="text-sky-500" /> Cloud Run
            </span>
            <div className="text-2xl sm:text-3xl font-black text-ink mt-2 font-mono flex items-baseline gap-2">
              <span>{gcpRunCount}</span>
              <span className="text-[11px] text-sky-400 font-normal">Serverless</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1.5">
              <IconBolt size={14} className="text-signal" /> Dedicated VMs
            </span>
            <div className="text-2xl sm:text-3xl font-black text-ink mt-2 font-mono flex items-baseline gap-2">
              <span>{gcpVmCount}</span>
              <span className="text-[11px] text-ink-soft font-normal">e2-std-4</span>
            </div>
          </div>

          <div className="bg-card border border-line p-5 rounded-2xl bg-gradient-to-br from-card to-paper/80">
            <span className="text-xs text-ink-soft uppercase font-bold tracking-wider flex items-center gap-1.5">
              <IconCoin size={14} className="text-emerald-400" /> Aktuelle GCP-Kosten
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono flex items-baseline gap-1.5">
              <span>{totalAccumulatedCost.toFixed(2)} €</span>
              <span className="text-[10px] text-ink-soft font-normal font-sans">bisher</span>
            </div>
            <div className="text-[10px] text-ink-soft font-mono mt-1">
              Rate: {totalCurrentRate.toFixed(3)} € / Std.
            </div>
          </div>
        </div>
      </div>

      {/* Bereitstellungs-Wizard mit 3 Optionen */}
      {showForm && (
        <div className="bg-card border-2 border-signal/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
                <IconPlus size={20} className="text-signal" /> Neue VIRKI AI-OS Appliance bereitstellen
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Geben Sie den Kundennamen ein und wählen Sie das gewünschte Bereitstellungsziel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-ink-soft hover:text-ink cursor-pointer"
            >
              ✕ Schließen
            </button>
          </div>

          <form onSubmit={handleProvisionSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Kunden- / Mandantenname*
              </label>
              <input
                type="text"
                required
                autoFocus
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="z.B. Schulze Bedachungen GmbH"
                className="w-full text-sm px-4 py-2.5 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
              />
            </div>

            {/* 3 Bereitstellungsziele mit Ist-Tarifen */}
            <div>
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Bereitstellungsziel & Laufende Tarife
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setDeployType("docker_stack")}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    deployType === "docker_stack"
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-amber-500 flex items-center gap-1.5">
                        <IconShieldLock size={16} /> 🐳 Lokaler Docker
                      </span>
                      {deployType === "docker_stack" && <IconCheck size={16} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed mb-3">
                      Startet direkt auf diesem Server als isolierter Container-Stack.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-line/50 flex items-center justify-between">
                    <span className="text-[11px] text-ink-soft">Tarif:</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">0,00 € (Kostenlos)</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeployType("gcp_cloud_run")}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    deployType === "gcp_cloud_run"
                      ? "bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-sky-500 flex items-center gap-1.5">
                        <IconCloud size={16} /> ☁️ GCP Cloud Run
                      </span>
                      {deployType === "gcp_cloud_run" && <IconCheck size={16} className="text-sky-500" />}
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed mb-3">
                      Serverless Container in Frankfurt mit automatischer HTTPS-Domain.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-line/50 flex items-center justify-between">
                    <span className="text-[11px] text-ink-soft">Tarif:</span>
                    <span className="text-xs font-bold font-mono text-sky-400">~ 0,02 € / Std.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeployType("gcp_vm")}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    deployType === "gcp_vm"
                      ? "bg-signal/10 border-signal ring-2 ring-signal/20"
                      : "bg-paper/40 border-line hover:border-line-strong opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-signal flex items-center gap-1.5">
                        <IconBolt size={16} /> 🏢 Dedicated GCP VM
                      </span>
                      {deployType === "gcp_vm" && <IconCheck size={16} className="text-signal" />}
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed mb-3">
                      Dedizierte Compute VM (e2-std-4, 16 GB RAM) mit Public IP in Frankfurt.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-line/50 flex items-center justify-between">
                    <span className="text-[11px] text-ink-soft">Tarif:</span>
                    <span className="text-xs font-bold font-mono text-signal">0,154 € / Std.</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={provisioning}
                className="btn-primary text-xs py-2.5 px-6 font-bold shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                {provisioning ? (
                  <>
                    <span className="animate-spin">⏳</span> Starte Bereitstellung...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Jetzt Appliance starten
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Flotten- & Instanzen-Tabelle */}
      <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-sm text-ink">Verwaltete Kunden-Appliances</h2>
          <span className="text-xs text-ink-soft font-mono">Live-Status & Aktuelle Kosten</span>
        </div>

        {loading && instances.length === 0 ? (
          <div className="p-12 text-center text-xs text-ink-soft">
            <span className="animate-spin inline-block mr-2">⏳</span> Lade Instanzen...
          </div>
        ) : instances.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="text-3xl">🚀</div>
            <h3 className="font-bold text-base text-ink">Noch keine Appliances gestartet</h3>
            <p className="text-xs text-ink-soft max-w-md mx-auto">
              Starten Sie einen lokalen Docker Stack, einen Google Cloud Run Container oder eine Dedicated VM.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary text-xs inline-flex items-center gap-1.5 py-2 px-4 cursor-pointer"
            >
              <IconPlus size={16} /> Erste Appliance anlegen
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
                  <th className="py-3 px-4">Aktuelle Kosten (Bisher)</th>
                  <th className="py-3 px-4">Endpunkt URL</th>
                  <th className="py-3 px-4 text-center">Appliance Öffnen</th>
                  <th className="py-3 px-5 text-right">Steuerung & Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {instances.map((inst) => {
                  const cost = calculateActualCost(inst);
                  return (
                    <tr key={inst.id} className="hover:bg-paper/30 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap">
                        {inst.status === "running" && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-500 font-bold font-mono">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            RUNNING
                          </span>
                        )}
                        {inst.status === "stopped" && (
                          <span className="inline-flex items-center gap-1.5 text-ink-soft font-bold font-mono">
                            <span className="h-2 w-2 rounded-full bg-ink-soft"></span>
                            STOPPED
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
                        <div className="text-[11px] text-ink-soft font-mono">ID: {inst.tenant_id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-paper border border-line">
                          {inst.type === "gcp_vm" && "🏢 Dedicated GCP VM"}
                          {inst.type === "gcp_cloud_run" && "☁️ GCP Cloud Run"}
                          {inst.type === "docker_stack" && "🐳 Lokaler Docker"}
                        </span>
                      </td>

                      {/* Aktuelle Kosten (Bisher aufgelaufen) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-emerald-400 text-xs flex items-baseline gap-1">
                          <span>{cost.costStr}</span>
                          <span className="text-[10px] text-ink-soft font-normal font-sans">bisher</span>
                        </div>
                        <div className="text-[10px] text-ink-soft font-mono">{cost.rateStr} · {cost.runtimeStr}</div>
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        {inst.endpoint_url ? (
                          <span className="text-ink">{inst.endpoint_url}</span>
                        ) : (
                          <span className="text-ink-soft italic">Wird zugewiesen...</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {inst.status === "running" && inst.endpoint_url ? (
                          <a
                            href={inst.endpoint_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 btn-primary text-xs py-1.5 px-3 rounded-lg shadow-sm"
                          >
                            <span>🚀 Appliance öffnen</span>
                            <IconExternalLink size={13} />
                          </a>
                        ) : inst.status === "stopped" ? (
                          <span className="text-ink-soft text-[11px] italic">Pausiert</span>
                        ) : (
                          <span className="text-ink-soft text-[11px]">In Vorbereitung</span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-2">
                        {/* Pause / Start / Retry Buttons */}
                        {inst.status === "running" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === inst.id}
                            onClick={() => handlePause(inst.id)}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-bold text-amber-500 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                            title="Instanz pausieren (stoppen)"
                          >
                            <IconPlayerPause size={14} /> Pausieren
                          </button>
                        )}

                        {inst.status === "stopped" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === inst.id}
                            onClick={() => handleStart(inst.id)}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-bold text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                            title="Instanz starten (fortsetzen)"
                          >
                            <IconPlayerPlay size={14} /> Fortsetzen
                          </button>
                        )}

                        {inst.status === "error" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === inst.id}
                            onClick={() => handleStart(inst.id)}
                            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-bold text-sky-500 border-sky-500/30 hover:bg-sky-500/10 cursor-pointer"
                            title="Instanz neu starten"
                          >
                            <IconRefresh size={14} /> Neu starten
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openLogsModal(inst.id)}
                          className={`btn-secondary text-xs py-1.5 px-2.5 inline-flex items-center gap-1 cursor-pointer ${
                            selectedLogsId === inst.id ? "bg-signal/15 border-signal text-signal" : ""
                          }`}
                          title="Logs ansehen"
                        >
                          <IconTerminal2 size={13} /> Logs
                        </button>

                        <button
                          type="button"
                          disabled={actionLoadingId === inst.id}
                          onClick={() => handleDelete(inst.id, inst.name)}
                          className="btn-secondary text-xs py-1.5 px-2.5 inline-flex items-center gap-1 text-danger hover:bg-danger/10 border-danger/20 cursor-pointer"
                          title="Instanz löschen"
                        >
                          <IconTrash size={13} /> Löschen
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

      {/* Unten eingeblendetes Live-Log Terminal-Panel */}
      {selectedLogsId && (
        <div className="bg-card border-2 border-line rounded-2xl overflow-hidden shadow-2xl space-y-0 transition-all">
          {/* Header */}
          <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-paper/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-black/80 text-emerald-400">
                <IconTerminal2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-ink">
                    Live-Bereitstellungs-Logs: {selectedLogsInstance?.name || selectedLogsId}
                  </h3>
                  {selectedLogsInstance?.status === "running" && (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ ERFOLGREICH BEREITGESTELLT
                    </span>
                  )}
                  {selectedLogsInstance?.status === "error" && (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30">
                      ❌ FEHLER BEIM PROVISIONIEREN
                    </span>
                  )}
                  {selectedLogsInstance?.status === "provisioning" && (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                      ⏳ WIRD AUSGEFÜHRT...
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft">
                  {selectedLogsInstance?.status === "running"
                    ? "Die Bereitstellung wurde erfolgreich abgeschlossen. Dieses Fenster schließt sich automatisch..."
                    : selectedLogsInstance?.status === "error"
                    ? "Fehler aufgetreten. Die Logs bleiben zur Diagnose geöffnet und können kopiert werden."
                    : "Live-Prozessprotokollierung während der Bereitstellung."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyLogsToClipboard}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-paper"
              >
                {copied ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
                <span>{copied ? "Logs kopiert!" : "Logs kopieren"}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLogsId(null)}
                className="btn-secondary text-xs py-1.5 px-3 font-bold hover:text-ink cursor-pointer"
              >
                ✕ Schließen
              </button>
            </div>
          </div>

          {/* Terminal Output */}
          <div className="p-4 bg-black/95 font-mono text-xs text-emerald-400 overflow-y-auto max-h-[400px] min-h-[160px] space-y-1 select-text">
            {loadingLogs && logs.length === 0 ? (
              <div className="text-ink-soft">Initialisiere Log-Streamer...</div>
            ) : logs.length === 0 ? (
              <div className="text-ink-soft italic">Warte auf erste Log-Ausgaben...</div>
            ) : (
              logs.map((line, idx) => (
                <div
                  key={idx}
                  className={`whitespace-pre-wrap leading-relaxed ${
                    line.includes("ERROR") || line.includes("❌")
                      ? "text-red-400 font-bold"
                      : line.includes("WARNING") || line.includes("⚠️")
                      ? "text-amber-300"
                      : line.includes("✓") || line.includes("🎉")
                      ? "text-emerald-300 font-bold"
                      : "text-emerald-400/90"
                  }`}
                >
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
