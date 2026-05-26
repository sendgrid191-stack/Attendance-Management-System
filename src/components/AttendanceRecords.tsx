import React, { useState } from "react";
import { ListFilter, Search, Calendar, FileSpreadsheet, RefreshCw, PenTool, CheckCircle, Trash2 } from "lucide-react";
import { AttendanceRecord, Employee } from "../types";

interface AttendanceRecordsProps {
  token: string | null;
  records: AttendanceRecord[];
  employees: Employee[];
  onRefresh: () => void;
  onOpenManualCorrection: () => void;
}

export default function AttendanceRecords({
  token,
  records,
  employees,
  onRefresh,
  onOpenManualCorrection
}: AttendanceRecordsProps) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // In-app deletion dialog states
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<{ id: string; employeeName: string; date: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Delete attendance record trigger
  function triggerDeleteRecord(id: string, empName: string, date: string) {
    setDeleteRecordTarget({ id, employeeName: empName, date });
    setDeleteError(null);
  }

  // Export to CSV spreadsheet routine
  function handleCSVExport() {
    if (records.length === 0) return;

    const headers = [
      "Employee ID",
      "Full Name",
      "Department",
      "Designation",
      "Date",
      "Check-In Time",
      "Check-Out Time",
      "Total Working Hours",
      "Attendance Status",
      "Scan Confidence %"
    ];

    const rows = filteredRecords.map(rec => [
      rec.employeeId,
      rec.employeeName,
      rec.department,
      rec.designation,
      rec.date,
      rec.checkInTime || "—",
      rec.checkOutTime || "—",
      rec.totalWorkingHours !== undefined ? rec.totalWorkingHours : "—",
      rec.status,
      `${rec.scanConfidence}%`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(row => row.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Workplace_Attendance_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filter list locally for dynamic responsiveness
  const filteredRecords = records.filter(rec => {
    // Search lookup
    const s = search.toLowerCase();
    const matchesSearch = 
      rec.employeeName.toLowerCase().includes(s) ||
      rec.employeeId.toLowerCase().includes(s) ||
      rec.employeeEmail.toLowerCase().includes(s);

    // Department match
    const matchesDept = selectedDept === "" || rec.department === selectedDept;

    // Status match
    const matchesStatus = selectedStatus === "" || rec.status === selectedStatus;

    // Date bounds match
    const matchesStartDate = startDate === "" || rec.date >= startDate;
    const matchesEndDate = endDate === "" || rec.date <= endDate;

    return matchesSearch && matchesDept && matchesStatus && matchesStartDate && matchesEndDate;
  });

  // Unique departments for filter choices
  const departmentsList = Array.from(new Set(employees.map(e => e.department)));

  return (
    <div className="space-y-6" id="attendance-records-tab">
      
      {/* Controls: Search, Select filters, and Dates */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <ListFilter className="w-4 h-4 text-blue-600" />
          Filter Parameters
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Text Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Search Employee</label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID or Work email..."
                className="block w-full pl-8 pr-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Department Choice */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-555 uppercase mb-1">Division Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Divisions</option>
              {departmentsList.map((dept, i) => (
                <option key={i} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status Choice */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-555 uppercase mb-1">Status Class</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Date Boundary Range</label>
            <div className="flex gap-2">
              <div className="relative rounded-xl shadow-sm w-1/2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full px-2.5 py-1 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Start"
                />
              </div>
              <div className="relative rounded-xl shadow-sm w-1/2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full px-2.5 py-1 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="End"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Clear filters shortcuts */}
        <div className="flex flex-wrap gap-2.5 border-t border-gray-100 pt-3 justify-between items-center text-xs">
          <span className="text-gray-500">
            Filtered matches: <strong className="text-gray-900 font-mono">{filteredRecords.length}</strong> records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSearch("");
                setSelectedDept("");
                setSelectedStatus("");
                setStartDate("");
                setEndDate("");
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-250 rounded hover:underline text-gray-700 cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-700 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload DB
            </button>
            <button
              onClick={onOpenManualCorrection}
              className="px-3 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 font-semibold hover:bg-blue-100 cursor-pointer flex items-center gap-1 font-mono uppercase text-[10px]"
            >
              <PenTool className="w-3.5 h-3.5 text-blue-600" />
              Manual Correct
            </button>
            <button
              onClick={handleCSVExport}
              disabled={filteredRecords.length === 0}
              className={`px-3 py-1 font-semibold text-[10px] font-mono tracking-wider text-white shadow rounded uppercase flex items-center gap-1.5 cursor-pointer ${
                filteredRecords.length === 0
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              EXPORT CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main logs display table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm" id="records-table-card">
        <table className="min-w-full divide-y divide-gray-200 font-sans">
          <thead>
            <tr className="bg-gray-50 font-mono font-bold text-[10px] uppercase text-gray-500 tracking-wider">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Staff Name</th>
              <th className="px-5 py-3 text-left">Employee ID</th>
              <th className="px-5 py-3 text-left">Check-In</th>
              <th className="px-5 py-3 text-left">Check-Out</th>
              <th className="px-5 py-3 text-center">Total Working Hours</th>
              <th className="px-5 py-3 text-center">Attendance Status</th>
              <th className="px-5 py-3 text-center">Biometrics Conf.</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-gray-400 font-medium">
                  No historic attendance logs match the active filter criteria.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="px-5 py-3 font-bold text-gray-900 font-mono">{rec.date}</td>
                  <td className="px-5 py-3 font-semibold text-gray-950">
                    <div>
                      <span>{rec.employeeName}</span>
                      <span className="block text-[10px] text-gray-400 font-normal leading-normal">{rec.department} ({rec.designation})</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold font-mono text-gray-600">{rec.employeeId}</td>
                  <td className="px-5 py-3 font-mono text-gray-900">{rec.checkInTime || "—"}</td>
                  <td className="px-5 py-3 font-mono text-gray-900">{rec.checkOutTime || "—"}</td>
                  <td className="px-5 py-3 text-center font-bold text-slate-800 font-mono">
                    {rec.totalWorkingHours !== undefined ? `${rec.totalWorkingHours} hrs` : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      rec.status === "Present" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      rec.status === "Late" 
                        ? "bg-amber-50 text-amber-800 border-amber-200" :
                      rec.status === "Half Day" 
                        ? "bg-orange-50 text-orange-850 border-orange-200" :
                      "bg-rose-50 text-rose-750 border-rose-200"
                    }`}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="font-mono text-gray-500 bg-gray-50 border border-gray-150 rounded px-1.5 py-0.5">
                      {rec.scanConfidence}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => triggerDeleteRecord(rec.id, rec.employeeName, rec.date)}
                      className="p-1 px-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer inline-flex items-center gap-1 text-[10px] font-mono tracking-wider"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      DELETE
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Visual Confirm Deletion Modal Dialog for Attendance Log */}
      {deleteRecordTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" id="delete-record-modal">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-fade-in text-center">
            
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-gray-900 font-sans">
              Delete Attendance Record?
            </h4>
            
            <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
              Are you absolutely sure you want to delete the attendance log for <strong className="text-gray-950 font-bold">{deleteRecordTarget.employeeName}</strong> on <strong className="text-gray-950 font-mono font-bold">{deleteRecordTarget.date}</strong>?
            </p>
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 mt-3 font-semibold text-left leading-relaxed">
              ⚠️ This will permanently remove this precise check-in/check-out timestamp log from the database. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3 text-center">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 justify-center items-center mt-5">
              <button
                onClick={() => setDeleteRecordTarget(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/attendance/records/${deleteRecordTarget.id}`, {
                      method: "DELETE",
                      headers: {
                        "Authorization": `Bearer ${token}`
                      }
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      setDeleteError(`Deletion failed: ${errData.error || "Unknown server error"}`);
                      return;
                    }
                    onRefresh();
                    setDeleteRecordTarget(null);
                  } catch (err: any) {
                    setDeleteError(`Error deleting record: ${err?.message || err}`);
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-rose-500/10 transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
