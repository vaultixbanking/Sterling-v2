import {
  BadgeDollarSign,
  BarChart3,
  Bitcoin,
  CandlestickChart,
  CheckCircle2,
  Coins,
  CreditCard,
  Gem,
  Globe,
  LineChart,
  Lock,
  PieChart,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Company                                                                    */
/* -------------------------------------------------------------------------- */

export const company = {
  name: "Sterling Edge Trade",
  shortName: "Sterling Edge",
  tagline: "Trade Forex, Crypto, Stocks & Commodities",
  description:
    "Sterling Edge Trade is a secure multi-asset brokerage built for serious investors. Trade over 1,000 instruments across forex, crypto, stocks and commodities with institutional-grade tools, tight spreads and 24/7 support.",
  email: "support@sterlingedgetrade.com",
  phone: "+1 (888) 470-2255",
  phoneHref: "+18884702255",
  url: "https://sterlingedgetrade.com",
  address: "48 Wall Street, 11th Floor, New York, NY 10005",
  hours: "Support available 24 hours a day, 7 days a week",
  social: {
    x: "#",
    linkedin: "#",
    facebook: "#",
    instagram: "#",
  },
}

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export interface NavLink {
  label: string
  href: string
}

export const navLinks: NavLink[] = [
  { label: "Markets", href: "#markets" },
  { label: "Platform", href: "#platform" },
  { label: "Plans", href: "#plans" },
  { label: "Why Us", href: "#why-us" },
  { label: "FAQ", href: "#faq" },
]

export const footerLinks: { title: string; links: NavLink[] }[] = [
  {
    title: "Markets",
    links: [
      { label: "Forex", href: "#markets" },
      { label: "Cryptocurrencies", href: "#markets" },
      { label: "Stocks & Indices", href: "#markets" },
      { label: "Commodities", href: "#markets" },
      { label: "Live Prices", href: "#live-markets" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Trading Tools", href: "#platform" },
      { label: "Copy Trading", href: "#copy-trading" },
      { label: "Investment Plans", href: "#plans" },
      { label: "How It Works", href: "#how-it-works" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why Sterling Edge", href: "#why-us" },
      { label: "Testimonials", href: "#testimonials" },
      { label: "FAQ", href: "#faq" },
      { label: "Contact Support", href: `mailto:${company.email}` },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Open an Account", href: "/signup" },
      { label: "Sign In", href: "/login" },
      { label: "Reset Password", href: "/forgot-password" },
    ],
  },
]

export const legalLinks: NavLink[] = [
  { label: "Terms of Service", href: "#faq" },
  { label: "Privacy Policy", href: "#faq" },
  { label: "Risk Disclosure", href: "#faq" },
]

/* -------------------------------------------------------------------------- */
/*  Hero stats                                                                 */
/* -------------------------------------------------------------------------- */

export interface Stat {
  /** Numeric target for the count-up animation */
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  label: string
}

export const stats: Stat[] = [
  { value: 10000, suffix: "+", label: "Active investors" },
  { value: 1000, suffix: "+", label: "Tradable instruments" },
  { value: 100, suffix: "+", label: "Countries served" },
  { value: 2.4, prefix: "$", suffix: "B+", decimals: 1, label: "Volume traded" },
]

/* -------------------------------------------------------------------------- */
/*  Markets                                                                    */
/* -------------------------------------------------------------------------- */

export interface Market {
  name: string
  slug: string
  description: string
  instruments: string
  spread: string
  icon: LucideIcon
  /** Tailwind gradient pair used for the icon tile and hover tint */
  gradient: string
}

export const markets: Market[] = [
  {
    name: "Forex",
    slug: "forex",
    description:
      "Trade the world's most liquid market around the clock, from major pairs to exotics, with deep liquidity and rapid execution.",
    instruments: "60+ currency pairs",
    spread: "From 0.1 pips",
    icon: Globe,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Cryptocurrencies",
    slug: "crypto",
    description:
      "Access Bitcoin, Ethereum, Solana and more, traded 24/7 with secure custody and no hidden conversion fees.",
    instruments: "80+ digital assets",
    spread: "From 0.5%",
    icon: Bitcoin,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    name: "Stocks & Indices",
    slug: "stocks",
    description:
      "Take positions on the companies and indices shaping the global economy, from the S&P 500 to individual blue chips.",
    instruments: "700+ shares & indices",
    spread: "Zero commission",
    icon: CandlestickChart,
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    name: "Commodities",
    slug: "commodities",
    description:
      "Hedge and diversify with gold, silver, oil and natural gas — the assets investors turn to when markets turn.",
    instruments: "25+ commodities",
    spread: "From 0.3 pips",
    icon: Coins,
    gradient: "from-emerald-500 to-teal-500",
  },
]

/* -------------------------------------------------------------------------- */
/*  Why Sterling Edge                                                          */
/* -------------------------------------------------------------------------- */

export interface Feature {
  title: string
  description: string
  icon: LucideIcon
  gradient: string
}

export const features: Feature[] = [
  {
    title: "Privacy first",
    description:
      "Your data is encrypted end to end and never sold. Account details stay between you and your dedicated manager.",
    icon: Lock,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Reliable execution",
    description:
      "Orders fill in milliseconds on infrastructure built for volatility, with 99.9% platform uptime.",
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "Scales with you",
    description:
      "Start with $250 or run a seven-figure book. The platform, tools and support grow alongside your portfolio.",
    icon: Rocket,
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    title: "Funds protected",
    description:
      "Client capital is held in segregated accounts, with cold-storage custody for digital assets and negative-balance protection.",
    icon: ShieldCheck,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    title: "Genuinely low fees",
    description:
      "Tight spreads, zero commission on stocks and no deposit charges. What you earn is what you keep.",
    icon: BadgeDollarSign,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    title: "1,000+ instruments",
    description:
      "One account covering forex, crypto, stocks, indices and commodities — diversify without ever leaving the platform.",
    icon: Gem,
    gradient: "from-fuchsia-500 to-pink-500",
  },
]

/* -------------------------------------------------------------------------- */
/*  Platform tools                                                             */
/* -------------------------------------------------------------------------- */

export interface TradingTool {
  title: string
  description: string
  icon: LucideIcon
  highlights: string[]
  badge?: string
}

export const tradingTools: TradingTool[] = [
  {
    title: "Advanced charting",
    description:
      "Full TradingView integration with over 100 technical indicators, drawing tools and multi-chart layouts.",
    icon: LineChart,
    highlights: ["75+ built-in indicators", "Custom alerts", "Multi-timeframe"],
    badge: "Pro",
  },
  {
    title: "Risk calculator",
    description:
      "Size every position against your risk tolerance and stop loss before you commit a cent of capital.",
    icon: BarChart3,
    highlights: ["Custom risk parameters", "Portfolio-based", "Multi-asset"],
  },
  {
    title: "Portfolio analyzer",
    description:
      "See your allocation, correlation and performance across every asset class in a single view.",
    icon: PieChart,
    highlights: ["Asset correlation", "Performance metrics", "Rebalancing alerts"],
    badge: "Pro",
  },
]

export const toolBenefits: Feature[] = [
  {
    title: "Included with every account",
    description:
      "Every tool is available to all Sterling Edge members at no extra cost — no upsells, no locked tiers.",
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "One-click integration",
    description:
      "Tools read directly from your live account data and open positions. Nothing to configure.",
    icon: Rocket,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Built for mobile",
    description:
      "Full functionality on desktop, tablet and phone. Manage risk from anywhere the market finds you.",
    icon: TrendingUp,
    gradient: "from-indigo-500 to-violet-500",
  },
]

/* -------------------------------------------------------------------------- */
/*  How it works                                                               */
/* -------------------------------------------------------------------------- */

export interface Step {
  title: string
  description: string
  video: string
  icon: LucideIcon
}

export const steps: Step[] = [
  {
    title: "Register",
    description:
      "Open your account in a few clicks. All you need is an email address and a couple of minutes.",
    video: "/videos/reg.mp4",
    icon: Users,
  },
  {
    title: "Verify",
    description:
      "Confirm your identity once. It keeps your account secure and unlocks higher withdrawal limits.",
    video: "/videos/verify.mp4",
    icon: ShieldCheck,
  },
  {
    title: "Fund",
    description:
      "Deposit by bank transfer, card, crypto or digital wallet. Most deposits clear within minutes.",
    video: "/videos/fund.mp4",
    icon: Wallet,
  },
  {
    title: "Trade",
    description:
      "Take your first position and track performance live from your portfolio dashboard.",
    video: "/videos/trade.mp4",
    icon: TrendingUp,
  },
]

/* -------------------------------------------------------------------------- */
/*  Copy trading                                                               */
/* -------------------------------------------------------------------------- */

export interface CopyTradingVideo {
  title: string
  description: string
  video: string
}

export const copyTradingVideos: CopyTradingVideo[] = [
  {
    title: "What is copy trading?",
    description:
      "The fundamentals — how mirroring another trader's positions actually works, in plain language.",
    video: "/videos/video-1.mp4",
  },
  {
    title: "Choosing the right traders",
    description:
      "How to read a trader's track record, drawdown and risk score before you allocate to them.",
    video: "/videos/video-2.mp4",
  },
  {
    title: "Maximizing your returns",
    description:
      "Allocation strategies for spreading capital across several traders and managing your downside.",
    video: "/videos/video-3.mp4",
  },
]

/* -------------------------------------------------------------------------- */
/*  Investment plans                                                           */
/* -------------------------------------------------------------------------- */

export interface Plan {
  name: string
  dailyReturn: string
  duration: string
  minDeposit: string
  maxDeposit: string
  description: string
  features: string[]
  popular?: boolean
}

export const plans: Plan[] = [
  {
    name: "Starter",
    dailyReturn: "1.2%",
    duration: "14 days",
    minDeposit: "$250",
    maxDeposit: "$4,999",
    description:
      "For first-time investors who want to learn the platform with capital they're comfortable with.",
    features: [
      "Access to all four markets",
      "Standard charting tools",
      "Email support",
      "Capital returned at term end",
      "5% referral bonus",
    ],
  },
  {
    name: "Silver",
    dailyReturn: "1.8%",
    duration: "21 days",
    minDeposit: "$5,000",
    maxDeposit: "$24,999",
    description:
      "For active traders ready to put a serious position to work across multiple asset classes.",
    features: [
      "Everything in Starter",
      "Full technical indicator suite",
      "Copy trading access",
      "Priority email & chat support",
      "7% referral bonus",
    ],
  },
  {
    name: "Gold",
    dailyReturn: "2.5%",
    duration: "30 days",
    minDeposit: "$25,000",
    maxDeposit: "$99,999",
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
    popular: true,
  },
  {
    name: "Platinum",
    dailyReturn: "3.2%",
    duration: "45 days",
    minDeposit: "$100,000",
    maxDeposit: "Unlimited",
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
  },
]

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                               */
/* -------------------------------------------------------------------------- */

export interface Testimonial {
  quote: string
  name: string
  location: string
  initials: string
  earnings: string
  /** Progress-bar fill percentage */
  progress: number
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "The best platform I've ever used. My portfolio has grown steadily since I started copy trading, and I finally understand what my money is actually doing.",
    name: "David Wilson",
    location: "California, USA",
    initials: "DW",
    earnings: "$5,000",
    progress: 60,
  },
  {
    quote:
      "I've been with Sterling Edge for months and the results speak for themselves. Withdrawals clear fast and my account manager actually picks up the phone.",
    name: "Sarah Lee",
    location: "London, UK",
    initials: "SL",
    earnings: "$12,000",
    progress: 80,
  },
  {
    quote:
      "Fantastic platform with genuinely excellent support. The risk calculator alone changed how I size every position I take.",
    name: "Raj Patel",
    location: "Mumbai, India",
    initials: "RP",
    earnings: "$8,000",
    progress: 70,
  },
]

/* -------------------------------------------------------------------------- */
/*  Trusted by                                                                 */
/* -------------------------------------------------------------------------- */

export interface Partner {
  name: string
  /** Omit to render the name as a typographic wordmark instead of an image. */
  logo?: string
}

export const partners: Partner[] = [
  { name: "Microsoft" },
  { name: "Tesla", logo: "/logos/tesla.png" },
  { name: "Amazon" },
  { name: "Google" },
  { name: "Visa", logo: "/logos/visa.png" },
  { name: "PayPal", logo: "/logos/paypal.png" },
]

/* -------------------------------------------------------------------------- */
/*  Deposit methods                                                            */
/* -------------------------------------------------------------------------- */

export interface DepositMethod {
  label: string
  icon: LucideIcon
}

export const depositMethods: DepositMethod[] = [
  { label: "Bank transfer", icon: Wallet },
  { label: "Credit & debit card", icon: CreditCard },
  { label: "Cryptocurrency", icon: Bitcoin },
  { label: "Digital wallets", icon: Coins },
]

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: "How do I open an account with Sterling Edge Trade?",
    answer:
      "Click Open Account, enter your name, email and a password, then verify your email address. The whole process takes under two minutes. You'll be asked to complete identity verification before your first withdrawal, which unlocks higher limits and keeps your account secure.",
  },
  {
    question: "What is the minimum deposit?",
    answer:
      "The minimum to open a funded account is $250, which puts you on our Starter plan. There is no maximum — our Platinum tier is designed for deposits of $100,000 and above with bespoke terms.",
  },
  {
    question: "Which markets can I trade?",
    answer:
      "Over 1,000 instruments across four asset classes: forex (60+ currency pairs), cryptocurrencies (80+ digital assets), stocks and indices (700+), and commodities including gold, silver, oil and natural gas. All from a single account and a single balance.",
  },
  {
    question: "How do I deposit and withdraw funds?",
    answer:
      "We accept bank transfer, credit and debit cards, cryptocurrency and digital wallets including PayPal, Cash App, Venmo and Zelle. Most deposits clear within minutes. Withdrawals are processed to the same method used to deposit, with a $10 minimum.",
  },
  {
    question: "How long do withdrawals take?",
    answer:
      "Crypto withdrawals typically settle within a few hours. Bank withdrawals take one to three business days depending on your institution. Gold and Platinum members receive priority and same-day processing respectively.",
  },
  {
    question: "Are my funds safe?",
    answer:
      "Client capital is held in segregated accounts separate from company funds. Digital assets are kept in cold storage, all data is encrypted in transit and at rest, and every account carries negative-balance protection so you can never lose more than you deposit.",
  },
  {
    question: "What is copy trading and how does it work?",
    answer:
      "Copy trading lets you automatically mirror the positions of experienced traders on the platform. You choose who to follow based on their published track record, drawdown and risk score, allocate a portion of your capital, and their trades are replicated in your account proportionally. You can stop at any time.",
  },
  {
    question: "Do I need trading experience to get started?",
    answer:
      "No. Many of our members start with no prior experience. Copy trading lets you follow proven traders while you learn, our risk calculator sizes positions for you, and Gold and Platinum members get a dedicated account manager who walks them through their first trades.",
  },
  {
    question: "What fees does Sterling Edge Trade charge?",
    answer:
      "Spreads start from 0.1 pips on major forex pairs and stocks trade commission-free. We charge nothing for deposits. Withdrawal network fees apply on crypto and are passed through at cost with no markup.",
  },
  {
    question: "Is trading risky?",
    answer:
      "Yes. Trading carries substantial risk and you can lose money. Prices in forex, crypto, stocks and commodities can move sharply and past performance never guarantees future results. Only trade capital you can afford to lose, and use the risk tools we provide on every position.",
  },
]

/* -------------------------------------------------------------------------- */
/*  TradingView symbols                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Instruments shown in the marquee strip under the hero. These are names only,
 * deliberately not prices — the live figures live in the market overview below,
 * sourced from TradingView.
 */
export interface TickerInstrument {
  symbol: string
  name: string
  category: "Forex" | "Crypto" | "Stocks" | "Commodities"
}

export const tickerInstruments: TickerInstrument[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", category: "Forex" },
  { symbol: "BTC/USD", name: "Bitcoin", category: "Crypto" },
  { symbol: "AAPL", name: "Apple", category: "Stocks" },
  { symbol: "XAU/USD", name: "Gold", category: "Commodities" },
  { symbol: "GBP/USD", name: "Pound / US Dollar", category: "Forex" },
  { symbol: "ETH/USD", name: "Ethereum", category: "Crypto" },
  { symbol: "TSLA", name: "Tesla", category: "Stocks" },
  { symbol: "WTI", name: "Crude Oil", category: "Commodities" },
  { symbol: "USD/JPY", name: "Dollar / Yen", category: "Forex" },
  { symbol: "SOL/USD", name: "Solana", category: "Crypto" },
  { symbol: "SPX", name: "S&P 500", category: "Stocks" },
  { symbol: "XAG/USD", name: "Silver", category: "Commodities" },
]

export const supportEmailHref = `mailto:${company.email}`
