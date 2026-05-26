import React, { useState, useEffect } from "react";
import { Sliders, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { Settings } from "../types";

interface SettingsPanelProps {
  token: string | null;
  settings: Settings | null;
  onRefresh: () => void;
}

export default function SettingsPanel({ token, settings, onRefresh }: SettingsPanelProps) {
  const [officeStartTime, setOfficeStartTime] = useState("09:00");
  const [officeHalfDayTime, setOfficeHalfDayTime] = useState("12:00");
  const [officeEndTime, setOfficeEndTime] = useState("17:00");
  const [antiSpoofingLevel, setAntiSpoofingLevel] = useState<"Low" | "Medium" | "High">("Medium");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync settings payload locally
  useEffect(() => {
    if (settings) {
      setOfficeStartTime(settings.officeStartTime);
      setOfficeHalfDayTime(settings.officeHalfDayTime);
      setOfficeEndTime(settings.officeEndTime);
      setAntiSpoofingLevel(settings.antiSpoofingLevel);
    }
  }, [settings]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    const body = {
      officeStartTime,
      officeHalfDayTime,
      officeEndTime,
      antiSpoofingLevel
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      setLoading(false);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save corporate parameters.");
        return;
      }

      setSuccess(true);
      onRefresh();
      
      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (err) {
      setLoading(false);
      setError("Communication failed during settings upload.");
    }
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center py-10 bg-white border border-slate-200 rounded-3xl" id="settings-loading-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium font-sans">Syncing configuration values...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm max-w-xl mx-auto" id="corporate-timings-config-card">
      <div className="border-b border-gray-150 pb-3 mb-5">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 font-sans">
          <Sliders className="w-4 h-4 text-blue-600" />
          General Timing Settings
        </h3>
        <p className="text-xs text-slate-500 font-sans mt-0.5">
          Configure office check-in thresholds, late grace hours, and liveness biometrics filters.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-xs font-semibold leading-relaxed">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-xs font-semibold leading-relaxed flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          Settings persisted successfully and audit logs written!
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4">
        
        {/* Office Start Time */}
        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Office Start Time</label>
            <p className="text-[10px] text-slate-400 leading-normal">Scans after this time are tagged 'Late'.</p>
          </div>
          <input
            type="time"
            required
            value={officeStartTime}
            onChange={(e) => setOfficeStartTime(e.target.value)}
            className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Office Half-Day Threshold */}
        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Half-Day Threshold</label>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">Arrivals past this hour marked 'Half Day'.</p>
          </div>
          <input
            type="time"
            required
            value={officeHalfDayTime}
            onChange={(e) => setOfficeHalfDayTime(e.target.value)}
            className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Office End Time */}
        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Office Close Time</label>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">Standard check-out hour for metric averages.</p>
          </div>
          <input
            type="time"
            required
            value={officeEndTime}
            onChange={(e) => setOfficeEndTime(e.target.value)}
            className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Anti-spoof Level */}
        <div className="grid grid-cols-2 gap-4 items-center border-t border-gray-100 pt-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">AI Anti-Spoofing Filter</label>
            <p className="text-[10px] text-slate-400 leading-normal font-sans">Liveness security checking filter strictness.</p>
          </div>
          <select
            value={antiSpoofingLevel}
            onChange={(e) => setAntiSpoofingLevel(e.target.value as "Low" | "Medium" | "High")}
            className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Low">Low (Basic checks, high speed)</option>
            <option value="Medium">Medium (Balanced, rejects plain paper)</option>
            <option value="High">High (Strict screen reflections and glare checks)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-mono font-bold tracking-widest flex items-center justify-center gap-1 shadow cursor-pointer select-none active:scale-[99%]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              UPLOADING PARAMETERS...
            </>
          ) : (
            "PERSIST TIMING CONFIGURATION"
          )}
        </button>

      </form>
    </div>
  );
}
