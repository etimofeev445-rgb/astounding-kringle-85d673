// Sends a paid top-up to the mobile top-up aggregator.
// Configure with TOPUP_API_URL and TOPUP_API_KEY; the request body below is a generic
// shape — adjust it to the aggregator's documented API once the contract is signed.
// Without these vars orders stay "paid" and the admin tops up manually.

// `uncertain`: the request may have reached the aggregator (timeout, 5xx), so the top-up may have
// gone through — it must be checked with the aggregator before any retry.
export type FulfillResult = { ok: true; ref: string } | { ok: false; error: string; manual?: boolean; uncertain?: boolean }

export async function fulfillTopup(order: {
  id: string
  operator: string
  phone: string
  amountKop: number
}): Promise<FulfillResult> {
  const url = process.env.TOPUP_API_URL
  const key = process.env.TOPUP_API_KEY
  if (!url || !key) return { ok: false, manual: true, error: 'aggregator not configured' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      // The order id doubles as an idempotency key so the aggregator can drop a duplicate request.
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'idempotency-key': order.id },
      body: JSON.stringify({
        order_id: order.id,
        operator: order.operator,
        phone: `380${order.phone}`,
        amount: order.amountKop / 100,
        currency: 'UAH',
      }),
      signal: AbortSignal.timeout(8000),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string | number; reference?: string; error?: string; message?: string }
    if (!res.ok) return { ok: false, error: body.error ?? body.message ?? `HTTP ${res.status}`, uncertain: res.status >= 500 }
    return { ok: true, ref: String(body.id ?? body.reference ?? '') }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), uncertain: true }
  }
}
