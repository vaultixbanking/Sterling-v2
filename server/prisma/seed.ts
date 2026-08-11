// Side-effect import: populates process.env from .env. The seed is its own
// entry point, so it has to load configuration the same way the server does.
import "../src/config/load-env.js"

import { randomUUID } from "node:crypto"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

/**
 * Idempotent seed: an admin account and the four investment plans.
 *
 * Plan figures mirror `src/lib/site.ts` in the Next.js app so the marketing
 * page and the API can never disagree. If you change one, change both.
 *
 * SwiftEdge seeded `admin`/`admin123` whenever ADMIN_PASSWORD was unset,
 * silently creating a known-credentials admin on any public instance. This
 * refuses to run without a real password.
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL must be set to seed.")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const BCRYPT_ROUNDS = 12

const PLANS = [
  {
    slug: "starter",
    name: "Starter",
    dailyReturnBps: 120, // 1.20%
    durationDays: 14,
    minDeposit: "250",
    maxDeposit: "4999",
    referralBonusPercent: 5,
    description:
      "For first-time investors who want to learn the platform with capital they're comfortable with.",
    features: [
      "Access to all four markets",
      "Standard charting tools",
      "Email support",
      "Capital returned at term end",
      "5% referral bonus",
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    slug: "silver",
    name: "Silver",
    dailyReturnBps: 180, // 1.80%
    durationDays: 21,
    minDeposit: "5000",
    maxDeposit: "24999",
    referralBonusPercent: 7,
    description:
      "For active traders ready to put a serious position to work across multiple asset classes.",
    features: [
      "Everything in Starter",
      "Full technical indicator suite",
      "Copy trading access",
      "Priority email & chat support",
      "7% referral bonus",
    ],
    isPopular: false,
    sortOrder: 2,
  },
  {
    slug: "gold",
    name: "Gold",
    dailyReturnBps: 250, // 2.50%
    durationDays: 30,
    minDeposit: "25000",
    maxDeposit: "99999",
    referralBonusPercent: 10,
    description:
      "Our most popular tier — full platform access with a dedicated manager watching your book.",
    features: [
      "Everything in Silver",
      "Dedicated account manager",
      "Portfolio analyzer & risk tools",
      "Priority withdrawals",
      "10% referral bonus",
      "Quarterly strategy review",
    ],
    isPopular: true,
    sortOrder: 3,
  },
  {
    slug: "platinum",
    name: "Platinum",
    dailyReturnBps: 320, // 3.20%
    durationDays: 45,
    minDeposit: "100000",
    maxDeposit: null,
    referralBonusPercent: 15,
    description:
      "Institutional-grade terms for high-net-worth clients and professional capital allocators.",
    features: [
      "Everything in Gold",
      "Bespoke portfolio structuring",
      "24/7 direct line to your manager",
      "Same-day withdrawals",
      "15% referral bonus",
      "Custom risk mandates",
    ],
    isPopular: false,
    sortOrder: 4,
  },
] as const

async function seedPlans() {
  for (const plan of PLANS) {
    const { slug, maxDeposit, ...rest } = plan
    const data = {
      ...rest,
      features: [...rest.features],
      maxDeposit: maxDeposit ?? null,
    }

    await prisma.plan.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    })
  }
  console.log(`Seeded ${PLANS.length} investment plans.`)
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin"
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      "Skipping admin seed — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one."
    )
    return
  }

  if (password.length < 12) {
    console.error(
      "SEED_ADMIN_PASSWORD must be at least 12 characters. Refusing to seed a weak admin account."
    )
    process.exit(1)
  }

  // Both columns are unique, so checking only the email lets a leftover
  // account holding the username crash the "idempotent" seed.
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })

  if (existing) {
    const clash =
      existing.email === email
        ? `Admin ${email} already exists`
        : `The username "${username}" is already taken by ${existing.email}`
    console.log(`${clash} — leaving it untouched.`)
    return
  }

  await prisma.user.create({
    data: {
      uid: randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase(),
      email,
      username,
      fullName: "Sterling Edge Admin",
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`Created admin ${email}.`)
}

async function main() {
  await seedPlans()
  await seedAdmin()
}

main()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
