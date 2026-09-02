import { ImageResponse } from "next/og"

import { company } from "@/lib/site"

export const alt = "Sterling Edge Trade payment receipt"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * What a forwarded receipt link looks like in a chat before anyone taps it.
 *
 * Deliberately shows the reference and nothing else. A link preview is rendered
 * by WhatsApp's servers and then sits in the conversation for everyone in it —
 * including anyone the message is later forwarded to — so the amount and the
 * client's name stay behind the tap, where the page already requires an
 * unguessable token. What the preview needs to convey is only "this is a
 * receipt, from Sterling Edge Trade", which is exactly what was missing when it
 * fell back to the generic site card.
 */
async function loadReference(token: string): Promise<string | null> {
  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
  ).replace(/\/$/, "")

  try {
    const response = await fetch(
      `${base}/receipts/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    if (!response.ok) return null
    const body = (await response.json()) as {
      data?: { receipt?: { reference?: string } }
    }
    return body.data?.receipt?.reference ?? null
  } catch {
    return null
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const reference = await loadReference(token)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0f172a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#2563eb",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            ↗
          </div>
          {company.name}
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#60a5fa",
            fontWeight: 700,
          }}
        >
          Payment receipt
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          {reference ?? "Transaction receipt"}
        </div>

        <div style={{ marginTop: 26, fontSize: 28, color: "#94a3b8" }}>
          Official confirmation of a completed transaction. Tap to view.
        </div>
      </div>
    ),
    size
  )
}
