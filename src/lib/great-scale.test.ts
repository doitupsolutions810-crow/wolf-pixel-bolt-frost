import test from "node:test";
import assert from "node:assert/strict";
import {
  CIRCLE_FIXED_POINTS,
  DESCENTS,
  FIXED_POINT,
  MODULUS,
  grainAgreement,
  involution,
  pairing,
  projectToCarrier,
  unitInvolution,
} from "./great-scale.ts";

test("circle involution returns canonical representatives and is an involution", () => {
  for (const x of [-18, -9, -4.5, -1, 0, 1, 4.5, 8, 9, 18]) {
    const y = involution(x);
    assert.ok(y >= 0 && y < MODULUS, `non-canonical output for x=${x}: ${y}`);
    assert.ok(Math.abs(involution(y) - (((x % MODULUS) + MODULUS) % MODULUS)) < 1e-12);
  }
});

test("reflection on the quotient circle has two fixed classes", () => {
  assert.deepEqual(CIRCLE_FIXED_POINTS, [0, FIXED_POINT]);
  for (const x of CIRCLE_FIXED_POINTS) assert.equal(involution(x), x);
  assert.equal(involution(0), 0);
  assert.equal(involution(MODULUS), 0);
  assert.equal(involution(FIXED_POINT), FIXED_POINT);
});

test("unit-circle involution uses the canonical endpoint zero", () => {
  assert.equal(unitInvolution(0), 0);
  assert.equal(unitInvolution(1), 0);
  assert.equal(unitInvolution(0.25), 0.75);
  assert.equal(unitInvolution(0.5), 0.5);
  assert.equal(unitInvolution(0.75), 0.25);
});

test("carrier projection preserves the origin fixed class and projects interior pairs", () => {
  assert.equal(projectToCarrier(0), 0);
  assert.equal(projectToCarrier(1), 0);
  for (const u of [0.125, 0.25, 0.5, 0.75, 0.875]) {
    assert.ok(Math.abs(projectToCarrier(u) - 0.5) < 1e-12);
  }
});

test("integer pairing uses canonical representatives rather than duplicate endpoint 9", () => {
  assert.deepEqual(pairing(), [[1, 8], [2, 7], [3, 6], [4, 5], [0, 0]]);
});

test("normalized grain agreement remains zero after canonicalization", () => {
  assert.ok(grainAgreement() < 1e-12);
});

test("quantum-geometric numerical descents are registered in Great Scale", () => {
  assert.deepEqual(DESCENTS.slice(-4), [
    { id: "XCI", name: "Quotient-circle fixed-point audit" },
    { id: "XCII", name: "Stable QWZ spinor normalization" },
    { id: "XCIII", name: "QGT scale covariance" },
    { id: "XCIV", name: "QGT positivity tolerance diagnostics" },
  ]);
});
