import { AlertCircle } from "lucide-react"

/**
 * Errors that belong to the submission rather than to one field — bad
 * credentials, a suspended account, a rate limit, the API being unreachable.
 * Anything the server attributes to a specific field is rendered under that
 * input instead.
 */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
      <p className="text-sm leading-relaxed text-red-800">{children}</p>
    </div>
  )
}
