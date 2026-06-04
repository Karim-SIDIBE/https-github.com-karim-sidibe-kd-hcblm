import { test } from "node:test";
import assert from "node:assert/strict";
import { remainingSeats, seatAvailable } from "./seats.js";

test("remainingSeats never goes negative", () => {
  assert.equal(remainingSeats(10, 3), 7);
  assert.equal(remainingSeats(5, 5), 0);
  assert.equal(remainingSeats(5, 8), 0); // over-allocated (data drift) clamps to 0
});

test("seatAvailable is false at/over the limit and when no seats are configured", () => {
  assert.equal(seatAvailable(10, 3), true);
  assert.equal(seatAvailable(10, 9), true);
  assert.equal(seatAvailable(10, 10), false); // exactly full
  assert.equal(seatAvailable(10, 11), false);
  assert.equal(seatAvailable(0, 0), false);   // 0 seats configured ⇒ never available
});
