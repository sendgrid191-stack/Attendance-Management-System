import React, { useState } from "react";
import { ShieldAlert, Database, Info, RefreshCw, Key, Filter } from "lucide-react";
import { AuditLog } from "../types";

interface SystemAuditLogsProps {
  logs: AuditLog[];
  loading: boolean;
  onRefresh: () => void;
}

export default function SystemAuditLogs({ logs, loading, onRefresh }: SystemAuditLogsProps) {
  const [filterAction, setFilterAction] = useState("");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 bg-white border border-slate-200 rounded-3xl" id="logs-loading-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Loading system compliance logs...</p>
      </div>
    );
  }

  const actionsList = Array.from(new Set(logs.map(l => l.action)));

  const filtered = filterAction === "" 
    ? logs 
    : logs.filter(l => l.action === filterAction);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4" id="system-compliance-audit-card">
      
      {/* Action bar and search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-150">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" />
            System Audit compliance Logs
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Tamper-proof physical timeline audits records for all administrative adjustments and facial scan scans.
          </p>
        </div>

        {/* Reload and Filter choice */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <div className="relative rounded-xl shadow-sm">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value="">All Actions</option>
              {actionsList.map((act, i) => (
                <option key={i} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="p-1 px-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg cursor-pointer flex items-center gap-1 text-xs"
            title="Reload logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ticker scrolling panel */}
      <div className="max-h-[500px] overflow-y-auto bg-slate-950 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-slate-300 space-y-3 shadow-inner custom-terminal">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No compliance records registered for action: {filterAction || "ALL"}</p>
        ) : (
          filtered.map((log) => {
            // Check if action matches a security notice or error
            const isAlert = ["SECURITY_ALERT", "EMPLOYEE_DELETE"].includes(log.action);
            const isSuccess = ["ATTENDANCE_CHECK_IN", "ATTENDANCE_CHECK_OUT"].includes(log.action);

            return (
              <div 
                key={log.id} 
                className={`p-3 rounded-lg border flex gap-3 leading-relaxed transition-all ${
                  isAlert 
                    ? "bg-red-950/40 border-red-900/40 text-red-200" 
                    : isSuccess 
                    ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-300" 
                    : "bg-slate-900/50 border-slate-800/80 text-slate-300"
                }`}
              >
                {/* Prefix Icon */}
                <div className="shrink-0 mt-0.5">
                  {isAlert ? (
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  ) : log.action === "DATABASE_INITIALIZE" ? (
                    <Database className="w-4 h-4 text-blue-400" />
                  ) : log.action === "ADMIN_LOGIN" ? (
                    <Key className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Info className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="grow space-y-1">
                  {/* Title metadata */}
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isAlert ? "bg-red-900 text-red-100" :
                      isSuccess ? "bg-emerald-900 text-emerald-100" :
                      "bg-blue-950 text-blue-205 border border-blue-900/40"
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-gray-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>

                  {/* Body description */}
                  <p className="font-semibold text-slate-200 break-words">{log.details}</p>

                  {/* Author badge */}
                  <div className="text-[10px] text-gray-500">
                    By Operator: <span className="text-blue-400 font-bold">{log.performedBy}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-[10px] text-gray-400 text-right leading-relaxed font-sans mt-2">
        ℹ️ compliance timeline rules and anti-tamper validations are stored in standard local JSON datasets.
      </div>
    </div>
  );
}
