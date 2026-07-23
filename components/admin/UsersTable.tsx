"use client";

import { DataTable, type Column, Badge } from "./ui";
import type { AdminUserRow } from "@/lib/data/users";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US");

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (r) => r.name ?? "",
      cell: (r) => <span className="text-foreground">{r.name ?? "—"}</span>,
    },
    { key: "email", header: "Email", cell: (r) => <span className="text-secondary">{r.email}</span> },
    { key: "phone", header: "Phone", cell: (r) => <span className="text-secondary">{r.phone ?? "—"}</span> },
    {
      key: "role",
      header: "Role",
      cell: (r) => <Badge tone={r.isStaff ? "accent" : "neutral"}>{r.roleName}</Badge>,
    },
    {
      key: "verified",
      header: "Verified",
      align: "center",
      cell: (r) => <Badge tone={r.verified ? "positive" : "warn"}>{r.verified ? "Yes" : "No"}</Badge>,
    },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => <span className="text-faint">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: "lastLogin",
      header: "Last login",
      sortable: true,
      sortValue: (r) => r.lastLoginAt ?? "",
      cell: (r) => <span className="text-faint">{r.lastLoginAt ? fmtDate(r.lastLoginAt) : "—"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "center",
      sortable: true,
      sortValue: (r) => r.orderCount,
      cell: (r) => r.orderCount,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      rowHref={(r) => `/admin/users/${r.id}`}
      searchable
      searchText={(r) => `${r.name ?? ""} ${r.email} ${r.phone ?? ""} ${r.roleName}`}
      searchPlaceholder="Search users…"
      pageSize={25}
      emptyTitle="No users"
    />
  );
}
