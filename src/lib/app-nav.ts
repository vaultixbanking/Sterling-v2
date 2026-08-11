import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Calculator,
  CandlestickChart,
  Coins,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * The signed-in navigation, shared by the user app and the admin panel so both
 * render through the same shell. Order here is the order on screen.
 */

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /**
   * Match this route only, never its descendants. Needed for index routes like
   * `/admin`, which is a prefix of every other admin page and would otherwise
   * light up alongside whichever one you were actually on.
   */
  exact?: boolean
}

export const userNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: CandlestickChart },
  { href: "/plans", label: "Investment plans", icon: Coins },
  { href: "/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/settings", label: "Settings", icon: Settings },
]

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine },
  { href: "/admin/pins", label: "Withdrawal PINs", icon: KeyRound },
  { href: "/admin/payment-methods", label: "Payment methods", icon: CreditCard },
  { href: "/admin/audit-logs", label: "Audit log", icon: ScrollText },
]

/**
 * Titles for routes that have no sidebar entry of their own — a detail page
 * still needs a heading in the topbar.
 */
const extraTitles: Record<string, string> = {
  "/welcome": "Welcome",
}

/** Active when it is the route, or — unless `exact` — an ancestor of it. */
export function isActivePath(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true
  if (item.exact) return false
  // Compare on a segment boundary so `/deposit` cannot claim `/deposits-archive`.
  return pathname.startsWith(`${item.href}/`)
}

/**
 * The longest matching prefix wins, so `/admin/users/SE-1234` is titled by
 * `/admin/users` rather than by `/admin`.
 */
export function titleForPath(pathname: string, items: NavItem[]): string {
  const known = extraTitles[pathname]
  if (known) return known

  const match = items
    .filter((item) => isActivePath(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return match?.label ?? "Sterling Edge"
}
