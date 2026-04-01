"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  // Group items: member items first, then admin items
  const memberItems = visibleItems.filter((item) => !item.admin);
  const adminItems = visibleItems.filter((item) => item.admin);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="p-4">
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
  );
}
