/**
 * Whether the desktop sidebar is collapsed, persisted across visits.
 *
 * This is an external store rather than `useState` + an effect because that is
 * what it actually is: a value that lives in `localStorage`, outside React, and
 * that the server cannot know. `useSyncExternalStore` renders the server
 * snapshot during hydration and swaps to the real one immediately after, which
 * gets the preference applied without a hydration mismatch — and without the
 * cascading render that reading it in an effect would cause.
 */

const KEY = "se.sidebar.collapsed"

const listeners = new Set<() => void>()
let cached: boolean | null = null

function read(): boolean {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(KEY) === "1"
    } catch {
      // Private browsing or a blocked store — fall back to expanded.
      cached = false
    }
  }
  return cached
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function getSnapshot(): boolean {
  return read()
}

/** The server has no access to the preference, so it always renders expanded. */
export function getServerSnapshot(): boolean {
  return false
}

export function toggleCollapsed(): void {
  cached = !read()
  try {
    window.localStorage.setItem(KEY, cached ? "1" : "0")
  } catch {
    // The preference is cosmetic; failing to persist must not break the nav.
  }
  for (const listener of listeners) listener()
}
