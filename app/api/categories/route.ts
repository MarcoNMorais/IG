import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { categories } from "@/db/schema";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const payload = (await request.json()) as { name?: string; type?: "entry" | "expense" };
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!name || !payload.type || !["entry", "expense"].includes(payload.type)) {
    return Response.json({ error: "Informe o nome e o tipo da categoria." }, { status: 400 });
  }
  if (name.length > 60) {
    return Response.json({ error: "Use um nome de categoria com até 60 caracteres." }, { status: 400 });
  }

  try {
    const db = getDb();
    const existingRows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, user.userId), eq(categories.type, payload.type)));
    const existing = existingRows.find(
      (category) => category.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    );
    if (existing) return Response.json({ category: existing });
    if (existingRows.length >= 200) {
      return Response.json({ error: "Limite de categorias atingido." }, { status: 400 });
    }

    const [category] = await db
      .insert(categories)
      .values({ ownerId: user.userId, name, type: payload.type })
      .returning();
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    console.error("category_create_failed", error);
    return Response.json({ error: "Não foi possível adicionar a categoria." }, { status: 500 });
  }
}
