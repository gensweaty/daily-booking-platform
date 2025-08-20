import { supabase } from "@/integrations/supabase/client";

export async function resolveAvatarUrl(raw?: string | null) {
  if (!raw || !raw.trim()) return null;
  // Already absolute
  if (/^https?:\/\//i.test(raw)) return raw;

  // Most installs keep avatars in the 'avatars' bucket
  // Try signed first (private bucket friendly)
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(raw.replace(/^\/+/, ""), 3600); // 1h

  if (!error && data?.signedUrl) return data.signedUrl;

  // fallback: public path
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(raw.replace(/^\/+/, ""));
  return pub?.publicUrl || null;
}
