import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailStatus, relatedReplies } from "./emailHistoryModel";
import { emailEventUpdate } from "../../../supabase/functions/_shared/emailStatus";
const row = { id: "1", recipient: "client@example.com", subject: "Interview", status: "sent", reason: null, created_at: "2026-10-23T08:00:00Z" };
describe("email history facts", () => {
  it("does not treat accepted email as delivered", () => assert.equal(emailStatus(row), "sent"));
  it("shows opened emails distinctly", () => assert.equal(emailStatus({ ...row, status: "opened" }), "opened"));
  it("keeps an opening timestamp when delivery arrives later", () => assert.deepEqual(emailEventUpdate({ status: "opened" }, "delivered", "2026-10-23T08:01:00Z", null), { delivered_at: "2026-10-23T08:01:00Z" }));
  it("matches related replies only from the recipient, same subject, after sending", () => {
    const replies = [
      { id: "yes", sender: "Client <client@example.com>", recipient: null, subject: "Re: Interview", body: "Yes", received_at: "2026-10-23T09:00:00Z" },
      { id: "other", sender: "other@example.com", recipient: null, subject: "Re: Interview", body: "No", received_at: "2026-10-23T09:00:00Z" },
      { id: "old", sender: "client@example.com", recipient: null, subject: "Re: Interview", body: "Old", received_at: "2026-10-22T09:00:00Z" },
    ];
    assert.deepEqual(relatedReplies(row, replies).map((r) => r.id), ["yes"]);
  });
});