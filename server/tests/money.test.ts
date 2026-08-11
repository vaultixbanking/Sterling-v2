import { describe, expect, it } from "vitest"

import { bpsOf, percentOf, round2, serialize, sum, toMoney } from "../src/lib/money.js"

describe("money", () => {
  it("adds fractional values without float drift", () => {
    // The canonical float failure: 0.1 + 0.2 === 0.30000000000000004
    const total = sum([toMoney("0.10"), toMoney("0.20")])
    expect(total.toFixed(2)).toBe("0.30")
    expect(total.equals(toMoney("0.30"))).toBe(true)
  })

  it("rounds half-up to cents", () => {
    expect(round2(toMoney("1.005")).toFixed(2)).toBe("1.01")
    expect(round2(toMoney("2.344")).toFixed(2)).toBe("2.34")
    expect(round2(toMoney("2.345")).toFixed(2)).toBe("2.35")
  })

  it("computes a percentage fee", () => {
    // The 5% withdrawal fee.
    expect(percentOf(toMoney("100.00"), 5).toFixed(2)).toBe("5.00")
    expect(percentOf(toMoney("33.33"), 5).toFixed(2)).toBe("1.67")
  })

  it("computes basis points for plan returns", () => {
    // Gold plan: 250 bps = 2.50% per day.
    expect(bpsOf(toMoney("1000.00"), 250).toFixed(2)).toBe("25.00")
    // Starter: 120 bps = 1.20%.
    expect(bpsOf(toMoney("250.00"), 120).toFixed(2)).toBe("3.00")
  })

  it("serialises to a fixed two-decimal string", () => {
    expect(serialize(toMoney(5))).toBe("5.00")
    expect(serialize(toMoney("1234.5"))).toBe("1234.50")
  })

  it("sums an empty list to zero", () => {
    expect(sum([]).toFixed(2)).toBe("0.00")
  })
})
