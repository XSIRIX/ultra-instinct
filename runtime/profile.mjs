import { PROFILES } from "./contracts.mjs";

export function resolveProfile(raw) {
  if (raw == null || raw === "") return { profile: "guided", warning: null };
  const normalized = String(raw).toLowerCase();
  if (PROFILES.includes(normalized)) return { profile: normalized, warning: null };
  return {
    profile: "guided",
    warning: "Ultra Instinct: unknown profile; using guided.",
  };
}
