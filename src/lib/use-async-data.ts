"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Load data for a screen, tracking the three states every list in this app is
 * required to render: loading, loaded, failed-with-a-way-back.
 *
 * `key` is what identifies the request — a period, a page number, a filter set.
 * Change it and the data reloads. The loader itself is held in a ref so an
 * inline arrow function does not re-trigger the fetch on every render.
 *
 * State only ever moves inside the promise callbacks, never synchronously in
 * the effect body, so a load cannot cascade an extra render pass.
 */

export interface AsyncData<T> {
  data: T | null
  loading: boolean
  error: unknown
  /** Re-runs the loader; safe to pass straight to a retry button. */
  reload: () => void
}

export function useAsyncData<T>(load: () => Promise<T>, key: string): AsyncData<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let cancelled = false

    loadRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        // Keep the previous data on screen rather than blanking it — a failed
        // refresh should not erase figures that were correct a moment ago.
        setError(cause)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [key, nonce])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setNonce((current) => current + 1)
  }, [])

  return { data, loading, error, reload }
}
