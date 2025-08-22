// normalize full http(s) OR storage object path (avatars/*) into a usable URL
export const resolveAvatarUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const v = value.trim();
  if (!v || v === 'null') return null;
  if (/^https?:\/\//i.test(v)) return v;
  // default bucket is "avatars" – adjust if you use another
  return `https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/public/avatars/${v}`;
};
