import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentUser();

  return (
    <div className="flex h-screen">
      <Sidebar memberName={member.name} role={member.role} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
