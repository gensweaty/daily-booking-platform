import { supabase } from "@/integrations/supabase/client";

/** Returns a usable https URL or null */
export function resolveAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null") return null;
  if (/^https?:\/\//i.test(s)) return s;

  // If it's a file key inside the "avatars" bucket:
  const { data } = supabase.storage.from("avatars").getPublicUrl(s);
  return data?.publicUrl ?? null;
}

/** Quick 2-letter initials fallback */
export function initials(name?: string | null): string {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}