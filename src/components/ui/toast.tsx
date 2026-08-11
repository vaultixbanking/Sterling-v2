"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import { Toast } from "radix-ui"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

import { isApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

/**
 * The app's only notification mechanism.
 *
 * SwiftEdge used five in parallel — SweetAlert2, native `alert()`, native
 * `confirm()`, hand-rolled DOM toasts, and inline text nodes — so the same
 * class of event looked different depending on which file happened to handle
 * it. One system, one look.
 */

type ToastVariant = "success" | "error" | "info"

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** Milliseconds on screen. `0` keeps it until dismissed. */
  duration?: number
}

interface ToastRecord extends ToastOptions {
  id: number
  open: boolean
}

interface ToastApi {
  show: (options: ToastOptions) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  /** Pulls the message out of an ApiError, with a fallback for anything else. */
  fromError: (error: unknown, fallback?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const VARIANTS: Record<
  ToastVariant,
  { icon: typeof Info; accent: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "before:bg-emerald-500",
    iconColor: "text-emerald-600",
  },
  error: {
    icon: AlertCircle,
    accent: "before:bg-red-500",
    iconColor: "text-red-600",
  },
  info: {
    icon: Info,
    accent: "before:bg-primary-600",
    iconColor: "text-primary-600",
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(0)

  const push = useCallback((options: ToastOptions) => {
    const id = (nextId.current += 1)
    setToasts((current) => [...current, { ...options, id, open: true }])
  }, [])

  const close = useCallback((id: number) => {
    setToasts((current) =>
      current.map((item) => (item.id === id ? { ...item, open: false } : item))
    )
  }, [])

  // Radix animates the exit, so the record is only dropped once it is done.
  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => {
    const error = (title: string, description?: string) =>
      push({
        title,
        ...(description ? { description } : {}),
        variant: "error",
        // Failures deserve longer than successes — there is usually something
        // to read and act on.
        duration: 8000,
      })

    return {
      show: push,
      success: (title, description) =>
        push({
          title,
          ...(description ? { description } : {}),
          variant: "success",
        }),
      info: (title, description) =>
        push({
          title,
          ...(description ? { description } : {}),
          variant: "info",
        }),
      error,
      fromError: (
        thrown,
        fallback = "Something went wrong. Please try again."
      ) => {
        const message = isApiError(thrown)
          ? thrown.message
          : thrown instanceof Error
            ? thrown.message
            : fallback
        error(message)
      },
    }
  }, [push])

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}

        {toasts.map((item) => {
          const variant = VARIANTS[item.variant ?? "info"]
          const Icon = variant.icon

          return (
            <Toast.Root
              key={item.id}
              open={item.open}
              duration={item.duration === 0 ? Infinity : item.duration}
              onOpenChange={(open) => {
                if (!open) close(item.id)
              }}
              // Radix fires this after the close animation settles.
              onAnimationEnd={() => {
                if (!item.open) remove(item.id)
              }}
              className={cn(
                "relative flex items-start gap-3 overflow-hidden rounded-xl border border-secondary-200 bg-white p-4 pl-5 shadow-xl shadow-secondary-900/10",
                "before:absolute before:inset-y-0 before:left-0 before:w-1",
                "data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
                "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none",
                "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
                "data-[swipe=end]:animate-toast-out",
                variant.accent
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", variant.iconColor)} />

              <div className="min-w-0 flex-1">
                <Toast.Title className="text-sm font-semibold text-secondary-900">
                  {item.title}
                </Toast.Title>
                {item.description && (
                  <Toast.Description className="mt-1 text-sm leading-relaxed text-secondary-600">
                    {item.description}
                  </Toast.Description>
                )}
              </div>

              <Toast.Close
                aria-label="Dismiss"
                className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                <X className="size-4" />
              </Toast.Close>
            </Toast.Root>
          )
        })}

        <Toast.Viewport className="fixed top-0 right-0 z-100 flex max-h-screen w-full max-w-sm list-none flex-col gap-3 p-4 outline-none sm:top-auto sm:bottom-0" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>")
  }
  return context
}
