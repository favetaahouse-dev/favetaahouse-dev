"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requestEmailVerification } from "@/lib/actions/verification";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email().max(200).transform((s) => s.toLowerCase().trim()),
  phone: z.string().trim().min(5, "Enter a valid phone number").max(40),
  password: z.string().min(6, "Use at least 6 characters").max(200),
});

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ ok: boolean; error?: string; requiresVerification?: boolean }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { name, email, phone, password } = parsed.data;

  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: "exists" };

  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from("users").insert({
    email,
    name: name || null,
    phone,
    password: hash,
    role: "CUSTOMER",
    email_verified: null, // must verify via a 6-digit code before first login
  });
  if (error) return { ok: false, error: "invalid" };

  await requestEmailVerification(email);
  return { ok: true, requiresVerification: true };
}
