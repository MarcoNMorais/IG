import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { receivables, transactions } from "@/db/schema";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;
  const receivableId = Number(id);
  if (!Number.isInteger(receivableId)) {
    return Response.json({ error: "Conta inválida." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [item] = await db
      .select()
      .from(receivables)
      .where(and(eq(receivables.id, receivableId), eq(receivables.ownerId, user.userId)))
      .limit(1);
    if (!item) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
    if (item.status === "paid") return Response.json({ ok: true });

    const today = new Date().toISOString().slice(0, 10);
    const [entry] = await db
      .insert(transactions)
      .values({
        ownerId: user.userId,
        personId: item.personId,
        type: "entry",
        description: item.description,
        category: "Conta recebida",
        amountCents: item.amountCents,
        transactionDate: today,
      })
      .returning({ id: transactions.id });

    await db
      .update(receivables)
      .set({ status: "paid", paidAt: today, transactionId: entry.id })
      .where(and(eq(receivables.id, item.id), eq(receivables.ownerId, user.userId)));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("receivable_pay_failed", error);
    return Response.json({ error: "Não foi possível confirmar o recebimento." }, { status: 500 });
  }
}
