import { and, asc, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { categories, people, receivables, transactions } from "@/db/schema";

const defaultCategories = {
  entry: ["Mensalidade", "Serviço", "Outros"],
  expense: ["Serviços", "Impostos", "Equipamentos", "Deslocamento", "Outros"],
} as const;

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const db = getDb();
    const [peopleRows, transactionRows, receivableRows, initialCategoryRows] = await Promise.all([
      db.select().from(people).where(eq(people.ownerId, user.userId)).orderBy(asc(people.name)),
      db
        .select({
          id: transactions.id,
          type: transactions.type,
          description: transactions.description,
          category: transactions.category,
          amountCents: transactions.amountCents,
          transactionDate: transactions.transactionDate,
          notes: transactions.notes,
          personId: transactions.personId,
          paidByPersonId: transactions.paidByPersonId,
          personName: people.name,
        })
        .from(transactions)
        .leftJoin(
          people,
          and(eq(transactions.personId, people.id), eq(people.ownerId, user.userId)),
        )
        .where(eq(transactions.ownerId, user.userId))
        .orderBy(desc(transactions.transactionDate), desc(transactions.id)),
      db
        .select({
          id: receivables.id,
          personId: receivables.personId,
          personName: people.name,
          description: receivables.description,
          amountCents: receivables.amountCents,
          dueDate: receivables.dueDate,
          status: receivables.status,
          paidAt: receivables.paidAt,
        })
        .from(receivables)
        .innerJoin(
          people,
          and(eq(receivables.personId, people.id), eq(people.ownerId, user.userId)),
        )
        .where(eq(receivables.ownerId, user.userId))
        .orderBy(asc(receivables.status), asc(receivables.dueDate)),
      db
        .select()
        .from(categories)
        .where(eq(categories.ownerId, user.userId))
        .orderBy(asc(categories.type), asc(categories.name)),
    ]);

    const knownCategories = new Set(
      initialCategoryRows.map((category) => `${category.type}:${category.name.toLocaleLowerCase("pt-BR")}`),
    );
    const missingCategories: Array<{ ownerId: string; name: string; type: "entry" | "expense" }> = [];
    for (const type of ["entry", "expense"] as const) {
      for (const name of defaultCategories[type]) {
        const key = `${type}:${name.toLocaleLowerCase("pt-BR")}`;
        if (!knownCategories.has(key)) {
          missingCategories.push({ ownerId: user.userId, name, type });
          knownCategories.add(key);
        }
      }
    }
    for (const transaction of transactionRows) {
      const name = transaction.category.trim();
      const key = `${transaction.type}:${name.toLocaleLowerCase("pt-BR")}`;
      if (name && !knownCategories.has(key)) {
        missingCategories.push({ ownerId: user.userId, name, type: transaction.type });
        knownCategories.add(key);
      }
    }
    if (missingCategories.length) {
      await db.insert(categories).values(missingCategories).onConflictDoNothing();
    }
    const categoryRows = missingCategories.length
      ? await db
          .select()
          .from(categories)
          .where(eq(categories.ownerId, user.userId))
          .orderBy(asc(categories.type), asc(categories.name))
      : initialCategoryRows;

    const personNames = new Map(peopleRows.map((person) => [person.id, person.name]));

    const paidByPerson = new Map<number, { totalPaidCents: number; paymentCount: number; lastPaymentDate: string | null }>();
    for (const row of transactionRows) {
      if (row.type !== "entry" || !row.personId) continue;
      const current = paidByPerson.get(row.personId) ?? {
        totalPaidCents: 0,
        paymentCount: 0,
        lastPaymentDate: null,
      };
      current.totalPaidCents += row.amountCents;
      current.paymentCount += 1;
      if (!current.lastPaymentDate || row.transactionDate > current.lastPaymentDate) {
        current.lastPaymentDate = row.transactionDate;
      }
      paidByPerson.set(row.personId, current);
    }

    return Response.json({
      people: peopleRows.map((person) => ({
        ...person,
        ...(paidByPerson.get(person.id) ?? {
          totalPaidCents: 0,
          paymentCount: 0,
          lastPaymentDate: null,
        }),
      })),
      transactions: transactionRows.map((transaction) => ({
        ...transaction,
        paidByPersonName: transaction.paidByPersonId
          ? personNames.get(transaction.paidByPersonId) ?? null
          : null,
      })),
      receivables: receivableRows,
      categories: categoryRows,
    });
  } catch (error) {
    console.error("dashboard_load_failed", error);
    return Response.json({ error: "Não foi possível carregar os dados financeiros." }, { status: 500 });
  }
}
