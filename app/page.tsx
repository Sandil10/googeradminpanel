"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import IonIcon from "@/components/IonIcon";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const submitting = useRef(false);

  useEffect(() => {
    // If already logged in as superadmin, redirect to admin panel
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (token && user?.user_type === "superadmin") {
        router.replace("/admin");
      }
    } catch (_) {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let data: any = null;
      try { data = await res.json(); } catch (_) {}

      if (!res.ok || !data?.token) {
        setError(data?.message || "Invalid credentials. Please try again.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/admin");
    } catch (err: any) {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] justify-center items-center bg-black py-12">
      <div className="max-w-md mx-auto md:px-10 p-4 w-full">
        <div className="bg-black p-8 rounded-3xl border border-purple-500/20 shadow-[0_0_50px_-12px_rgba(168,85,247,0.1)]">
          <div className="flex flex-col items-center justify-center mb-8">
            <Image
              src="/assets/images/googer.png"
              alt="Googer Logo"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-800 bg-[#eef0f8] text-black focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-400 text-sm"
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />

            <div className="relative">
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-800 bg-[#eef0f8] text-black focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-gray-400 pr-12 text-sm"
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                <IonIcon name={showPassword ? "eye-outline" : "eye-off-outline"} className="text-xl" />
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="font-bold w-full rounded-full bg-white text-black py-3 px-4 shadow-lg hover:bg-gray-200 active:scale-[0.97] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-sm"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
