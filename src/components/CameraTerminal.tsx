import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Key, UserCheck, Eye, EyeOff, ShieldAlert, Award, Clock } from "lucide-react";
import { Employee } from "../types";

interface CameraTerminalProps {
  onScanSuccess: (data: any) => void;
  onScanError: (msg: string) => void;
}

export default function CameraTerminal({ onScanSuccess, onScanError }: CameraTerminalProps) {
  const [useIdKeyed, setUseIdKeyed] = useState<boolean>(false);
  const [inputId, setInputId] = useState<string>("");
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  
  // Ticker clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Scanning state
  // "idle" | "capturing" | "verifying" | "success" | "error" | "spoof"
  const [scanState, setScanState] = useState<"idle" | "capturing" | "verifying" | "success" | "error" | "spoof">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("Ready to scan. Please stand in front of the camera.");
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Camera Lifecycle
  useEffect(() => {
    if (cameraActive && scanState !== "success") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraActive, scanState]);

  async function startCamera() {
    setStreamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access denied:", err);
      setStreamError(
        "Could not access standard web camera. Please ensure permissions are granted in your browser."
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  // Handle Scan trigger
  async function triggerScan() {
    if (!videoRef.current || !streamRef.current) {
      setStatusMessage("Webcam is not activated or not ready.");
      return;
    }

    if (useIdKeyed && !inputId.trim()) {
      setStatusMessage("Please enter your Employee ID before scanning.");
      return;
    }

    setScanState("verifying");
    setStatusMessage("Analyzing face biometrics & liveness... Please hold still.");
    setErrorMessage(null);

    try {
      // Capture frame from video element using invisible canvas
      const canvas = document.createElement("canvas");
      canvas.width = 240; // Reduced from 360 to optimize payload size enormously
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Canvas 2D context creation failed");
      }

      // Draw cropped square frame
      const minDim = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      const sx = (videoRef.current.videoWidth - minDim) / 2;
      const sy = (videoRef.current.videoHeight - minDim) / 2;
      
      ctx.drawImage(
        videoRef.current,
        sx, sy, minDim, minDim, // Source crop
        0, 0, 240, 240 // Destination scale
      );

      // Extract 16x16 grayscale biometric signature for lightning-fast server pre-filtering & fallback
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

      const base64JPEG = canvas.toDataURL("image/jpeg", 0.70); // Quality 0.7 reduces transport size to only ~12KB!

      // Compute precise local PC/system Date and Time
      const localNow = new Date();
      const localYear = localNow.getFullYear();
      const localMonth = String(localNow.getMonth() + 1).padStart(2, "0");
      const localDay = String(localNow.getDate()).padStart(2, "0");
      const clientLocalDate = `${localYear}-${localMonth}-${localDay}`;

      const localHours = String(localNow.getHours()).padStart(2, "0");
      const localMinutes = String(localNow.getMinutes()).padStart(2, "0");
      const localSeconds = String(localNow.getSeconds()).padStart(2, "0");
      const clientLocalTime = `${localHours}:${localMinutes}:${localSeconds}`;

      // Post photo packet to Express API
      const reqPayload: any = { 
        image: base64JPEG,
        feature: featureHex,
        clientLocalDate,
        clientLocalTime
      };
      if (useIdKeyed) {
        reqPayload.targetId = inputId.toUpperCase().trim();
      }

      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle custom errors like Spoofing detection or unknown face
        if (data.error === "Liveness verification failed") {
          setScanState("spoof");
          setStatusMessage("Liveness verification failed.");
          setErrorMessage(data.message || data.details);
        } else {
          setScanState("error");
          setStatusMessage(data.error || "Verification failed");
          setErrorMessage(data.message || "Face not registered or alignment incorrect. Ensure clear camera lighting.");
        }
        return;
      }

      // Successful matching check-in or check-out
      setScanState("success");
      setScanResult(data);
      setStatusMessage(data.message);
      onScanSuccess(data);

      // Auto clear success screen after 3 seconds to return to idle terminal faster
      setTimeout(() => {
        resetTerminal();
      }, 3000);

    } catch (error: any) {
      console.error("Facial scan error:", error);
      setScanState("error");
      setStatusMessage("Communication or processing error.");
      setErrorMessage("System failed to process biometrics. Check console terminal or network connection.");
    }
  }

  function resetTerminal() {
    setScanState("idle");
    setScanResult(null);
    setErrorMessage(null);
    setStatusMessage("Ready to scan. Please stand in front of the camera.");
    if (useIdKeyed) {
      setInputId("");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" id="attendance-terminal-container">
      {/* Title block */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl flex items-center justify-center gap-2">
          <Clock className="w-8 h-8 text-slate-900" />
          Biometric Scan Portal
        </h2>
        <p className="mt-2 text-md text-slate-500 font-medium max-w-xl mx-auto">
          Authorized terminals only. Face biometrics verification utilizes real-time snapshot comparison and liveness defense checks.
        </p>
      </div>

      {/* Grid: Camera view & Mode configurations */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Web Camera Screen */}
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm" id="camera-viewport-card">
          <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center text-white border border-slate-900">
            {cameraActive && !streamError && scanState !== "success" ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  id="camera-element"
                />
                
                {/* HUD Camera Target overlay */}
                <div className="absolute inset-0 border-[2px] border-dashed border-white/20 pointer-events-none rounded-2xl m-6"></div>
                
                {/* Facial alignment rounded geometric box */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[190px] h-[250px] md:w-[220px] md:h-[280px] border-2 border-emerald-500/50 rounded-[3.5rem] bg-transparent flex items-center justify-center">
                    <span className="text-[10px] text-emerald-400 font-mono tracking-widest bg-slate-950/90 px-3 py-1 rounded-md mt-[155px] md:mt-[210px] font-bold border border-emerald-500/20">
                      ALIGN FACE
                    </span>
                  </div>
                </div>

                {/* Sweeping Laser Scan Indicator */}
                {scanState === "verifying" && (
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent scanner-laser shadow-[0_0_12px_6px_rgba(52,211,153,0.8)] pointer-events-none"></div>
                )}
              </>
            ) : scanState === "success" && scanResult ? (
              /* Success outcome visual presentation */
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-6 animate-fade-in" id="scan-success-outcome">
                <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-bounce">
                  <UserCheck className="w-10 h-10 text-white" />
                </div>
                
                <span className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest text-emerald-400 mb-2 uppercase font-bold">
                  {scanResult.action === "CHECK_IN" ? "Checked In Successfully" : "Checked Out Successfully"}
                </span>

                <h3 className="text-2xl font-bold text-white mb-1">
                  {scanResult.employee.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  ID: {scanResult.employee.employeeId} • {scanResult.employee.department}
                </p>

                <div className="grid grid-cols-2 gap-4 bg-slate-800/55 border border-slate-700 max-w-sm w-full p-3 rounded-xl mb-4 text-left">
                  <div>
                    <span className="text-xs text-slate-400 block font-sans">TIME RECORDED</span>
                    <span className="text-md font-bold text-white font-mono">{scanResult.time}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-sans">STATUS TARGET</span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      scanResult.status === "Present" 
                        ? "bg-emerald-900/80 text-emerald-200 border border-emerald-700" 
                        : "bg-amber-900/80 text-amber-200 border border-amber-700"
                    }`}>
                      {scanResult.status}
                    </span>
                  </div>
                </div>

                {scanResult.action === "CHECK_OUT" && scanResult.totalWorkingHours !== undefined && (
                  <div className="text-xs text-blue-200 bg-blue-900/40 border border-blue-900/50 px-3 py-1.5 rounded-lg mb-2">
                    ⏱️ Total Working Hours Today: <strong className="text-white text-sm font-mono">{scanResult.totalWorkingHours} hrs</strong>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Match Confidence: {scanResult.confidence}%
                </div>
              </div>
            ) : (
              /* Offline state */
              <div className="text-center p-6">
                <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  {streamError || "Camera feed is deactivated or on refresh hold."}
                </p>
                {streamError && (
                  <button
                    onClick={startCamera}
                    className="mt-3 px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 shadow-md cursor-pointer"
                  >
                    Grant Camera Access
                  </button>
                )}
              </div>
            )}

            {/* Top scanning state status banner */}
            <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm ${
              scanState === "verifying" ? "bg-emerald-950 border border-emerald-800 text-emerald-300" :
              scanState === "success" ? "bg-blue-950 border border-blue-800 text-blue-300" :
              scanState === "spoof" ? "bg-red-950 border border-red-800 text-red-200" :
              scanState === "error" ? "bg-amber-950 border border-amber-800 text-amber-200" :
              "bg-slate-900/90 border border-slate-750 text-slate-300"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                scanState === "verifying" ? "bg-emerald-400 animate-pulse" :
                scanState === "success" ? "bg-blue-500" :
                scanState === "spoof" ? "bg-red-550 animate-bounce" :
                scanState === "error" ? "bg-amber-500" :
                "bg-blue-400"
              }`}></span>
              {scanState === "idle" ? "READY" :
               scanState === "verifying" ? "VERIFYING FACE" :
               scanState === "success" ? "IDENTIFIED" :
               scanState === "spoof" ? "SECURE EXCLUSION" : "SCAN ERROR"}
            </div>
            
            {/* Clock Overlay bottom right */}
            {scanState !== "success" && (
              <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-sm border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1">
                <span>{currentTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Quick error/warnings notice panels */}
          {(errorMessage || scanState === "spoof") && (
            <div className={`mt-3 p-3.5 rounded-xl border flex gap-3 text-sm font-medium ${
              scanState === "spoof" 
                ? "bg-red-50 border-red-200 text-red-800" 
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              {scanState === "spoof" ? (
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold underline block mb-0.5">
                  {scanState === "spoof" ? "Liveness Security Error" : "Face Alignment Error"}
                </span>
                <span className="text-xs leading-relaxed block text-slate-700">
                  {errorMessage || "Please center your face inside the bounding oval frame, eliminate background glare, and scan again."}
                </span>
                <button 
                  onClick={resetTerminal} 
                  className="mt-2 text-xs font-bold text-blue-600 cursor-pointer hover:underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Prompt Message bar */}
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-slate-600 font-sans">
              💡 {statusMessage}
            </p>
          </div>
        </div>

        {/* Action Controls & Mode switch */}
        <div className="md:col-span-4 flex flex-col gap-4">
          
          {/* Real-time UTC Timestamp Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">
              CURRENT DATE
            </span>
            <span className="text-lg font-bold text-slate-900 block font-mono">
              {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          {/* Control terminal parameters */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm" id="terminal-mode-selector">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              Lookup Mode
            </h3>

            {/* Mode switch */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 border border-slate-100">
              <button
                onClick={() => {
                  setUseIdKeyed(false);
                  resetTerminal();
                }}
                className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all select-none cursor-pointer ${
                  !useIdKeyed
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Quick Scan
              </button>
              <button
                onClick={() => {
                  setUseIdKeyed(true);
                  resetTerminal();
                }}
                className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all select-none cursor-pointer ${
                  useIdKeyed
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ID-Keyed Verify
              </button>
            </div>

            {useIdKeyed ? (
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                  Assigned Employee ID
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    placeholder="e.g. EMP-001"
                    disabled={scanState === "verifying"}
                    className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 uppercase font-mono bg-slate-50"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed font-sans">
                  Targeted comparison verifies the face specifically against this registered ID template to guarantee secure precision.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed font-sans mb-4">
                Auto-matching Mode. Stand in front of the lens. The server-side Gemini scanner compares the snapshot in real-time against all registered active staff templates.
              </p>
            )}

            {/* The Scan Action trigger button */}
            <button
              onClick={triggerScan}
              disabled={scanState === "verifying" || (useIdKeyed && !inputId.trim())}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold font-mono uppercase tracking-widest text-white shadow-md flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
                scanState === "verifying"
                  ? "bg-blue-400 cursor-not-allowed shadow-none"
                  : useIdKeyed && !inputId.trim()
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[98%]"
              }`}
              id="terminal-scan-button"
            >
              <Camera className="w-4 h-4" />
              {scanState === "verifying" ? "SCANNING BIOMETRICS..." : "MARK ATTENDANCE"}
            </button>

            {scanState !== "idle" && (
              <button
                onClick={resetTerminal}
                className="w-full mt-2.5 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                Reset Scanner
              </button>
            )}
          </div>

          {/* Quick Instruction Board */}
          <div className="bg-slate-900 text-slate-300 border border-slate-800 rounded-3xl p-5 shadow-sm" id="instructions-card">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              💡 Scan Checklist
            </h4>
            <ul className="text-xs space-y-2 text-slate-400 font-sans list-none leading-relaxed">
              <li className="flex gap-1.5">
                <span className="text-emerald-400">✔</span> Align face within the dotted circle frame.
              </li>
              <li className="flex gap-1.5">
                <span className="text-emerald-400">✔</span> Ensure good face lighting without heavy backlights.
              </li>
              <li className="flex gap-1.5">
                <span className="text-emerald-400">✔</span> Avoid hat layers or heavy dark glasses.
              </li>
              <li className="flex gap-1.5">
                <span className="text-rose-400">✖</span> Spoofing bypass attempts are automatically audited with a flagged security level report.
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
