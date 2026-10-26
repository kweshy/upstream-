/**
 * Safaricom Daraja (M-Pesa) helper — server-only.
 * Credentials come from project secrets: DARAJA_CONSUMER_KEY,
 * DARAJA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY.
 */
const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

function baseUrl(): string {
  return process.env["MPESA_ENV"] === "production" ? PROD_BASE : SANDBOX_BASE;
}

export function mpesaTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

export async function getMpesaToken(): Promise<string> {
  const key = process.env["DARAJA_CONSUMER_KEY"];
  const secret = process.env["DARAJA_CONSUMER_SECRET"];
  if (!key || !secret) throw new Error("M-Pesa credentials not configured");
  const res = await fetch(
    `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` } },
  );
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

export async function stkPush(input: {
  amount: number;
  phone: string;
  reference: string;
  description: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  const token = await getMpesaToken();
  const shortcode = process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  if (!shortcode || !passkey) throw new Error("M-Pesa shortcode not configured");
  const ts = mpesaTimestamp();
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: btoa(`${shortcode}${passkey}${ts}`),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.max(1, Math.round(input.amount)),
      PartyA: input.phone,
      PartyB: shortcode,
      PhoneNumber: input.phone,
      CallBackURL: input.callbackUrl,
      AccountReference: input.reference,
      TransactionDesc: input.description.slice(0, 90),
    }),
  });
  const json = (await res.json()) as { [key: string]: unknown };
  if (!res.ok || json["ResponseCode"] !== "0") {
    const msg =
      (json["errorMessage"] as string) ??
      (json["ResponseDescription"] as string) ??
      `M-Pesa request failed (${res.status})`;
    throw new Error(msg);
  }
  return {
    checkoutRequestId: json["CheckoutRequestID"] as string,
    merchantRequestId: json["MerchantRequestID"] as string,
    customerMessage: (json["CustomerMessage"] as string) ?? "Check your phone for the M-Pesa prompt.",
  };
}

export function callbackUrl(): string {
  return process.env["MPESA_CALLBACK_URL"] ?? "";
}
