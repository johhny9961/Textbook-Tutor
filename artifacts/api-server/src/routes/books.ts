import { Router } from "express";
import { db } from "@workspace/db";
import { books, bookChapters, bookSections } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { parseBookSlug, importOpenStaxBook } from "../lib/openstaxFetcher";

const booksRouter = Router();

booksRouter.get("/books", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT b.id, b.slug, b.title, b.cover_url as "coverUrl",
             b.status, b.total_sections as "totalSections",
             b.imported_sections as "importedSections",
             b.error_message as "errorMessage",
             b.created_at as "createdAt",
             (SELECT count(*)::int FROM book_chapters c WHERE c.book_id = b.id) as "chapterCount"
      FROM books b
      ORDER BY b.title ASC
    `);

    res.json(rows.rows);
  } catch (err) {
    req.log?.error({ err }, "Failed to list books");
    res.status(500).json({ error: "Failed to fetch book list." });
  }
});

booksRouter.post("/books/import", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Please provide a URL or book slug." });
      return;
    }

    const slug = parseBookSlug(url);
    if (!slug) {
      res.status(400).json({ error: "Could not recognize that as an OpenStax book URL. Try pasting the full URL from openstax.org." });
      return;
    }

    const existing = await db.query.books.findFirst({
      where: (b, { eq: eq_ }) => eq_(b.slug, slug),
    });

    if (existing) {
      if (existing.status === "ready") {
        res.json({ id: existing.id, slug: existing.slug, status: "ready", message: "This book is already in your library." });
        return;
      }
      if (existing.status === "importing") {
        res.json({ id: existing.id, slug: existing.slug, status: "importing", message: "This book is currently being imported." });
        return;
      }
      if (existing.status === "error") {
        await db.update(books).set({ status: "importing", errorMessage: null, importedSections: 0, updatedAt: new Date() }).where(eq(books.id, existing.id));
        importOpenStaxBook(slug, existing.id).catch((err) => {
          req.log?.error({ err, slug }, "Background book import failed");
        });
        res.json({ id: existing.id, slug: existing.slug, status: "importing", message: "Retrying import." });
        return;
      }
    }

    const cmsUrl = "https://openstax.org/apps/cms/api/books";
    const cmsRes = await fetch(cmsUrl, {
      headers: { "User-Agent": "TrailReader/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    let matchedTitle: string | undefined;
    let matchedCoverUrl: string | undefined;
    if (cmsRes.ok) {
      const cmsData = (await cmsRes.json()) as { books?: Array<{ slug: string; title: string; cover_url?: string }> };
      const match = cmsData.books?.find((b) => b.slug === `books/${slug}` || b.slug === slug);
      if (!match) {
        res.status(404).json({ error: `Could not find a book with slug "${slug}" on OpenStax.` });
        return;
      }
      matchedTitle = match.title;
      matchedCoverUrl = match.cover_url;
    }

    const [newBook] = await db
      .insert(books)
      .values({
        slug,
        title: matchedTitle || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        coverUrl: matchedCoverUrl || null,
        status: "importing",
      })
      .returning();

    importOpenStaxBook(slug, newBook.id).catch((err) => {
      req.log?.error({ err, slug }, "Background book import failed");
    });

    res.status(202).json({
      id: newBook.id,
      slug: newBook.slug,
      status: "importing",
      message: "Import started. This may take a few minutes for large textbooks.",
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to start book import");
    res.status(500).json({ error: "Failed to start import." });
  }
});

booksRouter.get("/books/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const book = await db.query.books.findFirst({
      where: (b, { eq: eq_ }) => eq_(b.slug, slug),
    });

    if (!book) {
      res.status(404).json({ error: "Book not found." });
      return;
    }

    if (book.status !== "ready") {
      res.status(409).json({
        error: book.status === "importing" ? "Book is still being imported." : "Book import failed.",
        status: book.status,
      });
      return;
    }

    const chapters = await db
      .select()
      .from(bookChapters)
      .where(eq(bookChapters.bookId, book.id))
      .orderBy(asc(bookChapters.index));

    const sections = await db
      .select()
      .from(bookSections)
      .where(eq(bookSections.bookId, book.id))
      .orderBy(asc(bookSections.chapterIndex), asc(bookSections.sectionIndex));

    const bookData = {
      name: book.title,
      chapters: chapters.map((ch) => ({
        index: ch.index,
        title: ch.title,
        sections: sections
          .filter((s) => s.chapterIndex === ch.index)
          .map((s) => ({
            id: s.sectionId,
            chapterIndex: s.chapterIndex,
            chapterTitle: s.chapterTitle,
            sectionIndex: s.sectionIndex,
            title: s.title,
            htmlContent: s.htmlContent,
            paragraphs: s.paragraphs,
            sentences: s.sentences,
          })),
      })),
      sections: sections.map((s) => ({
        id: s.sectionId,
        chapterIndex: s.chapterIndex,
        chapterTitle: s.chapterTitle,
        sectionIndex: s.sectionIndex,
        title: s.title,
        htmlContent: s.htmlContent,
        paragraphs: s.paragraphs,
        sentences: s.sentences,
      })),
    };

    res.json(bookData);
  } catch (err) {
    req.log?.error({ err }, "Failed to get book");
    res.status(500).json({ error: "Failed to load book." });
  }
});

booksRouter.get("/books/:slug/status", async (req, res) => {
  try {
    const { slug } = req.params;

    const book = await db.query.books.findFirst({
      where: (b, { eq: eq_ }) => eq_(b.slug, slug),
    });

    if (!book) {
      res.status(404).json({ error: "Book not found." });
      return;
    }

    res.json({
      id: book.id,
      slug: book.slug,
      title: book.title,
      status: book.status,
      totalSections: book.totalSections,
      importedSections: book.importedSections,
      errorMessage: book.errorMessage,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get book status");
    res.status(500).json({ error: "Failed to check status." });
  }
});

export default booksRouter;
