import React, { useState, useEffect } from "react";
import { 
  Camera, 
  LayoutDashboard, 
  Users, 
  History, 
  Terminal, 
  Sliders, 
  LogOut, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Clock, 
  BellRing
} from "lucide-react";

import { Employee, AttendanceRecord, AuditLog, Settings, DashboardStats } from "./types";
import CameraTerminal from "./components/CameraTerminal";
import AdminLogin from "./components/AdminLogin";
import DashboardOverview from "./components/DashboardOverview";
import EmployeeDirectory from "./components/EmployeeDirectory";
import AttendanceRecords from "./components/AttendanceRecords";
import SystemAuditLogs from "./components/SystemAuditLogs";
import SettingsPanel from "./components/SettingsPanel";
import ManualCorrectionModal from "./components/ManualCorrectionModal";

export default function App() {
  // Navigation: "terminal" | "admin_panel"
  const [currentView, setCurrentView] = useState<"terminal" | "admin_panel">("terminal");
  
  // LIVE HEADER CLOCK TICKER
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Admin Session Sync
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("attendance_admin_token"));
  const [adminUser, setAdminUser] = useState<any | null>(() => {
    const cached = localStorage.getItem("attendance_admin_user");
    return cached ? JSON.parse(cached) : null;
  });

  // Active Dashboard Tab Choice
  const [adminTab, setAdminTab] = useState<"overview" | "employees" | "records" | "audit_logs" | "settings">("overview");

  // Database lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Loaders
  const [allLoading, setAllLoading] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);

  // Micro-toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  // Trigger brief Toast alert helper
  function triggerToast(message: string, type: "success" | "warning" | "info" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  // Load session me user validation on mount
  useEffect(() => {
    if (token) {
      validateAdminSession();
    }
  }, [token]);

  async function validateAdminSession() {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        // Stale or invalid session
        handleLogout();
      }
    } catch {
      // Offline fallback, do not drop token
    }
  }

  // Refresh all dashboard metrics when switching or triggering refresh
  useEffect(() => {
    if (token && currentView === "admin_panel") {
      fetchAdminData();
    }
  }, [token, currentView]);

  // Load base settings even in public terminal mode
  useEffect(() => {
    fetchPublicSettings();
  }, []);

  async function fetchPublicSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn("Public settings load fail:", err);
    }
  }

  async function fetchAdminData() {
    setAllLoading(true);
    try {
      const [empRes, recRes, auditRes, setRes, statsRes] = await Promise.all([
        fetch("/api/employees", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/attendance/records", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/audit-logs", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/settings"),
        fetch("/api/attendance/stats", { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      if (empRes.ok) setEmployees(await empRes.json());
      if (recRes.ok) setRecords(await recRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (statsRes.ok) setStats(await statsRes.json());

      setAllLoading(false);
    } catch (err) {
      console.error(err);
      setAllLoading(false);
      triggerToast("Error reloading admin database indices.", "warning");
    }
  }

  function handleLoginSuccess(adminToken: string, adminDetails: any) {
    setToken(adminToken);
    setAdminUser(adminDetails);
    localStorage.setItem("attendance_admin_token", adminToken);
    localStorage.setItem("attendance_admin_user", JSON.stringify(adminDetails));
    triggerToast(`Welcome back, ${adminDetails.name}! Session established.`, "success");
    setCurrentView("admin_panel");
  }

  function handleLogout() {
    setToken(null);
    setAdminUser(null);
    localStorage.removeItem("attendance_admin_token");
    localStorage.removeItem("attendance_admin_user");
    triggerToast("Dashboard administrator session logged out.", "info");
    setCurrentView("terminal");
  }

  // Handle successful match callback from terminal webcam scan
  function handleTerminalScanMatch(data: any) {
    // Action could be CHECK_IN or CHECK_OUT
    const label = data.action === "CHECK_IN" ? "Checked In" : "Checked Out";
    triggerToast(`${label}: ${data.employee.name} at ${data.time}`, "success");
    
    // Auto sync statistics behind scenes if admin is watching
    if (token) {
      fetchAdminData();
    }
  }

  function handleTerminalScanError(msg: string) {
    triggerToast(msg, "warning");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900" id="main-application-frame">
      
      {/* Master Top Header bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 justify-between items-center">
          
          {/* Logo and system label */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/10 shrink-0">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-none">
                Attendance Management System
              </h1>
              <span className="text-[11px] font-sans font-semibold text-slate-500 tracking-wide block uppercase mt-1">
                learn, innovate, explore
              </span>
            </div>
          </div>

          {/* Toggle navigation panel & admin login profile info */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Live Ticker Clock */}
            <div className="hidden sm:flex flex-col items-end border-r border-slate-200 pr-4 mt-0.5">
              <span className="text-2xl font-mono font-bold text-blue-600 tracking-tighter leading-none">
                {currentTime.toLocaleTimeString()}
              </span>
              <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">
                {currentTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>

            {/* Nav toggler */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/55">
              <button
                onClick={() => setCurrentView("terminal")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all outline-none select-none cursor-pointer ${
                  currentView === "terminal"
                    ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Capture Terminal
              </button>
              <button
                onClick={() => setCurrentView("admin_panel")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all outline-none select-none cursor-pointer ${
                  currentView === "admin_panel"
                    ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Admin Workspace
              </button>
            </div>

            {/* Logout and Profile section */}
            {token && adminUser && currentView === "admin_panel" && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <button
                  onClick={handleLogout}
                  className="p-2 border border-rose-100 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-all select-none cursor-pointer animate-fade-in"
                  title="Log out operator session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </header>      {/* Main Body container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        {currentView === "terminal" ? (
          
          /* VIEW A: PUBLIC FACE RECOGNITION ATTENDANCE SCAN TERMINAL */
          <div className="flex-grow flex items-center justify-center">
            <CameraTerminal
              onScanSuccess={handleTerminalScanMatch}
              onScanError={handleTerminalScanError}
            />
          </div>
        ) : (
          
          /* VIEW B: ADMIN WORKSPACE MODULE */
          !token ? (
            /* Gateway Gate if not authenticated */
            <div className="flex-grow flex items-center justify-center">
              <AdminLogin onLoginSuccess={handleLoginSuccess} />
            </div>
          ) : (
            /* Admin Workspace Dashboard controls with navigation sidebar */
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="admin-workspace-grid">
              
              {/* Left sidebar directory layout */}
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-h-[440px]">
                <div className="space-y-1.5">
                  <div className="px-1.5 py-1 border-b border-slate-800 mb-4 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase block">Workspace Navigation</span>
                    <span className="text-xs text-slate-500 font-sans font-medium">Authorized operators only</span>
                  </div>

                  {/* Tab items */}
                  <button
                    onClick={() => setAdminTab("overview")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-3 transition-all outline-none cursor-pointer ${
                      adminTab === "overview"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Live Bento Overview
                  </button>

                  <button
                    onClick={() => setAdminTab("employees")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-3 transition-all outline-none cursor-pointer ${
                      adminTab === "employees"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Employee Directory
                  </button>

                  <button
                    onClick={() => setAdminTab("records")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-3 transition-all outline-none cursor-pointer ${
                      adminTab === "records"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <History className="w-4 h-4" />
                    Attendance Records
                  </button>

                  <button
                    onClick={() => setAdminTab("audit_logs")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-3 transition-all outline-none cursor-pointer ${
                      adminTab === "audit_logs"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    System Audit Compliance
                  </button>

                  <button
                    onClick={() => setAdminTab("settings")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-3 transition-all outline-none cursor-pointer ${
                      adminTab === "settings"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    Timing Configurations
                  </button>
                </div>

                {/* Operator Profile layout at bottom of Sidebar */}
                <div className="p-3 border-t border-slate-800 flex items-center gap-3 mt-4">
                  <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-white text-sm uppercase shrink-0">
                    {adminUser?.name ? adminUser.name.charAt(0) : "A"}
                  </div>
                  <div className="flex-1 overflow-hidden text-left">
                    <p className="text-xs font-bold truncate text-white leading-none mb-0.5">{adminUser?.name || "Administrator"}</p>
                    <span className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">Operator Active</span>
                  </div>
                </div>

              </div>

              {/* Right focal dashboard viewport card */}
              <div className="lg:col-span-9">
                {adminTab === "overview" && (
                  <DashboardOverview
                    stats={stats}
                    loading={allLoading}
                    onRefresh={fetchAdminData}
                  />
                )}

                {adminTab === "employees" && (
                  <EmployeeDirectory
                    token={token}
                    employees={employees}
                    onRefresh={fetchAdminData}
                  />
                )}

                {adminTab === "records" && (
                  <AttendanceRecords
                    token={token}
                    records={records}
                    employees={employees}
                    onRefresh={fetchAdminData}
                    onOpenManualCorrection={() => setShowManualModal(true)}
                  />
                )}

                {adminTab === "audit_logs" && (
                  <SystemAuditLogs
                    logs={auditLogs}
                    loading={allLoading}
                    onRefresh={fetchAdminData}
                  />
                )}

                {adminTab === "settings" && (
                  <SettingsPanel
                    token={token}
                    settings={settings}
                    onRefresh={fetchAdminData}
                  />
                )}
              </div>

            </div>
          )
        )}
      </main>

      {/* Manual correction floating modal dialog */}
      {showManualModal && (
        <ManualCorrectionModal
          token={token}
          employees={employees}
          onClose={() => setShowManualModal(false)}
          onRefresh={fetchAdminData}
        />
      )}

      {/* Dynamic Toast Feedback Toast */}
      {toast && (
        <div 
          className={`fixed bottom-5 right-5 z-55 max-w-sm w-full p-4 rounded-2xl border shadow-xl flex gap-3 items-start animate-fade-in ${
            toast.type === "success" 
              ? "bg-slate-900 border-slate-800 text-slate-100 shadow-xl" 
              : toast.type === "warning"
              ? "bg-slate-900 border-slate-800 text-amber-200 shadow-xl"
              : "bg-slate-900 border-slate-800 text-blue-200 shadow-xl"
          }`}
          id="toast-notification-banner"
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === "success" ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : toast.type === "warning" ? (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            ) : (
              <BellRing className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <div className="grow">
            <p className="text-xs font-semibold leading-relaxed font-sans">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="text-xs text-white/45 hover:text-white cursor-pointer select-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center mt-auto text-[10px] text-slate-400 font-mono tracking-wider">
        ATTENDANCE MANAGEMENT SYSTEM • SECURED BY GEMINI BIOMETRICS • LEARN, INNOVATE, EXPLORE
      </footer>

    </div>
  );
}
