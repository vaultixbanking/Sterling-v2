"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  bootstrapSession,
  onSessionChange,
  setAccessToken,
} from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"
import type { LoginInput, PublicUser, RegisterInput } from "@/lib/api/types"

/**
 * Session state for the whole app.
 *
 * The access token is deliberately **not** here — it lives in a module closure
 * inside `lib/api/client`, because it is never rendered and putting it in state
 * would only create a second copy to keep in sync. What React needs to know is
 * who is signed in and whether we have finished finding out.
 *
 * On first mount we ask the API to exchange the httpOnly refresh cookie for a
 * fresh access token, which is what makes a hard reload keep you signed in
 * without ever storing a token where a script could read it.
 */

export type AuthStatus = "loading" | "authed" | "guest"

interface AuthContextValue {
  user: PublicUser | null
  status: AuthStatus
  isAdmin: boolean
  login: (input: LoginInput) => Promise<PublicUser>
  register: (input: RegisterInput) => Promise<PublicUser>
  logout: () => Promise<void>
  /** Re-reads the current user, e.g. after a profile edit. */
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // A background refresh (or its failure) has to reach the UI, otherwise a
  // silently expired session would leave a stale name in the header.
  useEffect(() => {
    onSessionChange((nextUser) => {
      if (!mounted.current) return
      setUser(nextUser)
      setStatus(nextUser ? "authed" : "guest")
    })
    return () => onSessionChange(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    void bootstrapSession().then((restored) => {
      if (cancelled) return
      setUser(restored)
      setStatus(restored ? "authed" : "guest")
    })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const session = await api.auth.login(input)
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus("authed")
    return session.user
  }, [])

  const register = useCallback(
    async (input: RegisterInput) => {
      // Registration does not sign you in — the API returns the user only — so
      // we follow it with a real login to get a session.
      await api.auth.register(input)
      const session = await api.auth.login({
        identifier: input.email,
        password: input.password,
      })
      setAccessToken(session.accessToken)
      setUser(session.user)
      setStatus("authed")
      return session.user
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } finally {
      // Sign out locally even if the revoke call failed — leaving someone
      // apparently signed in after they asked to leave is the worse outcome.
      setAccessToken(null)
      setUser(null)
      setStatus("guest")
    }
  }, [])

  const reload = useCallback(async () => {
    const { user: fresh } = await api.users.me()
    setUser(fresh)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === "ADMIN",
      login,
      register,
      logout,
      reload,
    }),
    [user, status, login, register, logout, reload]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return context
}
