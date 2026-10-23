export type EmailRecord = {
  id: string; recipient: string; subject: string | null; status: string; reason: string | null; created_at: string;
  delivered_at?: string | null; opened_at?: string | null; clicked_at?: string | null;
};
export type ReceivedEmail = { id: string; sender: string; recipient: string | null; subject: string | null; body: string | null; html?: string | null; received_at: string };
export type MessageDetails = { from?: string; to?: string[]; cc?: string[]; bcc?: string[]; reply_to?: string; html?: string; text?: string; attachments?: { filename: string }[] };
export const address = (value: string) => (value.match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase();
export const subjectKey = (value: string | null) => (value || "").replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase();
export const relatedReplies = (sent: EmailRecord, received: ReceivedEmail[]) => received.filter((r) =>
  address(r.sender) === address(sent.recipient) && !!subjectKey(sent.subject) && subjectKey(r.subject) === subjectKey(sent.subject) && r.received_at >= sent.created_at
);
export function emailStatus(row: EmailRecord) {
  if (["bounced", "spam", "failed"].includes(row.status)) return row.status;
  if (row.clicked_at || row.status === "clicked") return "clicked";
  if (row.opened_at || row.status === "opened") return "opened";
  return ["sent", "delivered", "delayed"].includes(row.status) ? row.status : "pending";
}