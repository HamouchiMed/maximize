import type { ReactNode } from "react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="bg-surface/40">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="pt-6 lg:py-10">
          <AccountSidebar user={user} />
        </div>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
