import React, { useState } from "react";
import { Lock, Mail, Loader2, Key } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: (token: string, admin: any) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all security details.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Incorrect admin email or password.");
        return;
      }

      onLoginSuccess(data.token, data.admin);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Could not communicate with authentication server.");
    }
  }

  return (
    <div className="max-w-md mx-auto my-12" id="admin-login-card">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 bg-blue-50 border border-blue-105 rounded-2xl flex items-center justify-center text-blue-600 mb-3 shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
            Administrator Gateway
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 font-sans">
            Authentication is required to edit templates and view reporting logs.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl text-xs font-semibold leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Admin Email Address
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required
                disabled={loading}
                className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Security Password
              </label>
              <span className="text-[10px] text-slate-400 font-mono">SHA-256 Hashed</span>
            </div>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={loading}
                className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono tracking-widest text-white shadow-md flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer ${
              loading
                ? "bg-blue-300 cursor-not-allowed shadow-none"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[98%]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                VERIFYING ACCESS...
              </>
            ) : (
              "SIGN IN TO SYSTEM"
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-150 pt-4 text-center">
          <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
            Demo Secret key credentials:<br />
            Email: <strong className="text-gray-500">admin@company.com</strong> • Password: <strong className="text-gray-500">adminpassword</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
