import "server-only";
import { supabase } from "@/lib/supabase";

type RoleRef = { name: string; key: string } | { name: string; key: string }[] | null;
const one = <T>(ref: T | T[] | null): T | null => (Array.isArray(ref) ? ref[0] ?? null : ref) ?? null;
const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  roleName: string;
  isStaff: boolean;
  verified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  orderCount: number;
};

/** All accounts (customers + staff) enriched with order count and last successful login. */
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const [{ data: users }, { data: orders }, { data: logins }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name, phone, role, email_verified, created_at, role_info:roles(name, key)")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("user_id, email"),
    supabase.from("login_events").select("user_id, created_at").eq("success", true).order("created_at", { ascending: false }),
  ]);

  // Order counts keyed by user_id, with an email fallback (orders.user_id is SET NULL on delete).
  const ordersByUser = new Map<string, number>();
  const ordersByEmail = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.user_id) ordersByUser.set(o.user_id, (ordersByUser.get(o.user_id) ?? 0) + 1);
    if (o.email) ordersByEmail.set(o.email, (ordersByEmail.get(o.email) ?? 0) + 1);
  }

  // logins are newest-first, so the first time we see a user_id is their last login.
  const lastLogin = new Map<string, string>();
  for (const l of logins ?? []) {
    if (l.user_id && !lastLogin.has(l.user_id)) lastLogin.set(l.user_id, l.created_at);
  }

  return (users ?? []).map((u) => {
    const role = one(u.role_info as RoleRef);
    const isStaff = u.role !== "CUSTOMER";
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      roleName: isStaff ? role?.name ?? "Admin" : "Customer",
      isStaff,
      verified: !!u.email_verified,
      createdAt: u.created_at,
      lastLoginAt: lastLogin.get(u.id) ?? null,
      orderCount: ordersByUser.get(u.id) ?? ordersByEmail.get(u.email) ?? 0,
    };
  });
}

export type AdminUserDetail = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  roleName: string;
  isStaff: boolean;
  verified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export async function getUserById(id: string): Promise<AdminUserDetail | null> {
  const { data: u } = await supabase
    .from("users")
    .select("id, email, name, phone, role, email_verified, created_at, role_info:roles(name, key)")
    .eq("id", id)
    .maybeSingle();
  if (!u) return null;
  const role = one(u.role_info as RoleRef);
  const isStaff = u.role !== "CUSTOMER";
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    roleName: isStaff ? role?.name ?? pretty(u.role) : "Customer",
    isStaff,
    verified: !!u.email_verified,
    emailVerifiedAt: u.email_verified,
    createdAt: u.created_at,
  };
}

export type UserOrderSummary = { id: string; number: number; status: string; total: number; createdAt: Date };

/** Orders belonging to a user, matched by user_id OR email (historical orders can lose user_id). */
export async function getOrdersForUser(userId: string, email: string): Promise<UserOrderSummary[]> {
  const [{ data: byId }, { data: byEmail }] = await Promise.all([
    supabase.from("orders").select("id, number, status, total, created_at").eq("user_id", userId),
    supabase.from("orders").select("id, number, status, total, created_at").eq("email", email),
  ]);
  const map = new Map<string, UserOrderSummary>();
  for (const o of [...(byId ?? []), ...(byEmail ?? [])]) {
    map.set(o.id, { id: o.id, number: o.number, status: o.status, total: o.total, createdAt: new Date(o.created_at) });
  }
  return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export type LoginEventRow = {
  id: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function getUserLoginEvents(userId: string, limit = 50): Promise<LoginEventRow[]> {
  const { data } = await supabase
    .from("login_events")
    .select("id, success, ip, user_agent, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((e) => ({
    id: e.id,
    success: e.success,
    ip: e.ip,
    userAgent: e.user_agent,
    createdAt: e.created_at,
  }));
}

export type AuditActionRow = {
  id: string;
  action: string;
  summary: string | null;
  resourceType: string | null;
  createdAt: string;
};

export async function getUserAuditActions(actorId: string, limit = 50): Promise<AuditActionRow[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, summary, resource_type, created_at")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    summary: a.summary,
    resourceType: a.resource_type,
    createdAt: a.created_at,
  }));
}
