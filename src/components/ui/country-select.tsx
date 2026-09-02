"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { COUNTRIES, findCountry, searchCountries } from "@/lib/countries"
import { cn } from "@/lib/utils"

/**
 * A searchable country picker.
 *
 * Hand-built rather than pulled from a component library because the app has
 * its own field styling, and every drop-in phone-input package arrives with a
 * stylesheet that has to be fought. The list is 245 entries, so it is filtered
 * as you type — a native `<select>` would be a 245-row scroll on desktop and an
 * unsearchable wheel on iOS.
 *
 * Two presentations, one behaviour: `variant="dial"` is the compact flag +314
 * button that sits inside the phone field; `variant="full"` is the standalone
 * country-of-residence field.
 */
export function CountrySelect({
  value,
  onChange,
  variant = "full",
  disabled,
  id,
  invalid,
}: {
  value: string
  onChange: (code: string) => void
  variant?: "dial" | "full"
  disabled?: boolean
  id: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = findCountry(value)
  const results = useMemo(() => searchCountries(query), [query])

  // Closing clears the search here rather than in an effect, so the panel has
  // exactly one exit and no render pass is spent reacting to its own close.
  function close() {
    setOpen(false)
    setQuery("")
  }

  // Close on an outside click or Escape. Without the first, the panel survives
  // a click on the field beneath it and covers what the user just went to type.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  // Focus the search box on open so typing works immediately, the way a native
  // select responds to a keypress. Pure DOM, no state.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function choose(code: string) {
    onChange(code)
    close()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 text-sm outline-none transition-colors disabled:opacity-60",
          variant === "dial"
            ? "h-full shrink-0 rounded-l-xl border-r border-secondary-200 px-3 hover:bg-secondary-50 focus-visible:bg-secondary-50"
            : cn(
                "h-13 w-full rounded-xl border-2 bg-white px-3.5 text-left focus:ring-4 focus:ring-primary-100",
                invalid
                  ? "border-red-300 focus:border-red-500"
                  : "border-secondary-200 focus:border-primary-500"
              )
        )}
      >
        {selected ? (
          <>
            <span aria-hidden className="text-base leading-none">
              {selected.flag}
            </span>
            {variant === "dial" ? (
              <span className="tabular text-secondary-700">
                +{selected.callingCode}
              </span>
            ) : (
              <span className="flex-1 truncate text-secondary-900">
                {selected.name}
              </span>
            )}
          </>
        ) : (
          <span className={variant === "full" ? "flex-1 text-secondary-400" : ""}>
            {variant === "full" ? "Select your country" : "＋"}
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-secondary-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 mt-1 w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-xl",
            variant === "dial" ? "left-0" : "left-0 right-0"
          )}
        >
          <div className="flex items-center gap-2 border-b border-secondary-100 px-3">
            <Search aria-hidden className="size-4 shrink-0 text-secondary-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-secondary-400"
              onKeyDown={(event) => {
                // Enter picks the top hit, so a search can be completed without
                // reaching for the mouse.
                if (event.key === "Enter") {
                  event.preventDefault()
                  const first = results[0]
                  if (first) choose(first.code)
                }
              }}
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-secondary-500">
                No country matches “{query}”.
              </li>
            ) : (
              results.map((country) => (
                <li key={country.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={country.code === value}
                    onClick={() => choose(country.code)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary-50",
                      country.code === value && "bg-primary-50"
                    )}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {country.flag}
                    </span>
                    <span className="flex-1 truncate text-secondary-900">
                      {country.name}
                    </span>
                    <span className="tabular shrink-0 text-xs text-secondary-500">
                      +{country.callingCode}
                    </span>
                    {country.code === value && (
                      <Check aria-hidden className="size-4 shrink-0 text-primary-600" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>

          <p className="border-t border-secondary-100 px-3 py-2 text-xs text-secondary-500">
            {results.length} of {COUNTRIES.length} countries
          </p>
        </div>
      )}
    </div>
  )
}
