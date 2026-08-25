"use client";

import React, { useEffect, useState } from "react";
import { ApiEndpointsPanel } from "@/components/ApiEndpointsPanel";

type BrightnessMode = "medium" | "dark" | "light";

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

export default function ControlPlanePage() {
  const [activeTab, setActiveTab] = useState<"fleet" | "provision" | "gcp" | "finops" | "logs" | "apis">("fleet");
  const [theme, setTheme] = useState<BrightnessMode>("medium");
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);

  // Live Log Streaming & Selection
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [selectedLogsInstance, setSelectedLogsInstance] = useState<Instance | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [deployType, setDeployType] = useState<"docker_stack" | "gcp_cloud_run" | "gcp_vm">("docker_stack");
  const [provisioning, setProvisioning] = useState(false);

  // EXACT themeStyles from Core-Platform
  const themeStyles = {
    medium: {
      bg: "bg-slate-950",
      text: "text-slate-200",
      headerBg: "bg-slate-900/95",
      border: "border-slate-700",
      cardBg: "bg-slate-900",
      cardSubBg: "bg-slate-950",
      cardBorder: "border-slate-700 shadow-sm",
      navActive: "bg-slate-800 text-cyan-300 border-slate-600 shadow-sm",
      navInactive: "text-slate-400 hover:text-white hover:bg-slate-800",
      statusBadge: "bg-slate-950 border-slate-700 text-emerald-300",
      buttonSecondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600",
      titleColor: "text-white",
      subtextColor: "text-slate-400",
    },
    dark: {
      bg: "bg-black",
      text: "text-neutral-200",
      headerBg: "bg-neutral-900/95",
      border: "border-neutral-800",
      cardBg: "bg-neutral-900",
      cardSubBg: "bg-black",
      cardBorder: "border-neutral-700 shadow-sm",
      navActive: "bg-neutral-800 text-cyan-300 border-neutral-600 shadow-sm",
      navInactive: "text-neutral-400 hover:text-white hover:bg-neutral-800",
      statusBadge: "bg-black border-neutral-700 text-emerald-400",
      buttonSecondary: "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700",
      titleColor: "text-white",
      subtextColor: "text-neutral-400",
    },
    light: {
      bg: "bg-slate-100",
      text: "text-slate-900",
      headerBg: "bg-white/95",
      border: "border-slate-300",
      cardBg: "bg-white",
      cardSubBg: "bg-slate-50",
      cardBorder: "border-slate-300 shadow-sm",
      navActive: "bg-slate-200 text-slate-900 border-slate-400 shadow-sm",
      navInactive: "text-slate-600 hover:text-slate-900 hover:bg-slate-200",
      statusBadge: "bg-emerald-50 border-emerald-200 text-emerald-800",
      buttonSecondary: "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300",
      titleColor: "text-slate-900",
      subtextColor: "text-slate-500",
    },
  }[theme];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("aios-theme-mode") as BrightnessMode | null;
      if (storedTheme) setTheme(storedTheme);
    }

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<BrightnessMode>;
      if (customEvent.detail) setTheme(customEvent.detail);
    };

    window.addEventListener("aios-theme-changed", handleThemeChange);
    loadInstances();
    const interval = setInterval(loadInstances, 5000);
    const clock = setInterval(() => setNow(Date.now()), 3000);

    return () => {
      window.removeEventListener("aios-theme-changed", handleThemeChange);
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

  // Live polling for logs
  useEffect(() => {
    if (!selectedLogsId) {
      setLogs([]);
      setSelectedLogsInstance(null);
      return;
    }

    let isSubscribed = true;
    const fetchLogsAndStatus = async () => {
      try {
        const [logsRes, instRes] = await Promise.all([
          fetch(`${API_BASE}/v1/instances/${selectedLogsId}/logs`).catch(() => null),
          fetch(`${API_BASE}/v1/instances/${selectedLogsId}`).catch(() => null),
        ]);

        if (!isSubscribed) return;

        if (logsRes && logsRes.ok) {
          const data = await logsRes.json();
          setLogs(data.logs.map((l: any) => `[${new Date(l.timestamp * 1000).toLocaleTimeString()}] ${l.level}: ${l.message}`));
        }

        if (instRes && instRes.ok) {
          const instData = await instRes.json();
          setSelectedLogsInstance(instData.instance as Instance);
        }
      } catch {}
    };

    fetchLogsAndStatus();
    const interval = setInterval(fetchLogsAndStatus, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedLogsId]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/v1/instances`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
      } else {
        seedFallbackInstances();
      }
    } catch {
      seedFallbackInstances();
    } finally {
      setLoading(false);
    }
  };

  const seedFallbackInstances = () => {
    const demo: Instance[] = [
      {
        id: "inst-nextchapter-local",
        tenant_id: "nextchapter",
        name: "NextChapter Experts (Master HQ)",
        type: "docker_stack",
        status: "running",
        endpoint_url: "http://localhost:8090",
        backend_url: "http://localhost:8091",
        created_at: Math.floor(Date.now() / 1000 - 86400 * 2),
      },
      {
        id: "inst-schulze-gcp-run",
        tenant_id: "schulze-bedachungen",
        name: "Schulze Bedachungen GmbH",
        type: "gcp_cloud_run",
        status: "running",
        endpoint_url: "https://schulze.virki.cloud",
        backend_url: "https://api-schulze.virki.cloud",
        created_at: Math.floor(Date.now() / 1000 - 3600 * 18),
      },
      {
        id: "inst-meyer-vm-dedicated",
        tenant_id: "meyer-maschinenbau",
        name: "Meyer Maschinenbau KGaA",
        type: "gcp_vm",
        status: "running",
        zone: "europe-west3-a",
        machine_type: "e2-standard-4",
        endpoint_url: "https://meyer.virki.cloud",
        backend_url: "https://api-meyer.virki.cloud",
        created_at: Math.floor(Date.now() / 1000 - 3600 * 5),
      },
    ];
    setInstances(demo);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

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
      if (data.instance && data.instance.id) {
        setSelectedLogsId(data.instance.id);
        setActiveTab("logs");
      }
      setMsg(`✓ Bereitstellung für „${companyName}“ erfolgreich gestartet.`);
      loadInstances();
    } catch (err: any) {
      setMsg(`❌ Fehler bei Bereitstellung: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/instances/${id}/pause`, { method: "POST" });
      if (!res.ok) throw new Error("Pausieren fehlgeschlagen");
      setMsg("✓ Instanz pausiert.");
      loadInstances();
    } catch (e: any) {
      setMsg(`❌ Fehler: ${e.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/instances/${id}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Starten fehlgeschlagen");
      setMsg("✓ Instanz gestartet.");
      loadInstances();
    } catch (e: any) {
      setMsg(`❌ Fehler: ${e.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Soll die Instanz '${name}' wirklich unwiderruflich gelöscht werden?`)) return;
    setActionLoadingId(id);
    try {
      await fetch(`${API_BASE}/v1/instances/${id}`, { method: "DELETE" });
      if (selectedLogsId === id) setSelectedLogsId(null);
      setMsg(`✓ Instanz „${name}“ gelöscht.`);
      loadInstances();
    } catch {
      setMsg("❌ Löschen fehlgeschlagen.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const calculateActualCost = (inst: Instance) => {
    const createdAtMs = (inst.created_at || (Date.now() / 1000 - 3600)) * 1000;
    const runtimeHours = Math.max(0.01, (now - createdAtMs) / (1000 * 3600));

    if (inst.type === "docker_stack") {
      return { costVal: 0, costStr: "0,00 €", rateStr: "0,00 € / Std.", detail: "Lokal / On-Premise" };
    }
    if (inst.type === "gcp_cloud_run") {
      const rate = inst.status === "running" ? 0.02 : 0.00;
      const cost = 0.01 + runtimeHours * rate;
      return { costVal: cost, costStr: `${cost.toFixed(2)} €`, rateStr: "~ 0,02 € / Std.", detail: "Serverless Pay-per-Request" };
    }
    if (inst.type === "gcp_vm") {
      const rate = inst.status === "running" ? 0.154 : 0.006;
      const cost = runtimeHours * rate;
      return { costVal: cost, costStr: `${cost.toFixed(2)} €`, rateStr: "0,154 € / Std.", detail: "Dedicated e2-std-4 VM" };
    }
    return { costVal: 0, costStr: "0,00 €", rateStr: "0,00 € / Std.", detail: "" };
  };

  const activeCount = instances.filter((i) => i.status === "running").length;
  const dockerCount = instances.filter((i) => i.type === "docker_stack").length;
  const gcpRunCount = instances.filter((i) => i.type === "gcp_cloud_run").length;
  const gcpVmCount = instances.filter((i) => i.type === "gcp_vm").length;
  const totalCost = instances.reduce((sum, inst) => sum + calculateActualCost(inst).costVal, 0);

  return (
    <div className={`min-h-screen ${themeStyles.bg} ${themeStyles.text} flex flex-col font-sans transition-colors duration-200 selection:bg-cyan-500/20 selection:text-cyan-200 rounded-2xl overflow-hidden`}>
      {/* ========================================================================= */}
      {/* 🧭 TOP-BAR NAVIGATION (KURZE TAB-NAMEN, MONOSPACE, KEINE ICONS)            */}
      {/* ========================================================================= */}
      <header className={`h-16 border-b ${themeStyles.border} ${themeStyles.headerBg} backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors duration-200`}>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setActiveTab("fleet")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "fleet" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ Instanzen ]
            </button>

            <button
              onClick={() => setActiveTab("provision")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "provision" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ Provisionierung ]
            </button>

            <button
              onClick={() => setActiveTab("gcp")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "gcp" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ GCP ]
            </button>

            <button
              onClick={() => setActiveTab("finops")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "finops" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ FinOps ]
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "logs" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ Logs ]
            </button>

            <button
              onClick={() => setActiveTab("apis")}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === "apis" ? themeStyles.navActive : `border-transparent ${themeStyles.navInactive}`
              }`}
            >
              [ APIs ]
            </button>
          </nav>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${themeStyles.statusBadge} text-[11px] font-mono font-medium`}>
            <span>CONTROL PLANE TIER 0 (PORT :8280 / API :8080)</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 📦 HAUPT-WORKSPACE                                                        */}
      {/* ========================================================================= */}
      <main className="max-w-6xl w-full mx-auto p-6 space-y-6 flex-1">
        {msg && (
          <div className="p-3 rounded-lg text-xs font-mono bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex justify-between items-center shadow-sm">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-emerald-400 hover:text-white font-bold cursor-pointer">[ x ]</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: INSTANZEN                                                         */}
        {/* ========================================================================= */}
        {activeTab === "fleet" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h1 className={`text-lg font-bold ${themeStyles.titleColor}`}>VIRKI Appliance Flotten-Cockpit</h1>
                <p className={`text-xs ${themeStyles.subtextColor} mt-1`}>
                  Zentrale Steuerung aller laufenden Mandanten-Appliances (Lokal, Serverless & GCP VM).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadInstances}
                  disabled={loading}
                  className={`px-3.5 py-1.5 rounded-lg ${themeStyles.buttonSecondary} text-xs font-mono cursor-pointer`}
                >
                  [ {loading ? "Lädt…" : "Aktualisieren"} ]
                </button>
                <button
                  onClick={() => setActiveTab("provision")}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shadow-sm transition cursor-pointer"
                >
                  [ + Neue Appliance starten ]
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm`}>
                <div className={`text-xs font-mono ${themeStyles.subtextColor} font-bold`}>LAUFENDE INSTANZEN</div>
                <div className={`text-2xl font-bold font-mono ${themeStyles.titleColor} mt-1`}>{activeCount} / {instances.length}</div>
                <div className="text-xs text-emerald-400 mt-1 font-mono">100% Online</div>
              </div>
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm`}>
                <div className={`text-xs font-mono ${themeStyles.subtextColor} font-bold`}>DOCKER STACKS</div>
                <div className="text-2xl font-bold font-mono text-amber-300 mt-1">{dockerCount}</div>
                <div className="text-xs text-neutral-400 mt-1 font-mono">Lokal / On-Premise</div>
              </div>
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm`}>
                <div className={`text-xs font-mono ${themeStyles.subtextColor} font-bold`}>CLOUD RUN</div>
                <div className="text-2xl font-bold font-mono text-sky-400 mt-1">{gcpRunCount}</div>
                <div className="text-xs text-sky-400 mt-1 font-mono">Serverless Container</div>
              </div>
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm`}>
                <div className={`text-xs font-mono ${themeStyles.subtextColor} font-bold`}>DEDICATED VMS</div>
                <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{gcpVmCount}</div>
                <div className="text-xs text-cyan-400 mt-1 font-mono">e2-standard-4</div>
              </div>
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm`}>
                <div className={`text-xs font-mono ${themeStyles.subtextColor} font-bold`}>GCP-KOSTEN</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{totalCost.toFixed(2)} €</div>
                <div className="text-xs text-emerald-400 mt-1 font-mono">Aufgelaufen</div>
              </div>
            </div>

            {/* Instance List */}
            <div className="space-y-4">
              <h2 className={`text-xs font-bold uppercase tracking-wider font-mono ${themeStyles.titleColor}`}>
                Aktive Mandanten & Appliances
              </h2>

              <div className="space-y-3">
                {instances.map((inst) => {
                  const costInfo = calculateActualCost(inst);
                  return (
                    <div
                      key={inst.id}
                      className={`p-5 rounded-2xl border ${themeStyles.cardBorder} ${themeStyles.cardBg} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              inst.status === "running"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {inst.status}
                          </span>
                          <h3 className={`text-base font-bold ${themeStyles.titleColor}`}>{inst.name}</h3>
                          <span className={`text-xs font-mono ${themeStyles.subtextColor}`}>({inst.tenant_id})</span>
                        </div>
                        <p className={`text-xs font-mono ${themeStyles.subtextColor}`}>
                          Typ: {inst.type.toUpperCase()} · Tarif: {costInfo.rateStr} · Kosten: {costInfo.costStr} ({costInfo.detail})
                        </p>
                        <div className="flex items-center gap-3 text-xs font-mono pt-1">
                          <a href={inst.endpoint_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                            Frontend: {inst.endpoint_url} ↗
                          </a>
                          <span className="text-neutral-600">|</span>
                          <a href={inst.backend_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                            Backend API: {inst.backend_url} ↗
                          </a>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <button
                          onClick={() => {
                            setSelectedLogsId(inst.id);
                            setActiveTab("logs");
                          }}
                          className={`px-3 py-1.5 rounded-lg ${themeStyles.buttonSecondary} cursor-pointer`}
                        >
                          [ Logs ]
                        </button>
                        {inst.status === "running" ? (
                          <button
                            onClick={() => handlePause(inst.id)}
                            disabled={actionLoadingId === inst.id}
                            className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                          >
                            [ Pausieren ]
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStart(inst.id)}
                            disabled={actionLoadingId === inst.id}
                            className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            [ Starten ]
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inst.id, inst.name)}
                          disabled={actionLoadingId === inst.id}
                          className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          [ Löschen ]
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROVISIONIERUNG                                                   */}
        {/* ========================================================================= */}
        {activeTab === "provision" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h1 className={`text-lg font-bold ${themeStyles.titleColor}`}>Neue VIRKI AI-OS Appliance bereitstellen</h1>
                <p className={`text-xs ${themeStyles.subtextColor} mt-1`}>
                  Automatische Multi-Target Provisionierung mit 1-Klick Deployment.
                </p>
              </div>
            </div>

            <div className={`p-6 sm:p-8 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm space-y-6`}>
              <form onSubmit={handleProvisionSubmit} className="space-y-6 font-mono text-xs">
                <div>
                  <label className={`block ${themeStyles.subtextColor} font-bold mb-1.5 uppercase`}>
                    Mandanten- & Unternehmensname*
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="z. B. Schulze Bedachungen GmbH"
                    className={`w-full px-4 py-2.5 rounded-xl border ${themeStyles.border} ${themeStyles.cardSubBg} ${themeStyles.titleColor} text-sm focus:outline-none focus:border-cyan-500`}
                  />
                </div>

                {/* 3 Deployment Targets */}
                <div>
                  <label className={`block ${themeStyles.subtextColor} font-bold mb-2 uppercase`}>
                    Bereitstellungsziel & Tarif
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setDeployType("docker_stack")}
                      className={`p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        deployType === "docker_stack"
                          ? "bg-amber-500/10 border-amber-500 text-amber-300"
                          : `${themeStyles.cardSubBg} ${themeStyles.border} ${themeStyles.subtextColor}`
                      }`}
                    >
                      <div>
                        <strong className="block text-sm">LOKALER DOCKER STACK</strong>
                        <p className="text-[11px] mt-1 opacity-80">
                          Autarkes Deployment auf bestehender Server-Hardware.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/10 text-xs font-bold text-emerald-400">
                        0,00 € Cloud-Kosten
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeployType("gcp_cloud_run")}
                      className={`p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        deployType === "gcp_cloud_run"
                          ? "bg-sky-500/10 border-sky-500 text-sky-300"
                          : `${themeStyles.cardSubBg} ${themeStyles.border} ${themeStyles.subtextColor}`
                      }`}
                    >
                      <div>
                        <strong className="block text-sm">GCP CLOUD RUN (SERVERLESS)</strong>
                        <p className="text-[11px] mt-1 opacity-80">
                          Auto-Scale Container in europe-west3 (Frankfurt).
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/10 text-xs font-bold text-sky-400">
                        ~ 0,02 € / Betriebsstunde
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeployType("gcp_vm")}
                      className={`p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        deployType === "gcp_vm"
                          ? "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                          : `${themeStyles.cardSubBg} ${themeStyles.border} ${themeStyles.subtextColor}`
                      }`}
                    >
                      <div>
                        <strong className="block text-sm">DEDICATED GCP VM</strong>
                        <p className="text-[11px] mt-1 opacity-80">
                          e2-standard-4 mit isolierter SSD & fester IP.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/10 text-xs font-bold text-cyan-400">
                        0,154 € / Std. (24/7 Compute)
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={provisioning}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50"
                  >
                    [ {provisioning ? "Wird bereitgestellt..." : "Appliance jetzt starten"} ]
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: GCP                                                               */}
        {/* ========================================================================= */}
        {activeTab === "gcp" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h1 className={`text-lg font-bold ${themeStyles.titleColor}`}>Google Cloud Platform Übersicht</h1>
                <p className={`text-xs ${themeStyles.subtextColor} mt-1`}>
                  Region: europe-west3 (Frankfurt) · Projekt: virki-production-2026
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm space-y-2`}>
                <span className="text-xs font-mono font-bold text-sky-400 uppercase">Artifact Registry</span>
                <h3 className={`text-base font-bold ${themeStyles.titleColor}`}>europe-west3-docker.pkg.dev</h3>
                <p className={`text-xs ${themeStyles.subtextColor}`}>
                  Container-Images für Core Platform, Agent Platform und Orchestrator.
                </p>
              </div>

              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm space-y-2`}>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">Cloud Run Services</span>
                <h3 className={`text-base font-bold ${themeStyles.titleColor}`}>{gcpRunCount} Aktive Endpunkte</h3>
                <p className={`text-xs ${themeStyles.subtextColor}`}>
                  Zero-Cold-Start Inferenz & automatische HTTPS-Zertifikate.
                </p>
              </div>

              <div className={`p-5 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm space-y-2`}>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Compute Engine</span>
                <h3 className={`text-base font-bold ${themeStyles.titleColor}`}>{gcpVmCount} VMs Online</h3>
                <p className={`text-xs ${themeStyles.subtextColor}`}>
                  Dedizierte Instanzen mit lokalem Ollama LLM Acceleration Cluster.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: FINOPS                                                            */}
        {/* ========================================================================= */}
        {activeTab === "finops" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h1 className={`text-lg font-bold ${themeStyles.titleColor}`}>FinOps & Kostenkontrolle</h1>
                <p className={`text-xs ${themeStyles.subtextColor} mt-1`}>
                  Transparente Kostenaufschlüsselung aller Mandanten und Cloud-Ressourcen.
                </p>
              </div>
            </div>

            <div className={`p-6 rounded-2xl ${themeStyles.cardBg} border ${themeStyles.cardBorder} shadow-sm space-y-4`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono text-xs font-bold text-neutral-400">
                <span>MANDANT</span>
                <span>TYP</span>
                <span>STUNDENSATZ</span>
                <span>GESAMTKOSTEN</span>
              </div>

              {instances.map((inst) => {
                const costInfo = calculateActualCost(inst);
                return (
                  <div key={inst.id} className="flex items-center justify-between font-mono text-xs py-2 border-b border-white/5">
                    <span className="font-bold text-white">{inst.name}</span>
                    <span className="text-neutral-400 uppercase">{inst.type.replace("_", " ")}</span>
                    <span className="text-cyan-400">{costInfo.rateStr}</span>
                    <span className="text-emerald-400 font-bold">{costInfo.costStr}</span>
                  </div>
                );
              })}

              <div className="pt-3 flex items-center justify-between font-mono text-sm font-bold text-emerald-400 border-t border-white/10">
                <span>GESAMTSUMME ALLER APPLIANCES</span>
                <span>{totalCost.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: LOGS                                                              */}
        {/* ========================================================================= */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h1 className={`text-lg font-bold ${themeStyles.titleColor}`}>Live-Log Streaming</h1>
                <p className={`text-xs ${themeStyles.subtextColor} mt-1`}>
                  {selectedLogsInstance ? `Instanz: ${selectedLogsInstance.name}` : "Wähle eine Instanz zur Log-Inspektion"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {instances.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelectedLogsId(i.id)}
                    className={`px-3 py-1 rounded text-xs font-mono border cursor-pointer ${
                      selectedLogsId === i.id ? themeStyles.navActive : `${themeStyles.cardSubBg} ${themeStyles.subtextColor} ${themeStyles.border}`
                    }`}
                  >
                    [ {i.tenant_id} ]
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-4 rounded-2xl ${themeStyles.cardSubBg} border ${themeStyles.border} font-mono text-xs space-y-1 max-h-96 overflow-y-auto`}>
              {logs.length === 0 ? (
                <div className="text-neutral-500 italic p-4 text-center">Keine Logs empfangen oder Instanz bereit.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="text-neutral-300 leading-relaxed font-mono">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: APIS (VOLLSTÄNDIGES 1:1 CORE-PLATFORM LAYOUT VIA APIS-PANEL)       */}
        {/* ========================================================================= */}
        {activeTab === "apis" && (
          <ApiEndpointsPanel themeStyles={themeStyles} />
        )}
      </main>
    </div>
  );
}
