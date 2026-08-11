/**
 * Tracks whether a user has seen the welcome screen.
 *
 * Kept client-side and keyed per user id: the API has no onboarding flag, and
 * adding a column to carry "has seen a page once" would put presentation state
 * in the ledger's database. If someone clears their browser and sees the
 * checklist again, it reads as a useful summary rather than a bug — every row
 * reflects live account state.
 */

const KEY_PREFIX = "se.onboarded:"

export function hasOnboarded(userId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(KEY_PREFIX + userId) === "1"
  } catch {
    // Private browsing or a blocked storage partition — treat as "not seen".
    return false
  }
}

export function markOnboarded(userId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, "1")
  } catch {
    /* Non-fatal: they see the welcome screen once more next time. */
  }
}
