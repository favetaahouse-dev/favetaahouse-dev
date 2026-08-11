"use server";

import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { rateLimit, ipFrom } from "@/lib/rate-limit";

const emailSchema = z.string().email().max(320);

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.toLowerCase().trim();
  // Validate email SHAPE (not just non-empty) and enforce the min password length server-side —
  // the client can be bypassed.
  if (!emailSchema.safeParse(email).success || input.password.length < 8) {
    return { ok: false, error: "invalid" };
  }

  // Throttle by IP: caps junk-account creation and mass account-enumeration probing of the
  // "already exists" response. Fails open, so a limiter blip never blocks a real signup.
  const ip = ipFrom(await headers());
  if (!(await rateLimit(`register:${ip}`, 10, 3600))) {
    return { ok: false, error: "rate" };
  }

  const hash = await bcrypt.hash(input.password, 10);
  // Rely on the users.email UNIQUE constraint as the source of truth — no separate pre-check
  // SELECT (which was both a TOCTOU race and an enumeration timing oracle), and check the
  // insert error so a real failure isn't reported as success.
  const { error } = await supabase.from("users").insert({
    email,
    name: input.name.trim() || null,
    password: hash,
    role: "CUSTOMER",
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "exists" };
    console.error("[auth] registerUser insert failed", error);
    return { ok: false, error: "error" };
  }
  return { ok: true };
}
