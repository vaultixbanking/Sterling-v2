"use client"

import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { scorePassword } from "@/lib/validation"

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  const { score, label, barClass, textClass, checks } = scorePassword(password)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i < score ? barClass : "bg-secondary-200"
              )}
            />
          ))}
        </div>
        <span className={cn("text-xs font-semibold", textClass)}>{label}</span>
      </div>

      <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              check.met ? "text-emerald-600" : "text-secondary-400"
            )}
          >
            {check.met ? (
              <Check className="size-3.5 shrink-0" strokeWidth={3} />
            ) : (
              <X className="size-3.5 shrink-0" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
