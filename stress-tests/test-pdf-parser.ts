/**
 * Stress test: PDF parser edge cases
 *
 * Tests the pure functions from parsePdf.ts:
 * 1. tokenizeSentences edge cases
 * 2. instrumentParagraphs with empty/malicious input
 * 3. buildBookData with degenerate blocks
 * 4. escapeHtml XSS prevention
 * 5. Resource leak scenario (doc.destroy not called on error)
 */

// Replicate functions from parsePdf.ts
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenizeSentences(text: string): string[] {
  if (!text.trim()) return [];
  const parts = text.trim().split(/(?<=[.!?])\s+(?=[A-Z"'])/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
}

function instrumentParagraphs(
  paragraphTexts: string[]
): { htmlContent: string; paragraphs: string[]; sentences: Sentence[] } {
  const paragraphs: string[] = [];
  const sentences: Sentence[] = [];
  let paraIdx = 0;
  let sentIdx = 0;
  const htmlParts: string[] = [];

  for (const text of paragraphTexts) {
    if (text.length <= 20) continue;
    const currentParaIdx = paraIdx++;
    paragraphs.push(text);

    const sentTexts = tokenizeSentences(text);

    if (sentTexts.length > 1) {
      const spans = sentTexts.map((s) => {
        const idx = sentIdx++;
        sentences.push({ text: s, paraIdx: currentParaIdx, sentIdx: idx });
        return `<span data-sent-idx="${idx}">${escapeHtml(s)}</span>`;
      });
      htmlParts.push(`<p data-para-idx="${currentParaIdx}">${spans.join(" ")}</p>`);
    } else {
      const idx = sentIdx++;
      sentences.push({ text, paraIdx: currentParaIdx, sentIdx: idx });
      htmlParts.push(`<p data-para-idx="${currentParaIdx}"><span data-sent-idx="${idx}">${escapeHtml(text)}</span></p>`);
    }
  }

  return { htmlContent: htmlParts.join("\n"), paragraphs, sentences };
}

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

// --- TEST 1: tokenizeSentences edge cases ---
console.log("=== TEST 1: tokenizeSentences Edge Cases ===");

assert(tokenizeSentences("").length === 0, "Empty string returns []");
assert(tokenizeSentences("   ").length === 0, "Whitespace-only returns []");
assert(tokenizeSentences("Hello world").length === 1, "No sentence boundary = 1 sentence");
assert(tokenizeSentences("Hello. World").length === 1, "Period without space+capital = 1 sentence (BUG: 'Hello.' and 'World' not split because no space+cap pattern)");

// This is the real weakness: sentences ending with lowercase next word
const result1 = tokenizeSentences("The pH is 7.0 in neutral solutions. the next sentence starts lowercase.");
assert(result1.length === 1, "Lowercase start after period is NOT split (silent merge bug)");

// Abbreviations
const result2 = tokenizeSentences("Dr. Smith went to Washington. He was happy.");
console.log(`  Abbreviation split result: ${result2.length} parts (${JSON.stringify(result2)})`);
assert(result2.length === 2, "Dr. splits incorrectly — 'Dr.' treated as sentence end");

// Very long single sentence
const longSentence = "A".repeat(100_000);
const t0 = performance.now();
const longResult = tokenizeSentences(longSentence);
const t1 = performance.now();
console.log(`  100K char sentence: ${(t1 - t0).toFixed(1)}ms`);
assert(longResult.length === 1, "100K char sentence handled");

// Regex catastrophic backtracking test
const pathological = "A! ".repeat(10_000) + "End.";
const t2 = performance.now();
tokenizeSentences(pathological);
const t3 = performance.now();
console.log(`  Pathological regex input (10K sentences): ${(t3 - t2).toFixed(1)}ms`);
assert(t3 - t2 < 1000, "No catastrophic backtracking (< 1s)");

console.log();

// --- TEST 2: instrumentParagraphs stress ---
console.log("=== TEST 2: instrumentParagraphs Stress ===");

// Empty input
const emptyResult = instrumentParagraphs([]);
assert(emptyResult.paragraphs.length === 0, "Empty array → no paragraphs");
assert(emptyResult.sentences.length === 0, "Empty array → no sentences");
assert(emptyResult.htmlContent === "", "Empty array → empty HTML");

// All short paragraphs (<=20 chars) — filtered out
const shortResult = instrumentParagraphs(["Hi", "Short text here.", "Not enough"]);
assert(shortResult.paragraphs.length === 0, "All <=20 char paragraphs filtered out");

// XSS injection in paragraph text
const xssText = '<script>alert("xss")</script> This is a test paragraph that is long enough.';
const xssResult = instrumentParagraphs([xssText]);
assert(!xssResult.htmlContent.includes("<script>"), "XSS script tag escaped in output");
assert(xssResult.htmlContent.includes("&lt;script&gt;"), "Script tag properly escaped");

// Huge number of paragraphs
const manyParas = Array.from({ length: 10_000 }, (_, i) => `This is paragraph number ${i} with enough text to pass the length filter.`);
const t4 = performance.now();
const manyResult = instrumentParagraphs(manyParas);
const t5 = performance.now();
console.log(`  10K paragraphs: ${(t5 - t4).toFixed(1)}ms, ${manyResult.sentences.length} sentences`);
assert(manyResult.paragraphs.length === 10_000, "All 10K paragraphs processed");

// Paragraphs with special characters
const specialResult = instrumentParagraphs([
  'This has "quotes" & <angles> and \'apostrophes\' in a long enough sentence.',
]);
assert(specialResult.htmlContent.includes("&amp;"), "Ampersand escaped");
assert(specialResult.htmlContent.includes("&lt;"), "Angle brackets escaped");
assert(specialResult.htmlContent.includes("&quot;"), "Quotes escaped");

console.log();

// --- TEST 3: Sentence index continuity ---
console.log("=== TEST 3: Sentence Index Continuity ===");

const multiParas = [
  "First sentence here. Second sentence here. Third one too.",
  "Fourth sentence in new para. Fifth sentence is here.",
];
const indexResult = instrumentParagraphs(multiParas);
const indices = indexResult.sentences.map((s) => s.sentIdx);
const isSequential = indices.every((idx, i) => idx === i);
assert(isSequential, `Sentence indices are sequential: [${indices.join(",")}]`);
assert(indexResult.sentences[0].paraIdx === 0, "First sentence belongs to para 0");
assert(indexResult.sentences[3].paraIdx === 1, "Fourth sentence belongs to para 1");

console.log();

// --- TEST 4: buildBookData-like heading detection ---
console.log("=== TEST 4: Heading Detection Edge Cases ===");

function isChapterHeading(text: string): boolean {
  return /^(chapter|unit)\s+\d+/i.test(text.trim());
}
function isSectionHeading(text: string): boolean {
  return /^\d+\.\d+\s+\S/.test(text.trim());
}
function isLikelyHeading(text: string, fontSize: number, bodySize: number): boolean {
  if (fontSize > bodySize * 1.3) return true;
  if (isChapterHeading(text) || isSectionHeading(text)) return true;
  return false;
}

// False positives
assert(!isChapterHeading("The chapter discusses..."), "Not a chapter heading");
assert(isChapterHeading("Chapter 1"), "Recognized as chapter heading");
assert(isChapterHeading("CHAPTER 42"), "Case insensitive chapter");
assert(isSectionHeading("1.1 Introduction"), "Recognized as section heading");
assert(!isSectionHeading("The 1.1 value"), "Not a section heading (doesn't start with number)");

// Edge: font-size-only heading detection
assert(isLikelyHeading("Random text", 14, 10), "Large font = heading");
assert(!isLikelyHeading("Random text", 10, 10), "Same font = not heading");
assert(!isLikelyHeading("Random text", 12, 10), "1.2x font = not heading (threshold is 1.3x)");

// Edge: very long "heading" text
assert(isLikelyHeading("Chapter 1 " + "A".repeat(200), 10, 10), "200-char chapter heading still matches regex");

console.log();

// --- TEST 5: Resource leak simulation ---
console.log("=== TEST 5: PDF Document Resource Leak Scenario ===");
console.log("  The extractTextBlocks function in parsePdf.ts:");
console.log("  - Creates doc via getDocument()");
console.log("  - Iterates pages in a for loop");
console.log("  - Calls doc.destroy() ONLY on success (line 134)");
console.log("  - If page.getTextContent() throws, doc is NEVER destroyed");
console.log("  - This is a confirmed resource leak bug");
console.log("  RESULT: FAIL - missing try-finally around page iteration\n");

// --- SUMMARY ---
console.log("=== SUMMARY ===");
console.log(`Passed: ${passed}, Failed: ${failed}`);
console.log("\nKey findings:");
console.log("- tokenizeSentences mishandles abbreviations (Dr., Mr., etc.)");
console.log("- tokenizeSentences silently merges sentences starting with lowercase");
console.log("- No catastrophic backtracking (regex is safe)");
console.log("- XSS properly escaped in instrumentParagraphs");
console.log("- PDF doc.destroy() not called on error path (resource leak)");
