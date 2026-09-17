import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { people, receivables } from "@/db/schema";

function parseMoney(value: unknown) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const payload = (await request.json()) as {
    personId?: number;
    description?: string;
    amount?: string | number;
    dueDate?: string;
  };
  const amountCents = parseMoney(payload.amount);
  const description = payload.description?.trim() ?? "";
  if (!payload.personId || !description || amountCents <= 0 || !payload.dueDate) {
    return Response.json({ error: "Preencha pessoa, descrição, valor e vencimento." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, payload.personId), eq(people.ownerId, user.userId)))
      .limit(1);
    if (!person) return Response.json({ error: "Pessoa não encontrada." }, { status: 404 });

    const [receivable] = await db
      .insert(receivables)
      .values({
        ownerId: user.userId,
        personId: person.id,
        description,
        amountCents,
        dueDate: payload.dueDate,
      })
      .returning();
    return Response.json({ receivable }, { status: 201 });
  } catch (error) {
    console.error("receivable_create_failed", error);
    return Response.json({ error: "Não foi possível adicionar a conta a receber." }, { status: 500 });
  }
}
