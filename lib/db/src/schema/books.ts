import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  status: text("status", { enum: ["importing", "ready", "error"] }).notNull().default("importing"),
  totalSections: integer("total_sections").notNull().default(0),
  importedSections: integer("imported_sections").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bookChapters = pgTable("book_chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  title: text("title").notNull(),
}, (table) => [
  uniqueIndex("book_chapters_book_index").on(table.bookId, table.index),
]);

export const bookSections = pgTable("book_sections", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").notNull().references(() => bookChapters.id, { onDelete: "cascade" }),
  chapterIndex: integer("chapter_index").notNull(),
  sectionIndex: integer("section_index").notNull(),
  sectionId: text("section_id").notNull(),
  title: text("title").notNull(),
  chapterTitle: text("chapter_title").notNull(),
  htmlContent: text("html_content").notNull(),
  paragraphs: jsonb("paragraphs").notNull().$type<string[]>(),
  sentences: jsonb("sentences").notNull().$type<{ text: string; paraIdx: number; sentIdx: number }[]>(),
}, (table) => [
  uniqueIndex("book_sections_book_section").on(table.bookId, table.sectionId),
]);

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type BookChapter = typeof bookChapters.$inferSelect;
export type BookSectionRow = typeof bookSections.$inferSelect;
