import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { categories, people, transactions } from "@/db/schema";

function parseMoney(value: unknown) {
  const normalized = String(value ?? "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const payload = (await request.json()) as {
    type?: "entry" | "expense";
    personId?: number | null;
    paidByPersonId?: number | null;
    description?: string;
    category?: string;
    amount?: string | number;
    transactionDate?: string;
    notes?: string;
  };

  const amountCents = parseMoney(payload.amount);
  const description = payload.description?.trim() ?? "";
  if (!payload.type || !["entry", "expense"].includes(payload.type)) {
    return Response.json({ error: "Tipo de movimentação inválido." }, { status: 400 });
  }
  const category = payload.category?.trim() ?? "";
  if (!description || !category || amountCents <= 0 || !payload.transactionDate) {
    return Response.json({ error: "Preencha descrição, categoria, valor e data." }, { status: 400 });
  }

  try {
    const db = getDb();
    let personId: number | null = null;
    let paidByPersonId: number | null = null;
    if (payload.type === "entry" && payload.personId) {
      const [person] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.id, payload.personId), eq(people.ownerId, user.userId)))
        .limit(1);
      if (!person) return Response.json({ error: "Pessoa não encontrada." }, { status: 404 });
      personId = person.id;
    }

    if (payload.type === "expense" && payload.paidByPersonId) {
      const [payer] = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.id, payload.paidByPersonId), eq(people.ownerId, user.userId)))
        .limit(1);
      if (!payer) return Response.json({ error: "A pessoa informada em quem pagou não foi encontrada." }, { status: 404 });
      paidByPersonId = payer.id;
    }

    const [savedCategory] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.ownerId, user.userId),
          eq(categories.type, payload.type),
          eq(categories.name, category),
        ),
      )
      .limit(1);
    if (!savedCategory) {
      return Response.json(
        { error: "Selecione uma categoria cadastrada ou adicione uma nova." },
        { status: 400 },
      );
    }

    const [transaction] = await db
      .insert(transactions)
      .values({
        ownerId: user.userId,
        personId,
        paidByPersonId,
        type: payload.type,
        description,
        category: savedCategory.name,
        amountCents,
        transactionDate: payload.transactionDate,
        notes: payload.notes?.trim() ?? "",
      })
      .returning();
    return Response.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("transaction_create_failed", error);
    return Response.json({ error: "Não foi possível salvar a movimentação." }, { status: 500 });
  }
}
