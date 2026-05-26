import React, { useState } from "react";
import { X, Loader2, PenTool, ShieldAlert } from "lucide-react";
import { Employee } from "../types";

interface ManualCorrectionModalProps {
  token: string | null;
  employees: Employee[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function ManualCorrectionModal({
  token,
  employees,
  onClose,
  onRefresh
}: ManualCorrectionModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [status, setStatus] = useState<"Present" | "Late" | "Half Day" | "Absent">("Present");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !date || !status || !reason.trim()) {
      setError("Please fill in Employee, date, status, and correction reason.");
      return;
    }

    setLoading(true);
    setError(null);

    const body = {
      employeeId,
      date,
      checkInTime: checkInTime || undefined,
      checkOutTime: checkOutTime || undefined,
      status,
      reason: reason.trim()
    };

    try {
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const d = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(d.error || "Failed to submit correction bypass.");
        return;
      }

      onRefresh();
      onClose();
    } catch {
      setLoading(false);
      setError("Network or server connection failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" id="manual-correction-modal-overlay">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-gray-100 p-1 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="h-10 w-10 bg-blue-50 border border-blue-105 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2">
            <PenTool className="w-5 h-5" />
          </div>
          <h4 className="text-md font-bold text-slate-900 font-sans">
            Manual Attendance Adjustment
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            retroactively adjust check-in/out details or create missing entries.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-xs font-semibold leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmitCorrection} className="space-y-4">
          
          {/* Choose Employee */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Staff Member</label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.employeeId}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Target Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full px-2 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Attendance Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status Award</label>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Half Day">Half Day</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          {status !== "Absent" && (
            <div className="grid grid-cols-2 gap-3">
              {/* Check-In */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Check-In Time</label>
                <input
                  type="text"
                  placeholder="e.g. 09:05:00"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Check-Out */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Check-Out Time</label>
                <input
                  type="text"
                  placeholder="e.g. 17:30:00"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Reason for Audit logs */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correction Reason (Required)</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why manual override is required (e.g., Forgotten scan cards, off-site client deployment)."
              className="block w-full px-3 py-1.8 text-xs border border-slate-200 bg-slate-50 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-amber-50 p-3.5 border border-amber-100 rounded-2xl flex gap-2 text-[10px] text-amber-800 leading-normal font-sans">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold underline block mb-0.5">ADMIN SECURITY NOTICE</strong>
              All manual changes are certified and bound to compliance timeline audit logs detailing who initiated the override.
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              type="button"
              className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="w-2/3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold tracking-widest text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  SUBMITTING...
                </>
              ) : (
                "APPLY CORRECTIVE ADJUSTMENT"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
