import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"

import { Logo } from "@/components/logo"
import { stats } from "@/lib/site"

interface AuthShellProps {
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
  /** Bottom line, e.g. "Don't have an account? Sign up" */
  footer: React.ReactNode
  /** Headline shown on the dark brand panel */
  panelTitle: string
  panelPoints: string[]
}

/**
 * Split layout shared by every auth screen: form on the left, dark brand panel
 * on the right. The panel is hidden below `lg` so small screens get the form
 * immediately without scrolling past marketing copy.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  panelTitle,
  panelPoints,
}: AuthShellProps) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-2">
      {/* Form column */}
      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:min-h-0 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Sterling Edge Trade home">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary-500 transition-colors hover:text-primary-600"
          >
            <ArrowLeft className="size-4" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-secondary-600">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            <p className="mt-8 text-center text-sm text-secondary-600">
              {footer}
            </p>
          </div>
        </div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-primary-900 via-primary-800 to-secondary-900 lg:flex lg:items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[32rem] rounded-full bg-primary-500/25 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-blue-400/15 blur-[120px]"
        />
        <div aria-hidden className="absolute inset-0 bg-dotted opacity-[0.07]" />

        <div className="relative z-10 w-full px-12 py-16 xl:px-20">
          <h2 className="max-w-md text-3xl font-bold tracking-tight text-balance text-white xl:text-4xl">
            {panelTitle}
          </h2>

          <ul className="mt-8 space-y-4">
            {panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20">
                  <Check className="size-3.5 text-primary-300" strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-white/75">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-12 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="px-5 py-4">
                <dt className="tabular font-heading text-xl font-bold text-white">
                  {stat.prefix}
                  {stat.value.toLocaleString("en-US", {
                    minimumFractionDigits: stat.decimals ?? 0,
                    maximumFractionDigits: stat.decimals ?? 0,
                  })}
                  {stat.suffix}
                </dt>
                <dd className="mt-0.5 text-xs text-white/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  )
}
