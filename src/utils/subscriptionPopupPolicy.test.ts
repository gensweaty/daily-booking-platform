import { it } from "node:test";
import assert from "node:assert/strict";
import { SUBSCRIPTION_EXPIRATION_POPUPS_ENABLED } from "./subscriptionPopupPolicy";

it("keeps expiration popups disabled until explicitly restored", () => {
  assert.equal(SUBSCRIPTION_EXPIRATION_POPUPS_ENABLED, false);
});