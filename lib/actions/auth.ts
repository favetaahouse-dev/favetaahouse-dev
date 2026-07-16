"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.toLowerCase().trim();
  if (!email || input.password.length < 6) return { ok: false, error: "invalid" };

  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: "exists" };

  const hash = await bcrypt.hash(input.password, 10);
  await supabase.from("users").insert({
    email,
    name: input.name.trim() || null,
    password: hash,
    role: "CUSTOMER",
  });
  return { ok: true };
}
