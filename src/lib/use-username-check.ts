"use client"

import { useEffect, useRef, useState } from "react"

import * as api from "@/lib/api/endpoints"
import type { UsernameCheck } from "@/lib/api/types"
import { USERNAME_RE } from "@/lib/validation"

/**
 * Live username availability for the signup form.
 *
 * Three rules keep this from being a request per keystroke:
 *
 *  - **Debounced.** Nothing is sent until typing pauses.
 *  - **Locally pre-filtered.** A string that cannot pass `USERNAME_RE` never
 *    leaves the browser; the server would only say the same thing.
 *  - **Answers are kept.** Deleting a character and retyping it reads the
 *    previous answer instead of asking again, which is the most common way a
 *    debounced field still ends up hammering an endpoint.
 *
 * Only the fetched answers live in state. What the field *shows* is derived
 * during render from the current value plus those answers — mirroring it into
 * state as well would mean a setState per keystroke and a render to match.
 *
 * The result is advisory: registration re-checks and can still return a 409, so
 * a stale "available" costs a clear error, never a wrong account.
 */

const DEBOUNCE_MS = 400

export type UsernameState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; message: string; suggestions: string[] }

/** A lookup that failed. Recorded so the field stops saying "checking…". */
const FAILED = "failed" as const

type Answer = UsernameCheck | typeof FAILED

export function useUsernameCheck(
  username: string,
  fullName: string
): UsernameState {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})

  const value = username.trim()
  const key = value.toLowerCase()
  const legal = USERNAME_RE.test(value)
  const answer = legal ? answers[key] : undefined

  // Held in a ref so editing the name does not itself trigger a lookup — it
  // only improves the suggestions attached to the next one. Synced in an effect
  // rather than during render, which React forbids; the debounce is far longer
  // than a commit, so the value is always current by the time it is read.
  const nameRef = useRef(fullName)
  useEffect(() => {
    nameRef.current = fullName
  }, [fullName])

  useEffect(() => {
    if (!legal || answer) return

    // Guards against out-of-order responses: a slow answer for an old value
    // must not land as the answer for the current one.
    let live = true

    const timer = setTimeout(() => {
      api.auth
        .checkUsername(value, nameRef.current.trim() || undefined)
        .then((result) => {
          if (live) setAnswers((prev) => ({ ...prev, [key]: result }))
        })
        .catch(() => {
          // A failed check must never block signup — fall silent and let the
          // server's 409 be the authority it always was.
          if (live) setAnswers((prev) => ({ ...prev, [key]: FAILED }))
        })
    }, DEBOUNCE_MS)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, value, legal, answer])

  // Nothing typed, or malformed — the form's own validation owns the message
  // there, and two complaints about one field read as a bug.
  if (!value || !legal) return { status: "idle" }
  if (!answer) return { status: "checking" }
  if (answer === FAILED) return { status: "idle" }
  if (answer.available) return { status: "available" }

  return {
    status: "unavailable",
    message: answer.message ?? "That username is not available.",
    suggestions: answer.suggestions,
  }
}
