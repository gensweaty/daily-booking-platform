import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailStatus, likePattern, relatedReplies, searchPattern } from "./emailHistoryModel";
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
  it("keeps underscores in a reply lookup as a literal character", () => {
    assert.equal(likePattern("john_smith@company.com"), "%john\\_smith@company.com%");
    assert.equal(likePattern("50%off@x.com"), "%50\\%off@x.com%");
  });
  it("keeps dots, apostrophes and commas in a search term", () => {
    assert.equal(searchPattern("anna@gmail.com"), "anna@gmail.com");
    assert.equal(searchPattern("Don't miss out"), "Don't miss out");
    assert.equal(searchPattern("a,b (fwd)"), "a,b (fwd)");
    assert.equal(searchPattern("john_smith@company.com"), "john_smith@company.com");
  });
  it("drops only the characters that break the filter grammar", () => {
    assert.equal(searchPattern('say "hi"'), "say hi");
    assert.equal(searchPattern("a\\b"), "ab");
    assert.equal(searchPattern("   "), "");
  });
});