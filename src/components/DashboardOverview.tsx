import React from "react";
import { Users, UserCheck, AlertTriangle, AlertCircle, RefreshCw, ClipboardList, CheckCircle } from "lucide-react";
import { DashboardStats } from "../types";

interface DashboardOverviewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function DashboardOverview({ stats, loading, onRefresh }: DashboardOverviewProps) {
  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl" id="overview-loading-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-slate-400 font-medium">Computing attendance bento metrics...</p>
      </div>
    );
  }

  // Draw SVG lines calculation for Last 7 days trend
  // Let's safe-scale maximum scale values to prevent divide by zero
  const maxScale = Math.max(8, stats.totalEmployees, ...stats.weeklyTrend.map(t => t.present));
  const svgWidth = 500;
  const svgHeight = 160;
  const paddingLeft = 30;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 20;

  const pointsCount = stats.weeklyTrend.length;
  const stepX = (svgWidth - paddingLeft - paddingRight) / (pointsCount - 1 || 1);
  const scaleY = (svgHeight - paddingTop - paddingBottom) / (maxScale || 1);

  // Compute coordinate slots
  const trendPoints = stats.weeklyTrend.map((pt, i) => {
    const x = paddingLeft + i * stepX;
    const y = svgHeight - paddingBottom - pt.present * scaleY;
    return { x, y, present: pt.present, label: pt.day };
  });

  const pathD = trendPoints.length > 0 
    ? `M ${trendPoints[0].x} ${trendPoints[0].y} ` + trendPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaD = trendPoints.length > 0
    ? `${pathD} L ${trendPoints[trendPoints.length - 1].x} ${svgHeight - paddingBottom} L ${trendPoints[0].x} ${svgHeight - paddingBottom} Z`
    : "";

  return (
    <div className="space-y-6" id="dashboard-overview-viewport">
      
      {/* Action Header bar */}
      <div className="flex justify-between items-center bg-white border border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-wide">Workplace Live Dashboard</h3>
          <p className="text-xs text-slate-500 font-sans">Real-time attendance statistics compiled from terminals.</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl cursor-pointer"
          title="Refresh statistics stats"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Bento Grid elements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-bento-grid">
        
        {/* Total employees */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-slate-700 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Total Active Staff</span>
            <span className="text-2xl font-black text-slate-900 block font-mono mt-0.5">{stats.totalEmployees}</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-emerald-700 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="grow">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Present Today</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.presentToday}</span>
              <span className="text-xs text-slate-500 font-medium">/ {stats.totalEmployees}</span>
            </div>
            {/* Breakdowns */}
            <span className="text-[10px] text-emerald-600 font-medium block">
              On Time: {stats.presentOnTime} • Late: {stats.lateToday}
            </span>
          </div>
        </div>

        {/* Late Today */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Late Arrivals</span>
            <span className="text-2xl font-black text-slate-900 block font-mono mt-0.5">{stats.lateToday}</span>
            <span className="text-[10px] text-amber-600 font-medium block">
              Checked in after hours set limit
            </span>
          </div>
        </div>

        {/* Absent Today */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-2xl text-slate-700 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Absent Today</span>
            <span className="text-2xl font-black text-slate-900 block font-mono mt-0.5">{stats.absentToday}</span>
            <span className="text-[10px] text-slate-500 font-medium block">
              Not yet registered scan codes
            </span>
          </div>
        </div>

      </div>

      {/* Grid: SVG Trend Chart & Department Progressions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SVG Live Trend chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            7-Day Attendance Trend
          </h4>

          <div className="relative w-full aspect-[25/8] overflow-hidden bg-gray-50 border border-gray-100 rounded-2xl p-4">
            {/* SVG coordinates drawing */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Horizontal Grid guidelines */}
              <line x1={paddingLeft} y1={paddingTop} x2={svgWidth - paddingRight} y2={paddingTop} stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1={paddingLeft} y1={(svgHeight - paddingBottom + paddingTop) / 2} x2={svgWidth - paddingRight} y2={(svgHeight - paddingBottom + paddingTop) / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1={paddingLeft} y1={svgHeight - paddingBottom} x2={svgWidth - paddingRight} y2={svgHeight - paddingBottom} stroke="#cbd5e1" strokeWidth="1" />

              {/* Area filled graph */}
              {areaD && (
                <path
                  d={areaD}
                  fill="url(#blueAreaGlow)"
                  className="opacity-25"
                />
              )}

              {/* Line path graph */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Gradients definition */}
              <defs>
                <linearGradient id="blueAreaGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Data circle slots */}
              {trendPoints.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {/* Legend popups text */}
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#0f172a"
                    fontFamily="monospace"
                  >
                    {pt.present}
                  </text>
                  {/* Axis Label */}
                  <text
                    x={pt.x}
                    y={svgHeight - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#64748b"
                    fontFamily="sans-serif"
                    fontWeight="500"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}

              {/* Left axis legend counts */}
              <text x={paddingLeft - 6} y={paddingTop + 3} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                {maxScale}
              </text>
              <text x={paddingLeft - 6} y={(svgHeight - paddingBottom + paddingTop) / 2 + 3} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                {Math.round(maxScale / 2)}
              </text>
              <text x={paddingLeft - 6} y={svgHeight - paddingBottom + 3} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                0
              </text>
            </svg>
          </div>
          <p className="mt-2 text-[10px] text-gray-400 font-sans text-right">
            Shows overall daily headcount marked Present, Late, or Half-day.
          </p>
        </div>

        {/* Departments Distribution bar ratios */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              Division Statistics
            </h4>

            {stats.deptDistribution.length === 0 ? (
              <p className="text-xs text-slate-455 py-6 text-center">No active departments declared yet.</p>
            ) : (
              <div className="space-y-4">
                {stats.deptDistribution.map((dept, i) => {
                  const percent = dept.total > 0 ? (dept.present / dept.total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center text-xs mb-1 font-semibold text-slate-700">
                        <span>{dept.department}</span>
                        <span className="font-mono text-slate-500">
                          {dept.present} / {dept.total} Present
                        </span>
                      </div>
                      {/* Custom styled progress bars */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-100 pt-3 mt-4 text-[10px] text-slate-400 leading-normal">
            📊 Departments update automatically when employee profiles get added or edited.
          </div>
        </div>

      </div>

      {/* Ticker Section: Recent scans of today */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Today's Terminal Activity Stream
        </h4>

        {stats.recentLogs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium font-sans">
              No biometric scans recorded yet today. Check-ins will show up here live.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono">
                  <th className="px-4 py-3 text-left">Employee ID</th>
                  <th className="px-4 py-3 text-left">Staff Name</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Check-In</th>
                  <th className="px-4 py-3 text-left">Check-Out</th>
                  <th className="px-4 py-3 text-left">Status Badge</th>
                  <th className="px-4 py-3 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {stats.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 font-sans transition-all">
                    <td className="px-4 py-2.5 font-bold font-mono text-gray-700">{log.employeeId}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{log.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{log.department}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900">{log.checkInTime || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900">{log.checkOutTime || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        log.status === "Present" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        log.status === "Late" 
                          ? "bg-amber-50 text-amber-700 border-amber-200" :
                        log.status === "Half Day" 
                          ? "bg-orange-50 text-orange-700 border-orange-200" :
                        "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-medium text-slate-500">
                      {log.confidence}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
