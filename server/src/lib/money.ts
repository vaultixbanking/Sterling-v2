import { Prisma } from "@prisma/client"

/**
 * Money helpers.
 *
 * Every monetary column is `Decimal(18,2)`. Never let a JS number carry a
 * balance — 0.1 + 0.2 is not 0.3, and SwiftEdge did all of its arithmetic in
 * floats.
 */

export type Money = Prisma.Decimal

export const ZERO: Money = new Prisma.Decimal(0)

export function toMoney(value: Prisma.Decimal.Value): Money {
  return new Prisma.Decimal(value)
}

/** Rounds to 2dp, half-up — the convention for currency. */
export function round2(value: Money): Money {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function sum(values: Money[]): Money {
  return values.reduce<Money>((total, value) => total.add(value), ZERO)
}

export function isPositive(value: Money): boolean {
  return value.greaterThan(0)
}

/** Serialises a Decimal for JSON. Sending it raw yields an object, not a number. */
export function serialize(value: Money): string {
  return round2(value).toFixed(2)
}

/** Percentage of an amount, rounded to cents. */
export function percentOf(amount: Money, percent: number): Money {
  return round2(amount.mul(percent).div(100))
}

/** Basis points of an amount (120 bps = 1.20%), rounded to cents. */
export function bpsOf(amount: Money, bps: number): Money {
  return round2(amount.mul(bps).div(10_000))
}
