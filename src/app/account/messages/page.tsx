import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageCenter } from "@/components/account/MessageCenter";

export const metadata = { title: "Messages — Maximize" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/messages");

  const messages = await prisma.supportMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted">Questions about an order? Send us a message.</p>
      <MessageCenter
        initial={messages.map((m) => ({
          id: m.id,
          subject: m.subject,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
