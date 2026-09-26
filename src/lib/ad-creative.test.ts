import assert from "node:assert/strict";
import { test } from "node:test";
import { adCreativeSchema } from "./ad-creative";

const creative = {
  title: "Sample ad",
  description: "A useful product for everyday work",
  url: "https://example.com/product",
};

test("edited creatives accept safe HTTPS destinations", () => {
  assert.equal(adCreativeSchema.safeParse(creative).success, true);
});

test("editing cannot include price or budget and rejects unsafe URLs", () => {
  assert.equal(adCreativeSchema.safeParse({ ...creative, budgetYen: 1 }).success, false);
  assert.equal(
    adCreativeSchema.safeParse({ ...creative, url: "http://example.com" }).success,
    false,
  );
  assert.equal(
    adCreativeSchema.safeParse({ ...creative, url: "https://localhost/private" }).success,
    false,
  );
  assert.equal(
    adCreativeSchema.safeParse({ ...creative, url: "https://127.0.0.1/" }).success,
    false,
  );
});
