"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useCallback, useState, useEffect } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RoleType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  label: string;
  href: string;
  roles: RoleType[];
  admin?: boolean;
};

const navItems: NavItem[] = [
  // Member routes
  { label: "My Schedule", href: "/schedule", roles: ["member", "exco", "president"] },
  { label: "Preferences", href: "/preferences", roles: ["member", "exco", "president"] },
  { label: "Profile", href: "/profile", roles: ["member", "exco", "president"] },
  // EXCO routes
  { label: "Attendance", href: "/attendance", roles: ["exco", "president"], admin: true },
  { label: "Attendance Overview", href: "/attendance/overview", roles: ["president"], admin: true },
  { label: "Guns", href: "/guns", roles: ["exco", "president"], admin: true },
  // President routes
  { label: "Sessions", href: "/sessions", roles: ["president"], admin: true },
  { label: "Templates", href: "/templates", roles: ["president"], admin: true },
  { label: "Members", href: "/members", roles: ["president"], admin: true },
  { label: "Requirements", href: "/requirements", roles: ["president"], admin: true },
  { label: "Groups", href: "/groups", roles: ["president"], admin: true },
  { label: "Semesters", href: "/semesters", roles: ["president"], admin: true },
  { label: "Handover", href: "/handover", roles: ["president"], admin: true },
];

export function Sidebar({
  memberName,
  role,
}: {
  memberName: string;
  role: RoleType;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  // Memoize filtered navigation items
  const { memberItems, adminItems } = useMemo(() => {
    const visibleItems = navItems.filter((item) => item.roles.includes(role));
    return {
      memberItems: visibleItems.filter((item) => !item.admin),
      adminItems: visibleItems.filter((item) => item.admin),
    };
  }, [role]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  // Auto-close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll while the mobile drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Mobile hamburger toggle (hidden on md+) */}
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="primary-sidebar"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white text-gray-700 shadow-sm hover:bg-gray-50 md:hidden"
      >
        {open ? (
          <XIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        id="primary-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r bg-white transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:transform-none`}
      >
        <div className="p-4 pl-14 md:pl-4">
          <h1 className="text-lg font-semibold">Shooting Sign-Up</h1>
          <p className="text-sm text-gray-500">
            {memberName} &middot;{" "}
            <span className="capitalize">{role}</span>
          </p>
        </div>

        <Separator />

        <nav className="flex-1 space-y-1 p-2">
          {memberItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {adminItems.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="px-3 py-1 text-xs font-semibold uppercase text-gray-400">
                Admin
              </p>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600"
            onClick={handleLogout}
          >
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
