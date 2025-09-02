export function getEffectivePublicEmail(pathname: string, meEmail?: string): string | undefined {
  if (meEmail) return meEmail;
  try {
    const slug = pathname.split('/').pop()!;
    const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
    return stored.external_user_email || stored.email || undefined;
  } catch { 
    return undefined; 
  }
}