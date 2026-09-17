import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_people_owner_name").on(table.ownerId, table.name)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: ["entry", "expense"] }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_categories_owner_type_name").on(table.ownerId, table.type, table.name),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    personId: integer("person_id").references(() => people.id),
    paidByPersonId: integer("paid_by_person_id").references(() => people.id),
    type: text("type", { enum: ["entry", "expense"] }).notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("Geral"),
    amountCents: integer("amount_cents").notNull(),
    transactionDate: text("transaction_date").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_transactions_owner_date").on(table.ownerId, table.transactionDate),
    index("idx_transactions_owner_person").on(table.ownerId, table.personId),
  ],
);

export const receivables = sqliteTable(
  "receivables",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    personId: integer("person_id").notNull().references(() => people.id),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status", { enum: ["pending", "paid"] }).notNull().default("pending"),
    paidAt: text("paid_at"),
    transactionId: integer("transaction_id").references(() => transactions.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_receivables_owner_status_due").on(table.ownerId, table.status, table.dueDate),
    index("idx_receivables_owner_person").on(table.ownerId, table.personId),
  ],
);
