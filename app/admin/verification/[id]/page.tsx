"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";

interface VerificationData {
  id: number;
  user_id: number;
  status: string;
  rejection_reason: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  country: string | null;
  document_type: string | null;
  id_number: string | null;
  doc_front_url: string | null;
  doc_back_url: string | null;
  official_website: string | null;
  social_links: string | null;
  news_links: string | null;
  brand_proof_url: string | null;
  vat_number: string | null;
  business_website: string | null;
  business_reg_url: string | null;
  company_docs_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
  username: string;
  readable_user_id: string;
  user_type: string;
  profile_picture: string | null;
  is_verified: boolean;
  user_verification_status: string;
}

const STATUS_STYLES: Record<string, { pill: string; icon: string }> = {
  "Verified":     { pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "checkmark-circle" },
  "Under Review": { pill: "bg-amber-500/10  text-amber-400  border-amber-500/20",    icon: "time" },
  "Rejected":     { pill: "bg-rose-500/10   text-rose-400   border-rose-500/20",     icon: "close-circle" },
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-[13px] font-semibold text-slate-200 break-all leading-snug">{value}</p>
    </div>
  );
}

function normalizeDocUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function DocFile({ label, url }: { label: string; url?: string | null }) {
  const [lightbox, setLightbox] = useState(false);
  const [imgError, setImgError] = useState(false);
  if (!url) return null;

  const resolvedUrl = normalizeDocUrl(url);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  return (
    <>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>

        {isPdf ? (
          /* ── PDF: show a download/open tile ── */
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <IonIcon name="document-text-outline" className="text-rose-400 text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">PDF Document · Click to open</p>
            </div>
            <IonIcon name="open-outline" className="text-slate-500 group-hover:text-blue-400 transition-colors text-base shrink-0" />
          </a>
        ) : imgError ? (
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-2 text-slate-600 py-10">
            <IonIcon name="image-outline" className="text-3xl" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Image unavailable</span>
            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline mt-1">Try opening directly</a>
          </div>
        ) : (
          <button
            onClick={() => setLightbox(true)}
            className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/20 transition-all group"
            style={{ paddingBottom: "62%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={resolvedUrl}
              src={resolvedUrl}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
              onError={() => setImgError(true)}
            />
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
              <IonIcon name="expand-outline" className="text-2xl text-white" />
            </span>
          </button>
        )}
      </div>

      {/* Lightbox (images only) */}
      {!isPdf && lightbox && (
        <div
          className="fixed inset-0 z-[300] bg-black/92 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-300">{label}</p>
              <div className="flex items-center gap-3">
                <a
                  href={resolvedUrl}
                  download
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <IonIcon name="download-outline" className="text-sm" /> Download
                </a>
                <button
                  onClick={() => setLightbox(false)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white text-[10px] font-bold transition-colors"
                >
                  <IonIcon name="close-outline" className="text-base" /> Close
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedUrl}
              alt={label}
              className="w-full rounded-2xl border border-white/10 object-contain max-h-[82vh]"
            />
          </div>
        </div>
      )}
    </>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[1.75rem] overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#1a1a1a]">
        <IonIcon name={icon} className="text-slate-500 text-base" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export default function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [data, setData]               = useState<VerificationData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [busy, setBusy]               = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [reason, setReason]           = useState("");
  const [toast, setToast]             = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    adminService.fetchUserVerification(id)
      .then(v => setData(v))
      .catch(err => {
        if (err.message?.includes("No verification") || err.message?.includes("404")) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const approve = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const updated = await adminService.reviewVerification(data.id, "approve");
      setData(prev => prev ? { ...prev, ...updated, status: "Verified" } : prev);
      flash(true, "Verification approved successfully.");
    } catch (err: any) {
      flash(false, err.message || "Failed to approve.");
    } finally { setBusy(false); }
  };

  const reject = async () => {
    if (!data || !reason.trim()) return;
    setBusy(true);
    try {
      const updated = await adminService.reviewVerification(data.id, "reject", reason.trim());
      setData(prev => prev ? { ...prev, ...updated, status: "Rejected", rejection_reason: reason.trim() } : prev);
      setShowReject(false);
      setReason("");
      flash(true, "Verification rejected.");
    } catch (err: any) {
      flash(false, err.message || "Failed to reject.");
    } finally { setBusy(false); }
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  /* ───── Loading ───── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
    </div>
  );

  /* ───── No request yet ───── */
  if (notFound || !data) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/verification" className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/10 transition-all">
          <IonIcon name="arrow-back-outline" className="text-lg" />
        </Link>
        <h1 className="text-lg font-black text-white">Verification Details</h1>
      </div>
      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] py-20 text-center">
        <IonIcon name="shield-outline" className="text-5xl text-slate-700 mb-4 block" />
        <p className="text-slate-400 font-medium text-sm">This user has not submitted a verification request yet.</p>
        <Link href="/admin/verification" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 hover:border-white/10 hover:text-white transition-all">
          <IonIcon name="arrow-back-outline" /> Back to list
        </Link>
      </div>
    </div>
  );

  const st      = STATUS_STYLES[data.status] ?? STATUS_STYLES["Under Review"];
  const isPending = data.status === "Under Review";

  /* ───── Main view ───── */
  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-1/2 top-4 z-[300] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${
          toast.ok ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200" : "bg-rose-950/90 border-rose-500/30 text-rose-200"
        }`}>
          <IonIcon name={toast.ok ? "checkmark-circle-outline" : "alert-circle-outline"} className="text-sm shrink-0" />
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/verification" className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/10 transition-all">
            <IonIcon name="arrow-back-outline" className="text-base" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white leading-none">Verification Details</h1>
            <p className="text-[11px] text-slate-500 mt-1">@{data.username} · User ID: {data.readable_user_id}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${st.pill}`}>
          <IonIcon name={st.icon} className="text-xs" />
          {data.status}
        </span>
      </div>

      {/* Rejection banner */}
      {data.status === "Rejected" && data.rejection_reason && (
        <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl px-5 py-3.5 flex items-start gap-3">
          <IonIcon name="alert-circle" className="text-rose-400 text-base shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Rejection Reason</p>
            <p className="text-xs text-rose-300 font-medium">{data.rejection_reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* User card */}
          <Section icon="person-circle-outline" title="User Account">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 overflow-hidden shrink-0">
                {data.profile_picture
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={normalizeDocUrl(data.profile_picture)} alt="" className="w-full h-full object-cover" />
                  : <IonIcon name="person" className="text-xl" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{data.full_name || data.username}</p>
                <p className="text-[11px] text-slate-400">@{data.username}</p>
                <p className="text-[11px] text-slate-500 italic truncate">{data.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${st.pill}`}>
                <IonIcon name={data.is_verified ? "checkmark-circle" : "ellipse-outline"} className="text-[10px]" />
                {data.is_verified ? "Verified" : "Not Verified"}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-white/5 border-white/5 text-slate-400">
                {data.user_type}
              </span>
            </div>

            <Link
              href={`/admin/users/${data.user_id}`}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-white/10 hover:text-white transition-all"
            >
              <IonIcon name="person-outline" className="text-xs" /> View Profile
            </Link>
          </Section>

          {/* Timeline */}
          <Section icon="time-outline" title="Timeline">
            <div className="space-y-3.5">
              {[
                { label: "Submitted",   val: fmtDateTime(data.submitted_at), icon: "send-outline" },
                { label: "Reviewed",    val: fmtDateTime(data.reviewed_at),  icon: "eye-outline" },
                { label: "Last Update", val: fmtDateTime(data.updated_at),   icon: "refresh-outline" },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <IonIcon name={t.icon} className="text-[10px] text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.label}</p>
                    <p className="text-[11px] font-semibold text-slate-300">{t.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Action */}
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[1.75rem] overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#1a1a1a]">
              <IonIcon name="shield-checkmark-outline" className="text-slate-500 text-base" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isPending ? "Admin Action" : "Re‑Review"}</p>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {data.status !== "Verified" && (
                <button
                  onClick={approve}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-black text-emerald-400 uppercase tracking-wide hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {busy ? <div className="w-3.5 h-3.5 rounded-full border-t-2 border-emerald-400 animate-spin" /> : <IonIcon name="checkmark-circle-outline" className="text-sm" />}
                  Approve Verification
                </button>
              )}
              {data.status !== "Rejected" && (
                <button
                  onClick={() => setShowReject(true)}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-black text-rose-400 uppercase tracking-wide hover:bg-rose-500/20 transition-all disabled:opacity-50"
                >
                  <IonIcon name="close-circle-outline" className="text-sm" />
                  Reject Verification
                </button>
              )}
              {data.status === "Verified" && (
                <p className="text-center text-[10px] text-emerald-400/70 font-semibold py-1">This verification is approved.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Personal info */}
          <Section icon="person-outline" title="Personal Information">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Full Name"     value={data.full_name} />
              <Field label="Email"         value={data.email} />
              <Field label="Phone"         value={data.phone} />
              <Field label="Date of Birth" value={data.date_of_birth ? fmtDate(data.date_of_birth) : null} />
              <Field label="Country"       value={data.country} />
              <Field label="Address"       value={data.address} />
            </div>
          </Section>

          {/* Identity document */}
          {(data.document_type || data.id_number || data.doc_front_url || data.doc_back_url) && (() => {
            const dt = (data.document_type || "").toLowerCase();
            const isPassport = dt.includes("passport");
            const isNic      = dt.includes("nic") || dt.includes("national");
            const isDL       = dt.includes("driving") || dt.includes("license") || dt.includes("licence");

            const frontLabel = isPassport ? "Passport Photo Page"
                             : isNic      ? "NIC — Front"
                             : isDL       ? "Driving License — Front"
                             : "Document — Front";
            const backLabel  = isPassport ? null
                             : isNic      ? "NIC — Back"
                             : isDL       ? "Driving License — Back"
                             : "Document — Back";

            return (
              <Section icon="card-outline" title="Identity Document">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
                  <Field label="Document Type"   value={data.document_type} />
                  <Field label="Document Number" value={data.id_number} />
                </div>
                {(data.doc_front_url || data.doc_back_url) && (
                  <div className={`grid grid-cols-1 gap-4 ${!isPassport && data.doc_back_url ? "sm:grid-cols-2" : ""}`}>
                    <DocFile label={frontLabel}              url={data.doc_front_url} />
                    {!isPassport && backLabel && (
                      <DocFile label={backLabel}             url={data.doc_back_url} />
                    )}
                  </div>
                )}
              </Section>
            );
          })()}

          {/* Authenticity proof */}
          {(data.official_website || data.social_links || data.news_links || data.brand_proof_url) && (
            <Section icon="globe-outline" title="Authenticity Proof">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <Field label="Official Website" value={data.official_website} />
                <Field label="Social Links"     value={data.social_links} />
                <Field label="News / Media"     value={data.news_links} />
              </div>
              {data.brand_proof_url && <DocFile label="Brand Proof" url={data.brand_proof_url} />}
            </Section>
          )}

          {/* Business info */}
          {(data.vat_number || data.business_website || data.business_reg_url || data.company_docs_url) && (
            <Section icon="business-outline" title="Business Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <Field label="VAT Number"       value={data.vat_number} />
                <Field label="Business Website" value={data.business_website} />
              </div>
              {(data.business_reg_url || data.company_docs_url) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DocFile label="Business Registration" url={data.business_reg_url} />
                  <DocFile label="Company Documents"     url={data.company_docs_url} />
                </div>
              )}
            </Section>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] p-7 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <IonIcon name="close-circle-outline" className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Reject Verification</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Provide a clear reason so the user can resubmit.</p>
              </div>
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Document image is unclear or expired..."
              rows={4}
              className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl p-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/30 focus:ring-4 focus:ring-rose-500/5 transition-all resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReject(false); setReason(""); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-wide hover:border-white/10 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={reject}
                disabled={busy || !reason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-black text-rose-400 uppercase tracking-wide hover:bg-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy && <div className="w-3.5 h-3.5 rounded-full border-t-2 border-rose-400 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
