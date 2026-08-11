"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Phone, User } from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { PasswordStrength } from "@/components/auth/password-strength"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"
import { formatDate } from "@/lib/format"

/**
 * Profile, password, and session management.
 *
 * SwiftEdge's settings page was three cards whose buttons did nothing at all.
 */
export function SettingsScreen() {
  const { user, reload, logout } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [fullName, setFullName] = useState(user?.fullName ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [savingPassword, setSavingPassword] = useState(false)

  const [signingOutAll, setSigningOutAll] = useState(false)
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false)

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!fullName.trim()) {
      setProfileErrors({ fullName: "Your name cannot be empty." })
      return
    }

    setProfileErrors({})
    setSavingProfile(true)
    try {
      await api.users.updateProfile({
        fullName: fullName.trim(),
        // An empty field means "remove it", which the API expects as null
        // rather than an empty string.
        phone: phone.trim() || null,
      })
      await reload()
      toast.success("Profile updated")
    } catch (cause) {
      setProfileErrors(mapFieldErrors(cause))
      toast.fromError(cause, "Could not save your profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: "The passwords do not match." })
      return
    }

    setPasswordErrors({})
    setSavingPassword(true)
    try {
      await api.users.changePassword({ currentPassword, newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(
        "Password changed",
        "Your other sessions have been signed out."
      )
    } catch (cause) {
      setPasswordErrors(mapFieldErrors(cause))
      toast.fromError(cause, "Could not change your password.")
    } finally {
      setSavingPassword(false)
    }
  }

  async function signOutEverywhere() {
    setSigningOutAll(true)
    try {
      await api.auth.logoutEverywhere()
      // This device's session is revoked too, so land them on the sign-in page
      // rather than leaving a shell that 401s on its next request.
      await logout()
      router.replace("/login")
    } catch (cause) {
      toast.fromError(cause, "Could not sign out everywhere.")
      setSigningOutAll(false)
      setConfirmSignOutAll(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Settings"
        description="Your profile, password, and active sessions."
      />

      <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Account
        </h3>

        <dl className="mt-4 space-y-1">
          <Row label="Account UID" value={user?.uid ?? "—"} copyable />
          <Row label="Username" value={user?.username ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row
            label="Member since"
            value={user ? formatDate(user.createdAt) : "—"}
          />
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Profile
        </h3>

        <form onSubmit={saveProfile} className="mt-4 space-y-4" noValidate>
          <Input
            id="settings-name"
            label="Full name"
            icon={User}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={profileErrors.fullName}
            disabled={savingProfile}
          />
          <Input
            id="settings-phone"
            label="Phone"
            icon={Phone}
            optional
            type="tel"
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={profileErrors.phone}
            disabled={savingProfile}
          />
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Password
        </h3>

        <form onSubmit={changePassword} className="mt-4 space-y-4" noValidate>
          <Input
            id="settings-current-password"
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            error={passwordErrors.currentPassword}
            disabled={savingPassword}
          />
          <div>
            <Input
              id="settings-new-password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={passwordErrors.newPassword}
              disabled={savingPassword}
            />
            {newPassword && (
              <div className="mt-2">
                <PasswordStrength password={newPassword} />
              </div>
            )}
          </div>
          <Input
            id="settings-confirm-password"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={passwordErrors.confirmPassword}
            disabled={savingPassword}
          />
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Changing…" : "Change password"}
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Sessions
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-secondary-600">
          Signs out every browser and device where you are currently signed in,
          including this one. Useful if you have used a shared computer.
        </p>
        <Button
          variant="outline"
          className="mt-4 border-red-300 text-red-600 hover:bg-red-50"
          onClick={() => setConfirmSignOutAll(true)}
        >
          <LogOut className="size-4" />
          Sign out everywhere
        </Button>
      </section>

      <ConfirmDialog
        open={confirmSignOutAll}
        onOpenChange={(next) => !signingOutAll && setConfirmSignOutAll(next)}
        title="Sign out everywhere?"
        description="Every device, including this one, will be signed out. You will need to sign in again."
        confirmLabel="Sign out everywhere"
        tone="danger"
        busy={signingOutAll}
        onConfirm={() => void signOutEverywhere()}
      />
    </div>
  )
}

function Row({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5 last:border-0">
      <dt className="text-sm text-secondary-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-secondary-900">
          {value}
        </span>
        {copyable && <CopyButton value={value} label={`Copy ${label}`} />}
      </dd>
    </div>
  )
}

/** Puts `error.details[].path` back onto the matching input. */
function mapFieldErrors(cause: unknown): Record<string, string> {
  if (!isApiError(cause) || !cause.details?.length) return {}
  const mapped: Record<string, string> = {}
  for (const detail of cause.details) {
    const key = detail.path?.split(".").pop()
    if (key) mapped[key] = detail.message
  }
  return mapped
}
