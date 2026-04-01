import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only EXCO and President can access admin routes
  const member = await requireRole(["exco", "president"]);

  return (
    <div className="flex h-screen">
      <Sidebar memberName={member.name} role={member.role} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
