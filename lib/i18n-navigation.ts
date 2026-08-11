import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

// Locale-aware navigation wrappers (ryzo convention: lib/i18n-navigation).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
