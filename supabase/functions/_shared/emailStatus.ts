export const EMAIL_RANK: Record<string, number> = { sent: 1, delayed: 2, delivered: 3, opened: 4, clicked: 5, bounced: 6, spam: 6, failed: 6 };

export function emailEventUpdate(current: { status: string; delivered_at?: string | null; opened_at?: string | null; clicked_at?: string | null }, status: string, at: string, reason: string | null) {
  const update: Record<string, unknown> = {};
  const field = status === "delivered" ? "delivered_at" : status === "opened" ? "opened_at" : status === "clicked" ? "clicked_at" : null;
  if (field && (!current[field] || at < current[field])) update[field] = at;
  if ((EMAIL_RANK[status] || 0) >= (EMAIL_RANK[current.status] || 0)) {
    update.status = status;
    update.reason = reason;
  }
  return update;
}