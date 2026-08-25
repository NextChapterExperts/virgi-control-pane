"use client";

import React, { useState } from "react";

interface ApiDefinition {
  id: string;
  name: string;
  category: "Flotte & Appliances" | "Provisionierung & Automation" | "Lifecycle & Kosten" | "System & Diagnostics";
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  defaultPayload?: any;
}

const APIS: ApiDefinition[] = [
  {
    id: "instances_list",
    name: "Appliances & Flotten Listing",
    category: "Flotte & Appliances",
    method: "GET",
    path: "/v1/instances",
    description: "Liefert alle registrierten Instanzen inkl. Typ, Status, Port-Mappings und URLs.",
  },
  {
    id: "instance_detail",
    name: "Appliance Detailabfrage",
    category: "Flotte & Appliances",
    method: "GET",
    path: "/v1/instances/inst-nextchapter-local",
    description: "Metadaten, Status und Konfigurationsparameter einer spezifischen Instanz.",
  },
  {
    id: "instance_logs",
    name: "Live Audit- & Provisionierungslogs",
    category: "Flotte & Appliances",
    method: "GET",
    path: "/v1/instances/inst-nextchapter-local/logs",
    description: "Audit-Trail und Konsolen-Output während Bereitstellung und Laufzeit.",
  },
  {
    id: "provision_docker",
    name: "1-Klick Docker Stack Provisionierung",
    category: "Provisionierung & Automation",
    method: "POST",
    path: "/v1/instances/provision",
    description: "Startet die automatisierte Bereitstellung eines lokalen VIRKI Docker-Stacks.",
    defaultPayload: {
      tenant_id: "schulze-bedachungen",
      company_name: "Schulze Bedachungen GmbH",
      type: "docker_stack",
    },
  },
  {
    id: "provision_cloud_run",
    name: "GCP Cloud Run Serverless Provisionierung",
    category: "Provisionierung & Automation",
    method: "POST",
    path: "/v1/instances/provision",
    description: "Provisioniert Serverless Container in Region europe-west3 (Frankfurt).",
    defaultPayload: {
      tenant_id: "meyer-kgaa",
      company_name: "Meyer Maschinenbau KGaA",
      type: "gcp_cloud_run",
      region: "europe-west3",
    },
  },
  {
    id: "instance_pause",
    name: "Appliance Compute Pausieren (Kostenstopp)",
    category: "Lifecycle & Kosten",
    method: "POST",
    path: "/v1/instances/inst-nextchapter-local/pause",
    description: "Stoppt CPU/RAM-Container zur Eliminierung laufender Compute-Kosten.",
  },
  {
    id: "instance_start",
    name: "Pausierte Appliance Reaktivieren",
    category: "Lifecycle & Kosten",
    method: "POST",
    path: "/v1/instances/inst-nextchapter-local/start",
    description: "Fährt pausierte Container und Dienste in Sekunden wieder hoch.",
  },
  {
    id: "system_health",
    name: "Control Plane Backend Liveness Probe",
    category: "System & Diagnostics",
    method: "GET",
    path: "/health",
    description: "Systemstatus, Datenbank-Konnektivität und Docker Engine Verfügbarkeit.",
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface ApiEndpointsPanelProps {
  themeStyles: any;
}

export function ApiEndpointsPanel({ themeStyles }: ApiEndpointsPanelProps) {
  const [testResults, setTestResults] = useState<Record<string, { status: number; ok: boolean; latency_ms: number; data?: any; error?: string; loading?: boolean }>>({});
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  const handleTestEndpoint = async (api: ApiDefinition) => {
    setTestResults((prev) => ({
      ...prev,
      [api.id]: { status: 0, ok: false, latency_ms: 0, loading: true },
    }));

    const start = performance.now();
    try {
      const url = `${API_BASE}${api.path}`;
      const res = await fetch(url, {
        method: api.method,
        headers: { "Content-Type": "application/json" },
        ...(api.defaultPayload && api.method === "POST" ? { body: JSON.stringify(api.defaultPayload) } : {}),
      });
      const latency = Math.round(performance.now() - start);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }

      setTestResults((prev) => ({
        ...prev,
        [api.id]: {
          status: res.status,
          ok: res.ok,
          latency_ms: latency,
          data,
          loading: false,
        },
      }));
    } catch (e: any) {
      const latency = Math.round(performance.now() - start);
      setTestResults((prev) => ({
        ...prev,
        [api.id]: {
          status: 502,
          ok: false,
          latency_ms: latency,
          error: e.message || String(e),
          loading: false,
        },
      }));
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    for (const api of APIS) {
      await handleTestEndpoint(api);
    }
    setTestingAll(false);
  };

  const categories = Array.from(new Set(APIS.map((a) => a.category)));

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className={`p-6 rounded-2xl border ${themeStyles.cardBorder} ${themeStyles.cardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm`}>
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className={`text-base font-bold ${themeStyles.titleColor} m-0 tracking-tight font-mono`}>
              CONTROL PLANE API GATEWAY & ENDPUNKT-STEUERUNG
            </h2>
          </div>
          <p className={`text-xs ${themeStyles.subtextColor} m-0 max-w-2xl`}>
            Überwachen und testen Sie alle aktiven Schnittstellen der VIRKI Control Plane (Port 8080). Externe CI/CD-Pipelines und Monitoring-Dienste können diese REST-APIs direkt ansprechen.
          </p>
        </div>
        <button
          onClick={handleTestAll}
          disabled={testingAll}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          [ {testingAll ? "Teste alle..." : "⚡ Alle Endpunkte testen"} ]
        </button>
      </div>

      {/* CATEGORY GROUPS */}
      {categories.map((cat) => {
        const catApis = APIS.filter((a) => a.category === cat);
        return (
          <div key={cat} className="space-y-3">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider text-cyan-400 px-1`}>
              {cat}
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {catApis.map((api) => {
                const result = testResults[api.id];
                const isExpanded = expandedApi === api.id;

                return (
                  <div
                    key={api.id}
                    className={`rounded-xl border ${themeStyles.cardBorder} ${themeStyles.cardBg} transition overflow-hidden`}
                  >
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Method + Path + Name */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              api.method === "GET"
                                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                : api.method === "POST"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {api.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-white tracking-wide">
                            {api.path.split("?")[0]}
                          </span>
                          <span className="text-xs text-slate-300 font-medium hidden sm:inline font-mono">
                            — {api.name}
                          </span>
                        </div>
                        <p className={`text-[11px] ${themeStyles.subtextColor} m-0`}>
                          {api.description}
                        </p>
                      </div>

                      {/* Right: Status / Ping Button / Details Toggle */}
                      <div className="flex items-center gap-2 self-end md:self-auto font-mono text-xs">
                        {result && (
                          <div className="flex items-center gap-2">
                            {result.loading ? (
                              <span className="text-[11px] text-amber-300 animate-pulse font-mono">
                                Teste...
                              </span>
                            ) : result.ok ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 font-mono">
                                🟢 {result.status} OK ({result.latency_ms}ms)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold font-mono">
                                🔴 {result.status || "ERR"} ({result.error || "Fehler"})
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleTestEndpoint(api)}
                          disabled={result?.loading}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${themeStyles.buttonSecondary}`}
                        >
                          {result?.loading ? "..." : "[ ⚡ Testen ]"}
                        </button>

                        <button
                          onClick={() => setExpandedApi(isExpanded ? null : api.id)}
                          className="px-2 py-1.5 text-slate-400 hover:text-white transition cursor-pointer text-xs font-mono"
                          title="Details / Code-Beispiele"
                        >
                          {isExpanded ? "[ ▲ Schließen ]" : "[ ▼ Details ]"}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED DETAILS / JSON PREVIEW / CODE SNIPPET */}
                    {isExpanded && (
                      <div className={`p-4 border-t ${themeStyles.cardBorder} ${themeStyles.cardSubBg} space-y-3 text-xs font-mono`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: cURL Code Snippet */}
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 mb-1.5 uppercase font-mono">
                              cURL Integration Snippet
                            </div>
                            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 overflow-x-auto selection:bg-cyan-500/30 font-mono">
                              {api.method === "GET"
                                ? `curl -s -X GET "http://localhost:8080${api.path}"`
                                : `curl -s -X POST "http://localhost:8080${api.path}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(api.defaultPayload || {}, null, 2)}'`}
                            </pre>
                          </div>

                          {/* Right: Live Test Result JSON */}
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 mb-1.5 uppercase flex items-center justify-between font-mono">
                              <span>Letzte Server-Antwort</span>
                              {result && (
                                <span className="text-[10px] text-slate-500 font-normal font-mono">
                                  Latenz: {result.latency_ms}ms
                                </span>
                              )}
                            </div>
                            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-emerald-300 overflow-x-auto max-h-48 font-mono">
                              {result?.data
                                ? JSON.stringify(result.data, null, 2)
                                : result?.error
                                ? `Fehler: ${result.error}`
                                : "Noch kein Test ausgeführt. Klicken Sie auf '[ ⚡ Testen ]'."}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
