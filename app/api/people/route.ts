import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { people } from "@/db/schema";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const payload = (await request.json()) as { name?: string; phone?: string; notes?: string };
  const name = payload.name?.trim() ?? "";
  if (!name) return Response.json({ error: "Informe o nome da pessoa." }, { status: 400 });

  try {
    const db = getDb();
    const existing = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.ownerId, user.userId));
    if (existing.length >= 2000) {
      return Response.json({ error: "Limite de cadastros atingido." }, { status: 400 });
    }
    const [person] = await db
      .insert(people)
      .values({
        ownerId: user.userId,
        name,
        phone: payload.phone?.trim() ?? "",
        notes: payload.notes?.trim() ?? "",
      })
      .returning();
    return Response.json({ person }, { status: 201 });
  } catch (error) {
    console.error("person_create_failed", error);
    return Response.json({ error: "Não foi possível adicionar a pessoa." }, { status: 500 });
  }
}
