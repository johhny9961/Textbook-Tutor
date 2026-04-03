/**
 * Stress test: OpenStax fetcher parsing logic
 *
 * Tests:
 * 1. extractPreloadedState with malformed JSON
 * 2. extractPageContent depth tracking
 * 3. flattenTOC with deeply nested / empty structures
 * 4. parseBookSlug validation
 * 5. fetchWithRetry timeout behavior
 */

// --- Replicate functions ---

function extractPreloadedState(html: string): Record<string, unknown> | null {
  const marker = "window.__PRELOADED_STATE__ = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }

  if (endIdx === -1) return null;

  try {
    return JSON.parse(html.slice(jsonStart, endIdx));
  } catch {
    return null;
  }
}

function extractPageContent(html: string): string {
  const marker = 'data-book-content="true">';
  const idx = html.indexOf(marker);
  if (idx === -1) return "";

  const contentStart = idx + marker.length;
  let depth = 1;
  let i = contentStart;

  while (i < html.length && depth > 0) {
    if (html[i] === "<") {
      if (html.startsWith("</div", i)) {
        depth--;
        if (depth === 0) break;
      } else if (html.startsWith("<div", i)) {
        depth++;
      }
    }
    i++;
  }

  return html.slice(contentStart, i);
}

interface TOCEntry {
  title: string;
  slug: string;
  contents?: TOCEntry[];
}

interface FlatTOCEntry {
  chapterIndex: number;
  chapterTitle: string;
  sectionIndex: number;
  sectionTitle: string;
  slug: string;
}

function flattenTOC(tree: TOCEntry[]): FlatTOCEntry[] {
  const entries: FlatTOCEntry[] = [];
  let chapterIndex = 0;

  for (const item of tree) {
    const chTitle = item.title.replace(/<[^>]*>/g, "").trim();

    if (item.contents && item.contents.length > 0) {
      let sectionIndex = 0;
      for (const section of item.contents) {
        if (section.contents && section.contents.length > 0) {
          for (const subsec of section.contents) {
            entries.push({
              chapterIndex,
              chapterTitle: chTitle,
              sectionIndex: sectionIndex++,
              sectionTitle: subsec.title.replace(/<[^>]*>/g, "").trim(),
              slug: subsec.slug,
            });
          }
        } else {
          entries.push({
            chapterIndex,
            chapterTitle: chTitle,
            sectionIndex: sectionIndex++,
            sectionTitle: section.title.replace(/<[^>]*>/g, "").trim(),
            slug: section.slug,
          });
        }
      }
      chapterIndex++;
    } else {
      entries.push({
        chapterIndex,
        chapterTitle: chTitle,
        sectionIndex: 0,
        sectionTitle: chTitle,
        slug: item.slug,
      });
      chapterIndex++;
    }
  }

  return entries;
}

function parseBookSlug(input: string): string | null {
  const cleaned = input.trim();
  const urlMatch = cleaned.match(/openstax\.org\/books\/([^/]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-z0-9-]+$/.test(cleaned)) return cleaned;
  return null;
}

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

// --- TEST 1: extractPreloadedState ---
console.log("=== TEST 1: extractPreloadedState Edge Cases ===");

// Normal case
const normalHtml = 'window.__PRELOADED_STATE__ = {"key": "value"};';
assert(extractPreloadedState(normalHtml)?.key === "value", "Normal JSON parsed");

// No marker
assert(extractPreloadedState("no state here") === null, "Missing marker returns null");

// Nested JSON
const nestedHtml = 'window.__PRELOADED_STATE__ = {"a": {"b": {"c": 1}}};';
const nested = extractPreloadedState(nestedHtml) as Record<string, unknown>;
assert(nested !== null && (nested.a as any).b.c === 1, "Nested JSON parsed correctly");

// JSON with strings containing braces
const bracesHtml = 'window.__PRELOADED_STATE__ = {"text": "hello { world }"};';
const bracesResult = extractPreloadedState(bracesHtml);
assert(bracesResult?.text === "hello { world }", "Braces inside strings handled");

// Malformed JSON (unbalanced braces)
const unbalancedHtml = 'window.__PRELOADED_STATE__ = {"key": "value"';
assert(extractPreloadedState(unbalancedHtml) === null, "Unbalanced braces returns null");

// Empty object
const emptyHtml = 'window.__PRELOADED_STATE__ = {};';
assert(extractPreloadedState(emptyHtml) !== null, "Empty object parsed");

// Very large JSON
const largeObj = '{"data": "' + "x".repeat(100_000) + '"}';
const largeHtml = `window.__PRELOADED_STATE__ = ${largeObj};`;
const t0 = performance.now();
const largeResult = extractPreloadedState(largeHtml);
const t1 = performance.now();
console.log(`  100KB JSON: ${(t1 - t0).toFixed(1)}ms`);
assert(largeResult !== null, "Large JSON parsed");

// Escaped quotes in strings
const escapedHtml = 'window.__PRELOADED_STATE__ = {"text": "say \\"hello\\""};';
const escapedResult = extractPreloadedState(escapedHtml);
assert(escapedResult?.text === 'say "hello"', "Escaped quotes handled");

console.log();

// --- TEST 2: extractPageContent ---
console.log("=== TEST 2: extractPageContent Edge Cases ===");

// Normal case
const normalPage = '<div data-book-content="true"><p>Hello</p></div>';
assert(extractPageContent(normalPage) === "<p>Hello</p>", "Normal content extracted");

// Nested divs
const nestedPage = '<div data-book-content="true"><div>Inner<div>Deep</div></div></div>';
const nestedContent = extractPageContent(nestedPage);
assert(nestedContent === "<div>Inner<div>Deep</div></div>", "Nested divs tracked correctly");

// No content marker
assert(extractPageContent("<div>no marker</div>") === "", "Missing marker returns empty");

// Empty content
const emptyPage = '<div data-book-content="true"></div>';
assert(extractPageContent(emptyPage) === "", "Empty content returns empty");

// Mismatched divs (bug trigger)
const mismatchedPage = '<div data-book-content="true"><div>Unclosed content';
const mismatchedResult = extractPageContent(mismatchedPage);
console.log(`  Mismatched divs result length: ${mismatchedResult.length}`);
assert(mismatchedResult.length > 0, "Mismatched divs: returns everything to end of string (no crash but wrong)");

console.log();

// --- TEST 3: flattenTOC ---
console.log("=== TEST 3: flattenTOC Edge Cases ===");

// Empty tree
assert(flattenTOC([]).length === 0, "Empty tree returns empty");

// Single chapter, no sections
const singleChapter = flattenTOC([{ title: "Chapter 1", slug: "ch1" }]);
assert(singleChapter.length === 1, "Single chapter = 1 entry");
assert(singleChapter[0].chapterIndex === 0, "Chapter index is 0");

// Deeply nested (3 levels)
const deepTree: TOCEntry[] = [{
  title: "Unit 1",
  slug: "unit-1",
  contents: [{
    title: "Chapter 1",
    slug: "ch-1",
    contents: [
      { title: "Section 1.1", slug: "s-1-1" },
      { title: "Section 1.2", slug: "s-1-2" },
    ],
  }],
}];
const deepResult = flattenTOC(deepTree);
assert(deepResult.length === 2, "Deep nesting: 2 leaf sections");
assert(deepResult[0].sectionTitle === "Section 1.1", "First section title correct");

// 4+ levels (not handled — only 3 levels supported)
const veryDeep: TOCEntry[] = [{
  title: "Unit",
  slug: "unit",
  contents: [{
    title: "Chapter",
    slug: "chapter",
    contents: [{
      title: "Section",
      slug: "section",
      contents: [{ title: "Subsection", slug: "subsection" }],
    }],
  }],
}];
const veryDeepResult = flattenTOC(veryDeep);
console.log(`  4-level nesting: ${veryDeepResult.length} entries, slug="${veryDeepResult[0]?.slug}"`);
assert(
  veryDeepResult[0]?.slug === "section",
  "BUG: 4th level ignored — 'Section' (level 3) treated as leaf, 'Subsection' contents not checked further"
);

// HTML in titles
const htmlTree: TOCEntry[] = [{
  title: "<b>Chapter</b> 1",
  slug: "ch1",
  contents: [{ title: "<i>Section</i> 1.1", slug: "s1" }],
}];
const htmlResult = flattenTOC(htmlTree);
assert(htmlResult[0].chapterTitle === "Chapter 1", "HTML tags stripped from title");

// Large TOC
const largeTOC: TOCEntry[] = Array.from({ length: 100 }, (_, i) => ({
  title: `Chapter ${i}`,
  slug: `ch-${i}`,
  contents: Array.from({ length: 20 }, (_, j) => ({
    title: `Section ${i}.${j}`,
    slug: `s-${i}-${j}`,
  })),
}));
const t2 = performance.now();
const largeFlat = flattenTOC(largeTOC);
const t3 = performance.now();
console.log(`  100 chapters × 20 sections: ${largeFlat.length} entries in ${(t3 - t2).toFixed(1)}ms`);
assert(largeFlat.length === 2000, "Large TOC flattened correctly");

console.log();

// --- TEST 4: parseBookSlug ---
console.log("=== TEST 4: parseBookSlug ===");

assert(parseBookSlug("https://openstax.org/books/biology-2e/pages/1-introduction") === "biology-2e", "Full URL parsed");
assert(parseBookSlug("biology-2e") === "biology-2e", "Slug directly");
assert(parseBookSlug("  biology-2e  ") === "biology-2e", "Trimmed");
assert(parseBookSlug("BIOLOGY") === null, "Uppercase rejected (lowercase only)");
assert(parseBookSlug("biology 2e") === null, "Spaces rejected");
assert(parseBookSlug("") === null, "Empty string rejected");
assert(parseBookSlug("../../etc/passwd") === null, "Path traversal rejected");
assert(parseBookSlug("https://evil.com/books/malicious/pages/hack") === null, "Non-openstax URL rejected");

// URL with query params
assert(
  parseBookSlug("https://openstax.org/books/chemistry-2e/pages/1?ref=malicious") === "chemistry-2e",
  "URL with query params: slug extracted correctly"
);

console.log();

// --- TEST 5: Data race in import ---
console.log("=== TEST 5: Import Data Race Scenario ===");
console.log("  openstaxFetcher.ts lines 292-293:");
console.log("  1. DELETE all bookSections WHERE bookId = X");
console.log("  2. DELETE all bookChapters WHERE bookId = X");
console.log("  3. Loop: INSERT new chapters and sections");
console.log("");
console.log("  If step 3 fails midway:");
console.log("  - Old data already deleted");
console.log("  - New data partially inserted");
console.log("  - Book stuck in corrupt state");
console.log("  RESULT: FAIL - no transaction wrapping delete+insert\n");

// --- SUMMARY ---
console.log("=== SUMMARY ===");
console.log(`Passed: ${passed}, Failed: ${failed}`);
console.log("\nKey findings:");
console.log("- extractPreloadedState: handles edge cases well");
console.log("- extractPageContent: mismatched divs silently return wrong content");
console.log("- flattenTOC: 4+ nesting levels silently ignored");
console.log("- parseBookSlug: solid validation");
console.log("- Import has data race: delete-then-insert without transaction");
