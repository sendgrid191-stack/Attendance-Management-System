import React, { useState, useEffect, useRef } from "react";
import { Users, Search, Plus, Edit, Trash2, Camera, ShieldCheck, ShieldAlert, Loader2, X, AlertCircle } from "lucide-react";
import { Employee } from "../types";

interface EmployeeDirectoryProps {
  token: string | null;
  employees: Employee[];
  onRefresh: () => void;
}

export default function EmployeeDirectory({ token, employees, onRefresh }: EmployeeDirectoryProps) {
  const [search, setSearch] = useState<string>("");
  const [showForm, setShowForm] = useState<"none" | "create" | "edit">("none");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form states
  const [formEmpId, setFormEmpId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formDesig, setFormDesig] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formJoining, setFormJoining] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Live face template registrar modal states
  const [faceEnrollEmp, setFaceEnrollEmp] = useState<Employee | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // In-app deletion dialog states
  const [deleteEmpTarget, setDeleteEmpTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Face scanner video stream
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraActive]);

  async function startCamera() {
    setEnrollError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Enroll camera denied:", err);
      setEnrollError("Webcam permissions were denied or camera is in use by another application.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  // Handle Create or Edit Submit
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const body = {
      employeeId: formEmpId.trim(),
      name: formName.trim(),
      department: formDept.trim(),
      designation: formDesig.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      joiningDate: formJoining,
      status: formStatus
    };

    const url = showForm === "create" ? "/api/employees" : `/api/employees/${selectedEmp?.id}`;
    const method = showForm === "create" ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      setFormLoading(false);

      if (!res.ok) {
        setFormError(data.error || "Failed to update employee template.");
        return;
      }

      setShowForm("none");
      onRefresh();
    } catch (err) {
      setFormLoading(false);
      setFormError("Communication failure during saving.");
    }
  }

  // Open Edit parameters
  function triggerEdit(emp: Employee) {
    setSelectedEmp(emp);
    setFormEmpId(emp.employeeId);
    setFormName(emp.name);
    setFormDept(emp.department);
    setFormDesig(emp.designation);
    setFormEmail(emp.email);
    setFormPhone(emp.phone);
    setFormJoining(emp.joiningDate);
    setFormStatus(emp.status);
    setFormError(null);
    setShowForm("edit");
  }

  // Open Create settings
  function triggerCreate() {
    setSelectedEmp(null);
    setFormEmpId("");
    setFormName("");
    setFormDept("Engineering");
    setFormDesig("");
    setFormEmail("");
    setFormPhone("");
    setFormJoining(new Date().toISOString().split("T")[0]);
    setFormStatus("Active");
    setFormError(null);
    setShowForm("create");
  }

  // Delete employee trigger
  function triggerDelete(emp: Employee) {
    setDeleteEmpTarget(emp);
    setDeleteError(null);
  }

  // Enroll Face photo save
  async function captureAndEnroll() {
    if (!videoRef.current || !faceEnrollEmp) return;
    setEnrollError(null);
    setEnrollLoading(true);

    try {
      // Build thumbnail canvas representation with optimized compact resolution
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();

      const minDim = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const sx = (videoRef.current.videoWidth - minDim) / 2;
      const sy = (videoRef.current.videoHeight - minDim) / 2;

      ctx.drawImage(
        videoRef.current,
        sx, sy, minDim, minDim,
        0, 0, 240, 240
      );

      // Extract 16x16 grayscale biometric signature for high-speed server matching
      const featureCanvas = document.createElement("canvas");
      featureCanvas.width = 16;
      featureCanvas.height = 16;
      const featureCtx = featureCanvas.getContext("2d");
      let featureHex = "";
      if (featureCtx) {
        featureCtx.drawImage(videoRef.current, sx, sy, minDim, minDim, 0, 0, 16, 16);
        const imgData = featureCtx.getImageData(0, 0, 16, 16);
        const pixels = imgData.data;
        const grayList = [];
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          grayList.push(gray);
        }
        featureHex = grayList.map(v => v.toString(16).padStart(2, '0')).join("");
      }

      const base64JPEG = canvas.toDataURL("image/jpeg", 0.70);
      const faceDataWithFeature = featureHex ? `${base64JPEG}|FEATURE|${featureHex}` : base64JPEG;

      // Save to Express API endpoint
      const res = await fetch(`/api/employees/${faceEnrollEmp.id}/face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          faceData: faceDataWithFeature,
          profilePhoto: base64JPEG // set as main card avatar too (clean photo)
        })
      });

      setEnrollLoading(false);
      if (!res.ok) {
        const d = await res.json();
        setEnrollError(d.error || "Biometric registration failed on server.");
        return;
      }

      setEnrollSuccess(true);
      setTimeout(() => {
        closeFaceEnrollModal();
        onRefresh();
      }, 2000);

    } catch (err) {
      setEnrollLoading(false);
      setEnrollError("Frame capturing failure.");
    }
  }

  function openFaceEnroll(emp: Employee) {
    setFaceEnrollEmp(emp);
    setEnrollSuccess(false);
    setEnrollError(null);
    setCameraActive(true);
  }

  function closeFaceEnrollModal() {
    setCameraActive(false);
    setFaceEnrollEmp(null);
  }

  // Filter list
  const filtered = employees.filter(emp => {
    const s = search.toLowerCase();
    return (
      emp.name.toLowerCase().includes(s) ||
      emp.employeeId.toLowerCase().includes(s) ||
      emp.department.toLowerCase().includes(s) ||
      emp.designation.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6" id="employee-directory-tab">
      
      {/* Search and control bar */}
      <div className="flex flex-col sm:flex-row gap-3.5 justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm items-center">
        <div className="relative rounded-xl shadow-sm w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="block w-full pl-9 pr-3 py-1.8 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
          />
        </div>

        <button
          onClick={triggerCreate}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs font-mono tracking-wider flex items-center justify-center gap-1.5 shadow-sm sm:shadow-md cursor-pointer select-none active:scale-[98%] transition-all"
        >
          <Plus className="w-4 h-4" />
          ADD NEW EMP
        </button>
      </div>

      {/* Grid: Form Editor Block or Main list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Forms block overlay / sidebar card */}
        {showForm !== "none" && (
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative animate-fade-in" id="employee-form-card">
            <button
              onClick={() => setShowForm("none")}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              {showForm === "create" ? "Add New Employee" : "Edit Profile"}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-xs font-semibold leading-relaxed">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Employee ID (Must be unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-101"
                  value={formEmpId}
                  disabled={showForm === "edit"} // Cannot alter unique employeeId once set to guard DB indexes
                  onChange={(e) => setFormEmpId(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 rounded-xl placeholder-slate-400 font-mono uppercase bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Alexander Wright"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 rounded-xl placeholder-slate-400 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="UX Architect"
                    value={formDesig}
                    onChange={(e) => setFormDesig(e.target.value)}
                    className="block w-full px-3 py-1.8 text-xs border border-slate-200 rounded-xl placeholder-slate-400 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="alex.wright@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 rounded-xl placeholder-slate-400 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone number</label>
                <input
                  type="text"
                  placeholder="+1 (555) 123-4567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="block w-full px-3 py-1.8 text-xs border border-slate-200 rounded-xl placeholder-slate-400 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={formJoining}
                    onChange={(e) => setFormJoining(e.target.value)}
                    className="block w-full px-2 py-1.8 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Active Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                    className="block w-full px-2.5 py-1.8 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-mono font-bold tracking-widest flex items-center justify-center gap-1 shadow cursor-pointer select-none"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SAVING...
                  </>
                ) : (
                  "SAVE RECORD"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Directory table */}
        <div className={`${showForm !== "none" ? "lg:col-span-8" : "lg:col-span-12"} bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm`} id="employee-list-card">
          <table className="min-w-full divide-y divide-gray-200 font-sans">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-500 font-bold font-mono tracking-wider uppercase">
                <th className="px-5 py-3.5 text-left">Staff Member</th>
                <th className="px-5 py-3.5 text-left">Department</th>
                <th className="px-5 py-3.5 text-left">Contact Info</th>
                <th className="px-5 py-3.5 text-center">Face Template</th>
                <th className="px-5 py-3.5 text-center">Status Badge</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400 font-medium">
                    No employee match records found. Use "Add New Emp" button above.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const hasFaceRegistered = emp.faceData && emp.faceData.length > 100;

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-all">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {emp.profilePhoto ? (
                            <img
                              src={emp.profilePhoto}
                              alt={emp.name}
                              referrerPolicy="no-referrer"
                              className="h-10 w-10 rounded-xl object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-600 text-sm uppercase">
                              {emp.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-gray-950 block">{emp.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono font-medium tracking-wide">
                              ID: {emp.employeeId} • {emp.designation}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3 font-semibold text-gray-900">
                        {emp.department}
                      </td>

                      <td className="px-5 py-3 leading-relaxed">
                        <span className="block text-gray-600 font-medium">{emp.email}</span>
                        <span className="block text-[10px] text-gray-400 font-mono">{emp.phone || "No phone record"}</span>
                      </td>

                      <td className="px-5 py-3 text-center">
                        {hasFaceRegistered ? (
                          <div className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Enrolled
                          </div>
                        ) : (
                          <button
                            onClick={() => openFaceEnroll(emp)}
                            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-2.5 py-1 rounded-full cursor-pointer transition-all active:scale-95"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Enroll Face
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          emp.status === "Active" 
                            ? "bg-emerald-50 text-emerald-750 border border-emerald-200" 
                            : "bg-gray-100 text-gray-550 border border-gray-250"
                        }`}>
                          {emp.status}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Face scan enrollment shortcut */}
                          <button
                            onClick={() => openFaceEnroll(emp)}
                            className="p-1 px-1.5 border border-gray-250 rounded hover:bg-slate-50 text-gray-700 cursor-pointer"
                            title="Register face scan template"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Edit details */}
                          <button
                            onClick={() => triggerEdit(emp)}
                            className="p-1 px-1.5 border border-gray-250 rounded hover:bg-slate-50 text-blue-600 cursor-pointer"
                            title="Edit details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete profile */}
                          <button
                            onClick={() => triggerDelete(emp)}
                            className="p-1 px-1.5 border border-gray-250 rounded hover:bg-rose-50 text-rose-700 cursor-pointer"
                            title="Delete profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Advanced Biometric Enrollment Camera Modal overlay overlay */}
      {faceEnrollEmp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" id="face-registration-modal">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-fade-in">
            {/* Close button */}
            <button
              onClick={closeFaceEnrollModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <span className="bg-blue-50 border border-blue-100 text-blue-600 rounded-full px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest">
                Enroll Biometrics
              </span>
              <h4 className="text-lg font-bold text-gray-900 font-sans mt-2">
                Register Face: {faceEnrollEmp.name}
              </h4>
              <p className="text-xs text-gray-500 font-medium">
                Alters and registers the employee's default face scan model.
              </p>
            </div>

            {/* Error banner */}
            {enrollError && (
              <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-xs font-semibold leading-relaxed mb-4">
                ⚠️ {enrollError}
              </div>
            )}

            {/* Display screen */}
            <div className="relative aspect-video bg-gray-950 rounded-2xl overflow-hidden flex items-center justify-center text-white border border-gray-800 mb-5">
              {cameraActive && !enrollSuccess ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Circle alignment frame */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[170px] h-[210px] border-2 border-dashed border-emerald-500/60 rounded-[3rem] flex items-center justify-center">
                      <span className="text-[10px] text-emerald-400 font-mono tracking-widest bg-slate-950/95 px-2.5 py-1 rounded-md mt-[120px] font-bold border border-emerald-500/10">
                        ALIGN FACE
                      </span>
                    </div>
                  </div>
                </>
              ) : enrollSuccess ? (
                /* Success template animation */
                <div className="text-center">
                  <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2.5 animate-bounce" />
                  <p className="text-sm font-bold text-emerald-400 font-mono tracking-widest uppercase mb-1">Face template Enrolled</p>
                  <p className="text-xs text-emerald-200">Enrolled biometrics uploaded successfully!</p>
                </div>
              ) : (
                <div className="text-center p-4">
                  <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 leading-normal">
                    Camera de-activated or loading stream...
                  </p>
                </div>
              )}
            </div>

            {/* Instructions list */}
            {!enrollSuccess && (
              <ul className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 p-3 rounded-2xl space-y-1.5 list-none mb-5">
                <li className="flex gap-1">⏱️ Hold employee face flat in front of camera.</li>
                <li className="flex gap-1">⏱️ Keep background plain and verify no backlights.</li>
                <li className="flex gap-1">⏱️ Biometrics are encrypted and stored safely.</li>
              </ul>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={closeFaceEnrollModal}
                className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs cursor-pointer text-center"
              >
                Cancel
              </button>
              
              {!enrollSuccess && (
                <button
                  onClick={captureAndEnroll}
                  disabled={enrollLoading || !cameraActive}
                  className={`w-2/3 py-2.5 text-xs font-mono font-bold tracking-widest text-white shadow-md flex items-center justify-center gap-1.5 rounded-xl cursor-pointer ${
                    enrollLoading || !cameraActive
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {enrollLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      ENROLLING...
                    </>
                  ) : (
                    "CAPTURE & BIO-REGISTER"
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Visual Confirm Deletion Modal Dialog */}
      {deleteEmpTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" id="delete-employee-modal">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-fade-in text-center">
            
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-gray-900 font-sans">
              Delete Employee Profile?
            </h4>
            
            <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
              Are you absolutely sure you want to delete the profile for <strong className="text-gray-950 font-bold">{deleteEmpTarget.name} ({deleteEmpTarget.employeeId})</strong>?
            </p>
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 mt-3 font-semibold text-left leading-relaxed">
              ⚠️ This will permanently remove their face scan biometric templates and delete ALL of their historic attendance records from the system. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3 text-center">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 justify-center items-center mt-5">
              <button
                onClick={() => setDeleteEmpTarget(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/employees/${deleteEmpTarget.id}`, {
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
                    setDeleteEmpTarget(null);
                  } catch (err: any) {
                    setDeleteError(`Error deleting profile: ${err?.message || err}`);
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
