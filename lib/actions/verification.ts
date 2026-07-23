"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, ipFrom } from "@/lib/rate-limit";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const normalize = (email: string) => email.toLowerCase().trim();
const sixDigit = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Issue a fresh 6-digit code for `email` and email it. Always resolves `{ ok: true }`
 * (even for unknown emails) so it can't be used to probe which addresses are registered.
 * Rate-limited per email and per IP.
 */
export async function requestEmailVerification(email: string): Promise<{ ok: boolean }> {
  const addr = normalize(email);
  if (!addr) return { ok: true };

  const ip = ipFrom(await headers());
  const okEmail = await rateLimit(`verify_send:${addr}`, 3, 600);
  const okIp = await rateLimit(`verify_send_ip:${ip}`, 10, 600);
  if (!okEmail || !okIp) return { ok: true }; // silently throttle; don't reveal state

  const code = sixDigit();
  const code_hash = await bcrypt.hash(code, 10);
  await supabase.from("email_verification_codes").insert({
    email: addr,
    code_hash,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  await sendVerificationEmail(addr, code);
  return { ok: true };
}

type VerifyResult = { ok: true } | { ok: false; error: "invalid" | "expired" | "too_many" };

/**
 * Check a submitted code. On success, stamps `users.email_verified` and consumes the code.
 */
export async function verifyEmail(email: string, code: string): Promise<VerifyResult> {
  const addr = normalize(email);
  const ip = ipFrom(await headers());
  const allowed =
    (await rateLimit(`verify_check:${addr}`, 10, 600)) && (await rateLimit(`verify_check_ip:${ip}`, 30, 600));
  if (!allowed) return { ok: false, error: "too_many" };

  const { data: row } = await supabase
    .from("email_verification_codes")
    .select("id, code_hash, expires_at, consumed_at, attempts")
    .eq("email", addr)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, error: "invalid" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many" };

  await supabase
    .from("email_verification_codes")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id);

  if (!(await bcrypt.compare(code.trim(), row.code_hash))) return { ok: false, error: "invalid" };

  await supabase.from("users").update({ email_verified: new Date().toISOString() }).eq("email", addr);
  await supabase.from("email_verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true };
}

/** Whether `email` belongs to a registered-but-unverified account (drives login UX). */
export async function checkEmailVerified(email: string): Promise<{ exists: boolean; unverified: boolean }> {
  const addr = normalize(email);
  const { data } = await supabase.from("users").select("email_verified").eq("email", addr).maybeSingle();
  return { exists: !!data, unverified: !!data && !data.email_verified };
}
