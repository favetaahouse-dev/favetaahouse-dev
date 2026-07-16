"use client";

import { User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { usePermissions } from "@/lib/rbac/use-permissions";

export function AccountMenu() {
  const ta = useTranslations("actions");
  const { data: session } = useSession();
  const { isStaff } = usePermissions();
  const authed = !!session?.user;

  return (
    <div className="group/acc relative hidden sm:block">
      <Link href={authed ? "/account/orders" : "/account/login"} aria-label={ta("account")} className="block">
        <User size={19} strokeWidth={1.4} />
      </Link>
      <div className="invisible absolute end-0 top-full z-50 w-44 bg-paper py-2 text-ink opacity-0 shadow-lg transition-all group-hover/acc:visible group-hover/acc:opacity-100">
        {authed ? (
          <>
            <Link href="/account/orders" className="block px-4 py-2 text-xs uppercase tracking-wider hover:bg-cream">
              {ta("account")}
            </Link>
            {isStaff && (
              <Link href="/admin" className="block px-4 py-2 text-xs uppercase tracking-wider hover:bg-cream">
                Admin
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-4 py-2 text-start text-xs uppercase tracking-wider hover:bg-cream"
            >
              {ta("logout")}
            </button>
          </>
        ) : (
          <>
            <Link href="/account/login" className="block px-4 py-2 text-xs uppercase tracking-wider hover:bg-cream">
              {ta("login")}
            </Link>
            <Link href="/account/register" className="block px-4 py-2 text-xs uppercase tracking-wider hover:bg-cream">
              {ta("register")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
