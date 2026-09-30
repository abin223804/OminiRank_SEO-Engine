"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Palette,
  Globe,
  Upload,
  Mail,
  Building,
  Check,
  X,
  Loader2,
  Sparkles,
  Eye,
  Sliders,
} from "lucide-react";

interface AgencyBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  initialDomain?: string | null;
  initialBranding?: {
    companyName?: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    customSenderEmail?: string;
  } | null;
  onSave?: (updated: any) => void;
}

const COLOR_PRESETS = [
  { name: "Cyan Obsidian", primary: "#06b6d4", accent: "#10b981" },
  { name: "Emerald Cyber", primary: "#10b981", accent: "#06b6d4" },
  { name: "Neon Violet", primary: "#8b5cf6", accent: "#ec4899" },
  { name: "Amber Gold", primary: "#f59e0b", accent: "#ef4444" },
  { name: "Electric Blue", primary: "#3b82f6", accent: "#06b6d4" },
];

export function AgencyBrandingModal({
  isOpen,
  onClose,
  workspaceId,
  initialDomain,
  initialBranding,
  onSave,
}: AgencyBrandingModalProps) {
  const [companyName, setCompanyName] = useState(initialBranding?.companyName || "");
  const [customDomain, setCustomDomain] = useState(initialDomain || "");
  const [logoUrl, setLogoUrl] = useState(initialBranding?.logoUrl || "");
  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primaryColor || "#06b6d4");
  const [accentColor, setAccentColor] = useState(initialBranding?.accentColor || "#10b981");
  const [senderEmail, setSenderEmail] = useState(initialBranding?.customSenderEmail || "");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDomain: customDomain.trim() || null,
          branding: {
            companyName: companyName.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined,
            primaryColor,
            accentColor,
            customSenderEmail: senderEmail.trim() || undefined,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update branding settings");
      }

      const data = await res.json();
      setSavedSuccess(true);
      if (onSave) onSave(data);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-500/20 bg-neutral-950 p-6 shadow-2xl shadow-cyan-500/10 focus:outline-none max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  White-Label Agency Branding
                  <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400">
                    Agency Tier
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-sm text-neutral-400">
                  Deliver executive reports and client portals with your custom brand identity.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Form Fields */}
          <div className="space-y-5 py-5">
            {error && (
              <div className="p-3 text-sm rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                {error}
              </div>
            )}

            {savedSuccess && (
              <div className="p-3 text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Branding settings saved successfully!
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agency Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-cyan-400" /> Agency / Brand Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Digital Growth"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              {/* Custom Domain */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" /> Custom Portal Domain
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="e.g. seo.agencyclient.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo URL */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" /> Agency Logo URL (SVG / PNG)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://agency.com/logo.svg"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              {/* Sender Email */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Digest Sender Email
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="radar@agency.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Color Scheme Picker */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Brand Color Palette
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setAccentColor(preset.accent);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-300 hover:border-neutral-700 transition"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent }} />
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-neutral-400 block mb-1">Primary Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-800 text-white"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs text-neutral-400 block mb-1">Accent Glow Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-800 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Client Preview */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" /> Live White-Label Client Header Preview
              </label>
              <div
                className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between"
                style={{
                  borderLeftColor: primaryColor,
                  borderLeftWidth: "4px",
                }}
              >
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {(companyName || "OR").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {companyName || "Agency Client Portal"}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {customDomain || "seo.yourdomain.com"}
                    </p>
                  </div>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${primaryColor}22`,
                    color: primaryColor,
                    borderColor: `${primaryColor}55`,
                    borderWidth: "1px",
                  }}
                >
                  Weekly Radar Digest
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white rounded-xl hover:bg-neutral-900 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-emerald-400 hover:opacity-90 rounded-xl transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Save Branding
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
