/**
 * Stress test: TTS boundary bugs (useTTS.ts logic)
 *
 * Tests:
 * 1. skipNext with empty sentences array → index becomes -1
 * 2. skipPrev at index 0
 * 3. Rapid skip cycles
 * 4. updateSent with out-of-bounds index
 */

interface Sentence {
  text: string;
  paraIdx: number;
  sentIdx: number;
}

// Simulate the TTS state machine
class TTSSimulator {
  currentSentIdx = 0;
  sentences: Sentence[];

  constructor(sentences: Sentence[]) {
    this.sentences = sentences;
  }

  // Replicates skipNext from useTTS.ts line 160-167
  skipNext(): number {
    const nextIdx = Math.min(this.currentSentIdx + 1, this.sentences.length - 1);
    this.currentSentIdx = nextIdx;
    return nextIdx;
  }

  // Replicates skipPrev from useTTS.ts line 169-176
  skipPrev(): number {
    const prevIdx = Math.max(this.currentSentIdx - 1, 0);
    this.currentSentIdx = prevIdx;
    return prevIdx;
  }

  // Replicates updateSent from useTTS.ts line 58-65
  updateSent(si: number): { sentIdx: number; paraIdx: number } {
    this.currentSentIdx = si;
    const sent = this.sentences[si];
    const pi = sent?.paraIdx ?? 0;
    return { sentIdx: si, paraIdx: pi };
  }
}

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

// --- TEST 1: Empty sentences array ---
console.log("=== TEST 1: Empty Sentences Array ===");
const emptyTTS = new TTSSimulator([]);

const skipNextResult = emptyTTS.skipNext();
console.log(`  skipNext() on empty array: index = ${skipNextResult}`);
assert(skipNextResult === -1, "BUG CONFIRMED: Math.min(1, -1) = -1, index becomes -1");

// Now try to access sentence at index -1
const sent = emptyTTS.sentences[skipNextResult];
console.log(`  sentences[-1] = ${sent}`);
assert(sent === undefined, "Accessing sentences[-1] returns undefined");

// updateSent with -1
const updateResult = emptyTTS.updateSent(-1);
console.log(`  updateSent(-1): paraIdx = ${updateResult.paraIdx}`);
assert(updateResult.paraIdx === 0, "Falls back to paraIdx 0 via optional chaining");

// skipPrev on empty
const emptyTTS2 = new TTSSimulator([]);
const skipPrevResult = emptyTTS2.skipPrev();
console.log(`  skipPrev() on empty array: index = ${skipPrevResult}`);
assert(skipPrevResult === 0, "skipPrev starts at 0, stays at 0 — safe but misleading");

console.log();

// --- TEST 2: Single sentence ---
console.log("=== TEST 2: Single Sentence ===");
const singleTTS = new TTSSimulator([{ text: "Hello.", paraIdx: 0, sentIdx: 0 }]);

const nextFromSingle = singleTTS.skipNext();
assert(nextFromSingle === 0, "skipNext on single sentence stays at 0");

singleTTS.currentSentIdx = 0;
const prevFromSingle = singleTTS.skipPrev();
assert(prevFromSingle === 0, "skipPrev on single sentence stays at 0");

console.log();

// --- TEST 3: Rapid boundary cycling ---
console.log("=== TEST 3: Rapid Boundary Cycling ===");
const sentences: Sentence[] = [
  { text: "First.", paraIdx: 0, sentIdx: 0 },
  { text: "Second.", paraIdx: 0, sentIdx: 1 },
  { text: "Third.", paraIdx: 1, sentIdx: 2 },
];
const cycleTTS = new TTSSimulator(sentences);

// Rapidly skip to end
for (let i = 0; i < 100; i++) cycleTTS.skipNext();
assert(cycleTTS.currentSentIdx === 2, "100x skipNext stops at last sentence (2)");

// Rapidly skip back
for (let i = 0; i < 100; i++) cycleTTS.skipPrev();
assert(cycleTTS.currentSentIdx === 0, "100x skipPrev stops at first sentence (0)");

console.log();

// --- TEST 4: Out-of-bounds updateSent ---
console.log("=== TEST 4: Out-of-Bounds updateSent ===");
const boundsTTS = new TTSSimulator(sentences);

const oob1 = boundsTTS.updateSent(999);
console.log(`  updateSent(999): sentIdx=${oob1.sentIdx}, paraIdx=${oob1.paraIdx}`);
assert(oob1.sentIdx === 999, "Sets index to 999 without bounds check");
assert(oob1.paraIdx === 0, "Falls back to paraIdx 0 (optional chaining)");

const oob2 = boundsTTS.updateSent(-5);
console.log(`  updateSent(-5): sentIdx=${oob2.sentIdx}, paraIdx=${oob2.paraIdx}`);
assert(oob2.sentIdx === -5, "Negative index accepted without check");

// Now skipNext from index 999
const afterOOB = boundsTTS.skipNext();
console.log(`  skipNext() after updateSent(999): index = ${afterOOB}`);
assert(afterOOB === 2, "Math.min(1000, 2) = 2, snaps back to bounds");

console.log();

// --- TEST 5: speakFromIdx boundary ---
console.log("=== TEST 5: speakNext Loop Termination ===");
// Simulating the speakNext logic from useTTS.ts line 78-121
let iterations = 0;
const maxIter = 10_000;
function simulateSpeakNext(i: number, sentencesArr: Sentence[]): void {
  iterations++;
  if (iterations > maxIter) {
    console.log("  FAIL: Infinite loop detected in speakNext simulation");
    return;
  }
  if (i >= sentencesArr.length) {
    return; // Would call onEnd()
  }
  const s = sentencesArr[i];
  if (!s?.text?.trim()) {
    simulateSpeakNext(i + 1, sentencesArr); // Skip empty
    return;
  }
  // Would speak, then onend calls speakNext(i + 1)
  simulateSpeakNext(i + 1, sentencesArr);
}

// Normal case
iterations = 0;
simulateSpeakNext(0, sentences);
assert(iterations === 4, `Normal: ${iterations} iterations for 3 sentences (3 + 1 termination)`);

// All empty sentences — could cause stack overflow with many items
const emptySentences = Array.from({ length: 5000 }, (_, i) => ({
  text: "", paraIdx: 0, sentIdx: i,
}));
iterations = 0;
try {
  simulateSpeakNext(0, emptySentences);
  console.log(`  Empty sentences (5000): ${iterations} iterations`);
  assert(false, "BUG: 5000 recursive setTimeout(speakNext) calls with empty text — stack overflow risk in browser");
} catch (e) {
  console.log(`  Empty sentences (5000): Stack overflow after ${iterations} iterations`);
  assert(true, "CONFIRMED: Recursive speakNext with empty sentences causes stack overflow");
}

console.log();

// --- SUMMARY ---
console.log("=== SUMMARY ===");
console.log(`Passed: ${passed}, Failed: ${failed}`);
console.log("\nKey findings:");
console.log("- skipNext on empty array: index becomes -1 (bug)");
console.log("- updateSent accepts any index without bounds checking");
console.log("- Empty sentence array with speakNext: potential stack overflow");
console.log("- No validation before accessing sentences[idx]");
