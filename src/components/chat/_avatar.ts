// normalize full http(s) OR storage object path (avatars/*) OR base64 data into a usable URL
export const resolveAvatarUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const v = value.trim();
  if (!v || v === 'null' || v === 'undefined') return null;
  
  // Handle base64 data URIs (data:image/...)
  if (v.startsWith('data:')) return v;
  
  // Handle full HTTP URLs
  if (/^https?:\/\//i.test(v)) return v;
  
  // Handle supabase storage paths - default bucket is "avatars"
  if (v.startsWith('avatars/') || !v.includes('/')) {
    const path = v.startsWith('avatars/') ? v : `avatars/${v}`;
    return `https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/public/${path}`;
  }
  
  // Handle paths that already include bucket name
  return `https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/public/${v}`;
};
