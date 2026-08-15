"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconServer,
  IconCpu,
  IconShieldLock,
  IconBolt,
  IconArrowLeft,
  IconCheck,
  IconTerminal2,
  IconDownload,
} from "@tabler/icons-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function ProvisionWizardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [deployType, setDeployType] = useState<"gcp_vm" | "docker_stack">("gcp_vm");
  const [plan, setPlan] = useState("managed");
  const [zone, setZone] = useState("europe-west3-a");
  const [machineType, setMachineType] = useState("e2-standard-4");
  const [webPort, setWebPort] = useState(8190);
  const [apiPort, setApiPort] = useState(8191);

  const [loading, setLoading] = useState(false);
  const [oneLineScript, setOneLineScript] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !companyName) {
      alert("Bitte Mandanten-ID und Firmenname angeben.");
      return;
    }

    setLoading(true);
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
      router.push("/");
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOneLineInstaller = async () => {
    if (!tenantId) {
      alert("Bitte zuerst eine Mandanten-ID eingeben.");
      return;
    }
    const cleanTenant = tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const script = `curl -sSL "${API_BASE}/v1/install/${cleanTenant}.sh?company=${encodeURIComponent(companyName || "Kunde")}&web_port=${webPort}&api_port=${apiPort}" | bash`;
    setOneLineScript(script);
  };

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-8">
      {/* Header */}
      <div>
        <Link href="/" className="text-xs text-ink-soft hover:underline inline-flex items-center gap-1 mb-2 font-mono">
          <IconArrowLeft size={13} /> Zurück zur Flotte
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
          <IconServer size={28} className="text-signal" />
          Neue VIRKI AI-OS Appliance bereitstellen
        </h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1">
          Wählen Sie zwischen einer gemanagten Google Cloud VM oder einem autarken Docker Container Stack.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Mandanten-Stammdaten */}
        <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-ink pb-3 border-b border-line">1. Mandanten-Stammdaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Mandanten-ID (Identifier)*</label>
              <input
                type="text"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="z.B. meister-schulze"
                className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
              />
              <p className="text-[10px] text-ink-soft mt-1">Kleinbuchstaben, Ziffern und Bindestriche.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Firmenname (Unternehmens-Identität)*</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="z.B. Schulze Bedachungen GmbH"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Admin E-Mail</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@schulze-bedachung.de"
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-line bg-paper text-ink focus:outline-none focus:border-signal"
            />
          </div>
        </div>

        {/* Deployment-Typ */}
        <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-ink pb-3 border-b border-line">2. Bereitstellungs-Infrastruktur</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setDeployType("gcp_vm");
                setPlan("managed");
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative ${
                deployType === "gcp_vm"
                  ? "bg-signal/10 border-signal ring-2 ring-signal/20"
                  : "bg-paper/40 border-line hover:border-line-strong opacity-80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-signal uppercase bg-signal/20 px-2 py-0.5 rounded">
                  🏢 Google Cloud VM
                </span>
                {deployType === "gcp_vm" && <IconCheck size={16} className="text-signal" />}
              </div>
              <h3 className="font-bold text-sm text-ink mb-1">Dedicated Cloud Appliance</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Dedizierte Compute Engine VM in Frankfurt (europe-west3) mit automatischer Skalierung und fester IP.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeployType("docker_stack");
                setPlan("sovereign");
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative ${
                deployType === "docker_stack"
                  ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
                  : "bg-paper/40 border-line hover:border-line-strong opacity-80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-amber-500 uppercase bg-amber-500/20 px-2 py-0.5 rounded">
                  🐳 Docker Stack
                </span>
                {deployType === "docker_stack" && <IconCheck size={16} className="text-amber-500" />}
              </div>
              <h3 className="font-bold text-sm text-ink mb-1">Self-Hosted / On-Prem</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Autarker Multi-Container Stack (Next.js + FastAPI) für den lokalen Server oder Kunden-Infrastruktur.
              </p>
            </button>
          </div>

          {/* Details je nach Typ */}
          {deployType === "gcp_vm" ? (
            <div className="pt-4 border-t border-line/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">GCP Zone</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                >
                  <option value="europe-west3-a">europe-west3-a (Frankfurt)</option>
                  <option value="europe-west3-b">europe-west3-b (Frankfurt)</option>
                  <option value="europe-west1-b">europe-west1-b (Belgien)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Maschinentyp (vCPU / RAM)</label>
                <select
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                >
                  <option value="e2-standard-4">e2-standard-4 (4 vCPU, 16 GB RAM) — Empfohlen</option>
                  <option value="e2-standard-8">e2-standard-8 (8 vCPU, 32 GB RAM) — High Load</option>
                  <option value="e2-medium">e2-medium (2 vCPU, 4 GB RAM) — Test</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-line/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Web Konsole Port</label>
                  <input
                    type="number"
                    value={webPort}
                    onChange={(e) => setWebPort(Number(e.target.value))}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">API Backend Port</label>
                  <input
                    type="number"
                    value={apiPort}
                    onChange={(e) => setApiPort(Number(e.target.value))}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-line bg-paper text-ink"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-paper/60 border border-line">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Kunden-Onboarding per 1-Line Curl Befehl</span>
                  <button
                    type="button"
                    onClick={handleFetchOneLineInstaller}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                  >
                    <IconTerminal2 size={12} /> Befehl generieren
                  </button>
                </div>
                {oneLineScript ? (
                  <div className="bg-black/80 p-3 rounded-lg font-mono text-[11px] text-emerald-400 break-all select-all">
                    {oneLineScript}
                  </div>
                ) : (
                  <p className="text-[11px] text-ink-soft m-0">
                    Klicken Sie auf &quot;Befehl generieren&quot;, um den 1-Zeiler für das Terminal des Kunden zu erhalten.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/" className="btn-secondary text-xs py-2.5 px-4">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-xs py-2.5 px-6 font-bold shadow-md inline-flex items-center gap-2"
          >
            {loading ? (
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
  );
}
