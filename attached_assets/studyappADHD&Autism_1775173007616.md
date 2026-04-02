# Evidence-based learning mechanics for a STEM study app

**The strongest evidence points to five interlocking mechanics that, when properly calibrated for fatigue and neurodivergence, can roughly double long-term retention of STEM problem-solving skills.** Spacing, interleaving, and retrieval practice each carry robust effect sizes (d = 0.4–1.2) in mathematics and chemistry, but their implementation for multi-step procedural knowledge differs substantially from the flashcard-style applications most apps default to. Below is an actionable synthesis of each mechanic, drawn from peer-reviewed research, meta-analyses, and classroom experiments — with specific design rules, not theory overviews.

---

## 1. Spaced repetition works for STEM procedures, but the popular 1-3-7-14 schedule lacks direct support

### What the evidence actually shows

Spacing produces large, replicable gains for multi-step math problem-solving. Rohrer and Taylor (2006) found that distributing 10 practice problems across two sessions separated by one week **virtually doubled performance** on a four-week delayed test versus massing all practice into one session. The landmark Rohrer, Dedrick, Hartwig, and Cheung (2020) cluster-randomized trial — 787 seventh-graders across 54 classrooms — produced **d = 0.83** for interleaved-and-spaced math practice over four months. Lyle, Bego, Ralston, and Immekus (2022) confirmed this pattern specifically in university calculus: spaced quiz problems yielded significantly higher criterial test scores (**Hedges' g = 0.32**) despite lower practice quiz scores — a textbook desirable difficulty signature.

The effect sizes for procedural STEM tasks are meaningful but generally smaller than for pure factual recall. Cepeda et al.'s (2006) meta-analysis of 184 articles found **d = 0.85** for verbal/factual recall. For higher-order and non-verbal tasks, estimates converge around **d ≈ 0.50** (Wiseheart et al., 2019; Kapler, Weston, and Wiseheart, 2015). Bego et al. (2024) — the largest multi-course STEM spacing study to date, spanning nine introductory courses — found significant positive effects in Calculus I for Engineers and Chemistry for Health Professionals, but the meta-analytic effect across all nine courses was **not significant when calculus was excluded**. This suggests spacing may be especially potent for mathematics, where cumulative procedural integration is paramount.

**No peer-reviewed study has tested spaced practice specifically for organic chemistry reaction mechanisms or synthesis problems.** This is a critical evidence gap. The closest proxy is the Bego et al. (2024) finding for general chemistry, plus the strong theoretical case from mathematics studies where the tasks (selecting and executing multi-step procedures) are structurally analogous to predicting organic reaction products.

Regarding optimal intervals, Cepeda, Vul, Rohrer, Wixted, and Pashler (2008) established that the **optimal inter-study gap is approximately 10–20% of the desired retention interval**: for a one-month exam, space reviews roughly 3–6 days apart; for a one-week quiz, space at 1–2 days. However, this landmark finding was derived entirely from paired-associate (factual) learning and has never been validated for procedural problem-solving. The popular expanding schedule (1-3-7-14 days) has **no direct empirical support** for STEM procedures. Karpicke and Roediger (2007) found equally spaced retrieval actually produced **superior long-term retention** compared to expanding schedules for vocabulary. Latimier et al.'s meta-analysis found large between-study variability with no clear expanding-schedule advantage.

### Concrete app design implications

- **Space mechanism and calculus problems at gaps equal to roughly 10–20% of the target retention interval.** For a student preparing for a midterm in four weeks, first review of a reaction type at day 1, second at days 3–4, third at days 7–10. For final-exam retention (3+ months), extend gaps to 1–2 weeks between reviews.
- **Use performance-adaptive scheduling, not fixed expanding intervals.** After a correct response on a spaced problem, increase the gap by 1.5–2×. After an error, reset the gap to a shorter interval. This is more defensible than any fixed schedule.
- **Implement successive relearning**: Rawson and Dunlosky (2011) showed that three relearning sessions spaced days apart produced **68% retention at one month** versus ~11% baseline. The app should bring back previously mastered items for periodic relearning rounds — not just new items.
- **For organic chemistry**: extrapolate from math spacing evidence. Space reaction-type practice (e.g., SN2 problems) across sessions separated by 2–7 days, not crammed in one study block.
- **For calculus**: Lyle et al. (2020) found that **across-semester retention depended exclusively on spacing, not on practice amount**. More spaced repetitions mattered less than the same number spread further apart.

### Common implementation mistakes

- **Treating STEM problems like flashcards.** Anki-style apps optimize for factual recall (short response, binary correct/incorrect). Multi-step STEM problems require different session structures — you cannot meaningfully space a synthesis problem the same way you space a vocabulary term.
- **Over-spacing new material.** The Cepeda ratio is for review of already-learned material. Newly introduced procedures need initial massed practice (2–5 problems) before entering the spaced schedule.
- **Ignoring the spacing–fatigue interaction.** For this learner's profile (~33 hours/week work + full course load), spacing reviews to high-energy time slots matters as much as the interval length.

---

## 2. Interleaving should follow a short blocking phase, especially for confusable organic chemistry reactions

### The discrimination advantage is largest for organic chemistry

Interleaving — mixing different problem types within a practice session — produces some of the largest effect sizes in the learning science literature when applied to math and chemistry. Taylor and Rohrer (2010) controlled for spacing and still found interleaving **doubled test scores** (77% vs. 38%, **d = 1.21**) for fourth-graders solving geometry problems. The critical finding: most errors in the blocked group came from **selecting the wrong strategy**, not from executing it incorrectly. Students could solve any individual problem type but couldn't tell which type they were looking at.

Eglington and Kang (2017) directly tested interleaving for **organic chemistry compound categorization** — classifying hydrocarbon diagrams as alkanes, alkenes, alkynes, alcohols, or carbonyls. Interleaved study produced **85% vs. 71%** accuracy for simple categories and **65% vs. 49%** for complex categories on a two-day delayed transfer test with novel exemplars. This is the most direct evidence available for organic chemistry interleaving.

The **discriminative contrast hypothesis** (Kang and Pashler, 2012; Birnbaum, Kornell, Bjork, and Bjork, 2013) explains why: interleaving forces learners to compare adjacent categories, highlighting the subtle diagnostic features that distinguish them. For organic chemistry, this is precisely the bottleneck — SN1, SN2, E1, and E2 reactions share substrates, solvents, and conditions, requiring discrimination based on nucleophile strength, substrate sterics, and solvent polarity. Brunmair and Richter's (2019) meta-analysis of 59 studies confirmed that interleaving effects are **strongest when between-category similarity is high** (exactly the ochem reaction-type scenario) — overall **g = 0.42**, with larger effects for complex visual materials and smaller effects for word-based learning (where blocking actually won, g = −0.39).

For mathematics, Foster, Mueller, Was, Rawson, and Dunlosky (2019) demonstrated that **both discriminative contrast and distributed practice** contribute to the interleaving benefit in math, whereas for visual category learning, discriminative contrast is the dominant mechanism. This means interleaving in calculus gains from two mechanisms simultaneously.

### When blocking should come first

Interleaving is not universally superior. Mielicki and Wiley (2022) found that for university-level probability problems, interleaving benefits **depended on achieving a minimum practice accuracy** — students scoring very low during interleaved practice did not benefit. Hwang (2025) found that for low-achieving learners, interleaving alone was an **"undesirable difficulty"** that overwhelmed them, while a **hybrid approach** (initial blocking → then interleaving) was most effective. Carpenter and Mueller (2013) found blocking superior for pronunciation rules when learners had zero prior knowledge and needed to discover within-category commonalities.

Carvalho and Goldstone's (2014, 2015) Sequential Attention Theory provides the theoretical framework: **interleaving biases attention toward between-category differences** (useful when categories are confusable), while **blocking biases attention toward within-category commonalities** (useful when the learner hasn't yet grasped what defines a category). The practical implication: block first to build the category, then interleave to sharpen discrimination.

### Concrete app design implications

- **For a new reaction type or calculus technique, present 3–5 blocked practice problems** to establish procedural competence. Rohrer and Hartwig (2020) recommend: "After seeing a new skill, students should work several problems in immediate succession" — but more than 3–5 yields sharply diminishing returns.
- **Transition to interleaving when the learner achieves approximately 60–70% accuracy** on the individual problem type. This threshold is derived from Rohrer and Taylor (2007), where 60% accuracy during interleaved practice was sufficient for large test gains, and Mielicki and Wiley (2022), who found benefits depended on minimum practice accuracy.
- **For organic chemistry**: interleave confusable reaction types together. Mix SN1/SN2/E1/E2 problems in a single session once each type has been individually introduced. The high between-category similarity makes this the ideal scenario for discriminative contrast.
- **For calculus**: interleave problem types that share surface features but require different techniques (e.g., integration by parts vs. substitution vs. partial fractions). Foster et al. (2019) showed this benefits from both the discrimination and the spacing mechanisms.
- **Build an interleaving ratio into the algorithm**: after initial blocking, all subsequent practice should mix at least 3 different problem types per session. Rohrer, Dedrick, and Stershic (2015) showed interleaved practice produced **"near immunity against forgetting"** — scores dropped less than 10% from a 1-day to a 30-day delay.

### Common implementation mistakes

- **Interleaving before the learner has any grasp of individual categories.** Presenting SN1 and SN2 problems interleaved before the student understands either mechanism wastes cognitive resources and risks the "undesirable difficulty" pattern Hwang (2025) identified.
- **Interleaving only similar problem types.** While discriminative contrast is strongest for similar categories, Rohrer, Dedrick, and Burgess (2014, d = 1.05) showed benefits even for dissimilar problem types, suggesting interleaving also strengthens problem–strategy associations more broadly.
- **Confusing interleaving with random ordering.** Effective interleaving requires that each problem type appears multiple times across the session, not that problems are randomly sampled. The learner needs repeated opportunities to practice the discrimination.

---

## 3. Retrieval practice for procedures requires step-level formats, not flashcard-style recall

### Standard retrieval practice often fails for procedural STEM knowledge

This is the most critical and counterintuitive finding for app design. While retrieval practice is among the most robust effects in cognitive science — Rowland's (2014) meta-analysis found **g = 0.50** across 159 comparisons, and Dunlosky et al. (2013) rated it "high utility" — **the standard testing effect frequently fails to transfer to multi-step problem-solving**.

Van Gog et al. (2015) found **no benefit of retrieval practice over continued example study** for learning to troubleshoot electrical circuits across four experiments. Yeo and Fazio (2019) demonstrated a crossover: retrieval practice was superior for remembering the text of a worked example, but **repeated studying of worked examples was superior for learning the procedure itself**. O'Day (2019) found that retrieving procedural step descriptions showed **no benefit** on a problem-solving test. Huang et al. (2023) reported **no retrieval practice effect** for mathematical word-problem solving across three experiments, concluding: "retrieval practice after worked example study does not enhance delayed problem-solving performance."

The resolution came from Van den Broek, van Wermeskerken, and van Gog (2025), who found that **stepwise retrieval prompts within worked examples** — prompting the learner to predict each upcoming solution step before revealing it as feedback — produced significantly better recall and problem-solving on a one-week delayed test. This reconciles the conflicting evidence: the retrieval format must engage the **same cognitive processes** as the target performance (transfer-appropriate processing). Recalling that "step 3 is to protonate the nucleophile" is declarative retrieval. Actually predicting the product of step 3 is procedural retrieval.

### The worked-example-to-retrieval-practice transition

The **expertise reversal effect** (Kalyuga et al., 2001, 2003, 2007) establishes the transition logic. For novice programmers, worked examples produced **d = 0.90** advantage over problem-solving practice. For experienced learners, this reversed: worked examples became **harmful** (d = −0.75). Renkl and Atkinson's (2003, 2004) **faded worked examples** provide the bridge — progressively removing solution steps (backward fading: last step first, then second-to-last) outperformed traditional example-problem pairs and fostered both near and far transfer.

Pan and Rickard's (2018) meta-analysis of 192 transfer effect sizes identified three factors that predict when retrieval practice transfers to new problems: **response congruency** (practice answers overlap with test answers, +d = 0.30), **elaborated retrieval** (explaining rather than just answering, +d = 0.23), and **initial test performance** (higher accuracy → greater transfer, +0.006d per percentage point). Agarwal (2019) demonstrated that **higher-order retrieval practice questions** improved higher-order test performance by **20–30%** — and students could "reach the top of Bloom's Taxonomy without starting at the bottom."

### Concrete app design implications

The app should implement a **four-phase format progression** per topic:

- **Phase 1 (Novice):** Complete worked examples with self-explanation prompts. Show the full SN2 mechanism; prompt: "Why does the nucleophile attack from the back side?" This is not retrieval practice — it's schema acquisition. Kalyuga's data says this phase is essential for novices.
- **Phase 2 (Developing):** Backward-faded completion problems. Show the first two arrow-pushing steps of a mechanism; the student completes the remaining steps. For calculus: show the substitution setup; the student executes the integration. Renkl et al. (2004) showed fading was most effective for the specific principles that were faded.
- **Phase 3 (Advancing):** Stepwise retrieval within worked examples, per Van den Broek et al. (2025). Present the starting materials; prompt: "What is the first mechanistic step?" Reveal the answer. "What happens next?" Reveal. Continue through the mechanism. This is the breakthrough format that resolves the null findings.
- **Phase 4 (Proficient):** Full interleaved problem-solving with varied surface features. "Predict the product" for a novel substrate, selecting from a mixed set of reaction types. This is where spacing and interleaving operate at full power.

**Format recommendations by task type:**

- **Predict the product (ochem):** Completion problems in Phase 2, stepwise retrieval in Phase 3, full generation in Phase 4.
- **Identify reagents (ochem):** Short-answer cued recall (given starting material and product, generate the reagent). Generation-based formats outperform multiple choice for transfer (Rowland, 2014).
- **Retrosynthetic analysis:** Stepwise retrieval is ideal — "What disconnection first?" → reveal → "What reagent for this step?" → reveal. Multi-step procedures benefit most from the Van den Broek step-by-step approach.
- **Calculus technique selection:** Interleaved mixed-format problems. Present the integral; student must first identify the technique (substitution, parts, partial fractions), then execute. The identification step is the discrimination task; the execution is procedural.
- **Multiple choice:** Use MC only with **competitive error-based distractors** (common student errors as wrong answers) and always provide elaborative feedback. MC is reliable but produces smaller transfer effects than generation formats.

### Common implementation mistakes

- **Using flashcard-style recall for procedural knowledge.** "What are the steps of an SN2 reaction?" as a text-recall card does not transfer to actually solving SN2 problems (O'Day, 2019; Van Gog et al., 2015). The app must require the learner to **do** the procedure, not recite it.
- **Skipping the worked-example phase for novices.** Jumping straight to retrieval practice before the learner has a procedural schema to retrieve creates unproductive struggle. The expertise reversal effect shows worked examples are genuinely superior for true novices.
- **Providing only correct/incorrect feedback.** Pan and Rickard (2018) found that elaborated feedback (+d = 0.23) is critical for transfer. After an incorrect mechanism prediction, show the correct mechanism and explain *why* — which diagnostic feature was missed.

---

## 4. Sessions of 10–15 minutes hit the sweet spot for this learner's constraints

### The minimum effective duration depends on task complexity

A 2025 meta-analysis of 42 microlearning studies (N = 15,673) found a pooled effect size of **SMD = 0.74** for microlearning versus traditional instruction, with the optimal range at **8–12 minutes per session, 3–5 times weekly** (Alias and Razak, 2025). Sessions shorter than 5 minutes "may lack sufficient depth for meaningful learning"; sessions exceeding 15 minutes approach cognitive load thresholds. However, this meta-analysis drew primarily from factual and simple procedural learning — genuine multi-step STEM problems require somewhat longer.

Cognitive load theory (Sweller et al., 2019) provides the rationale: working memory handles approximately 4±2 information chunks simultaneously. A multi-step organic synthesis or integration-by-parts problem has high element interactivity — many interdependent pieces that must be held in working memory at once. Simple identification tasks (naming a functional group) can work in 2–5 minutes. Single-step procedures (apply the chain rule) need 5–10 minutes. **Multi-step procedures (retrosynthetic analysis, integration by parts) need 10–15 minutes minimum** to allow problem setup, working, and reflection.

The distributed-versus-massed evidence is unambiguous. Baddeley and Longman's (1978) classic study trained 72 postal workers to type: the group practicing **1 hour per day** achieved the same proficiency as the group practicing 4 hours per day — in the same total training time — and retained more at 1-, 3-, and 9-month follow-ups. Donovan and Radosevich's (1999) meta-analysis of 63 studies confirmed **d = 0.46** favoring distributed practice, though with a critical caveat: the effect size **decreased as task complexity increased** (r = −0.25). For highly complex tasks like airplane control simulation, d dropped to 0.07. Murray et al.'s (2024) spacing study on multi-step arithmetic, however, found spacing benefits for both 2-step and 3-step procedures (**η² = 0.056, no complexity interaction**), suggesting moderate procedural complexity still benefits from distribution.

### Fatigue curves are especially steep for ADHD

Vigilance decrement research shows measurable attention decline **within 5 minutes** under high demand, with significant decrements by **15 minutes** for most people (Zanesco et al., 2025). For ADHD learners specifically, clinical and educational sources converge on attention typically waning after **15–20 minutes** of sustained focus, with the Pomodoro Technique (25 minutes on / 5 minutes off) the most recommended structure. Minear et al. (2023) found that retrieval practice benefits ADHD students equally to controls — **the mechanics work, the session length is the constraint**.

Ackerman and Kanfer (2009) found an important nuance: subjective fatigue increases with time-on-task **before** objective performance declines. This means the learner will feel exhausted and want to quit before their learning rate actually drops — a critical factor for an ADHD learner with low frustration tolerance. The app must respect the subjective fatigue signal, not just the objective one.

### Concrete app design implications

- **Default session length: 12–15 minutes for problem-solving practice.** This is long enough for 2–3 multi-step problems with worked feedback, short enough to complete before attention drops.
- **Offer a "quick review" mode of 5–8 minutes** for high-fatigue days (post-work shifts). Restrict this mode to Phase 1–2 activities: reviewing worked examples, completing faded problems, and simple identification tasks. Don't attempt full multi-step synthesis in 5-minute sessions.
- **Target 4–5 sessions per week rather than 2–3 long ones.** Baddeley and Longman's data and the Cepeda ratios both favor higher frequency at shorter duration.
- **Build in a session-end countdown.** At 12 minutes, show "2 more problems" rather than an open-ended queue. ADHD learners perform better with visible endpoints (clear task boundaries reduce executive function burden).
- **Always end on a success.** If the learner is struggling at minute 12, drop difficulty for the final problem to ensure a correct answer before session close. This leverages the peak-end rule and prevents negative emotional association with the app.
- **Inject a micro-break prompt at 15 minutes** if the learner opts to continue. A 60-second breathing/stretch break resets the vigilance decrement cycle.

### Common implementation mistakes

- **Equating session length with learning amount.** Longer sessions feel more productive but produce diminishing returns. Lyle et al. (2020) found retention depended on spacing, not amount — three 10-minute sessions beat one 30-minute session.
- **Making microlearning sessions too simple.** Restricting 10-minute sessions to flashcard review wastes the session. Even in 12 minutes, the learner can engage with one fully worked example + one completion problem + one retrieval problem for the same concept.
- **Ignoring the complexity–duration interaction.** A 5-minute session is fine for "name this functional group" but insufficient for "propose a synthesis of compound X." The app should gate complex problem types behind minimum session-length requirements.

---

## 5. Difficulty calibration must be tighter and faster for ADHD learners

### The 85% rule doesn't apply to multi-step STEM problems

Wilson et al.'s (2019) widely cited finding — published in *Nature Communications* — showed that the optimal error rate for gradient-descent-based learning is **~15.87%** (yielding ~85% accuracy). However, Wilson himself stated this "would most likely apply to perceptual learning" through gradual experience. The derivation assumed **binary classification tasks** where chance performance is 50%. For multi-step STEM problems with many possible errors, open-ended responses, and no fixed chance level, direct extrapolation is not warranted. Al-Fawakhiri et al. (2023) found an optimal range of **60–70%** for more complex error-prone tasks; a separate analysis suggested **64–83%** for complex educational tasks. For multi-step STEM practice in this app, **target 70–80% success rate** for neurotypical learners.

Kapur's productive failure research (meta-analyzed by Sinha and Kapur, 2021: **d = 0.36**, 166 comparisons, >12,000 participants) demonstrates that deliberate high-failure exploration phases can enhance conceptual understanding — but only when followed by direct instruction comparing student solutions. This represents a different paradigm from continuous adaptive practice: productive failure works in a structured explore-then-explain cycle, not as a sustained difficulty target.

### ADHD learners need a narrower productive struggle zone

Seymour, Macatee, and Chronis-Tuscano (2019) found that children with ADHD were **significantly more likely to quit frustrating tasks** than controls, with negative emotional expressions increasing with time-on-task (the opposite pattern of neurotypical children). Montgomery and Antshel (2024) confirmed this in college students. The implication: **the distance between productive struggle and dropout is shorter for ADHD learners**. Where a neurotypical student might tolerate a 70% success rate and still persist, an ADHD learner experiencing the same rate may disengage emotionally after two consecutive failures.

ADHD is also characterized by **lower baseline dopamine**, making delayed rewards less motivating and immediate feedback more critical. EndeavorRx (the FDA-cleared ADHD game) maintains engagement by dynamically adjusting challenge level to keep users in their "optimal zone" — a principle directly transferable to this app. A 2025 Frontiers in Education RCT (N = 80 ADHD children) found that gamified adaptive interventions produced significant improvements in sustained attention and academic performance (p < 0.01), maintained at eight-week follow-up.

### How to operationalize difficulty calibration

The strongest practical models combine accuracy and response time. Kellman et al.'s Adaptive Response Time-based Sequencing (ARTS) system uses response time as a fluency indicator: retention intervals expand as an **inverse function of response time** for correct answers (faster correct → longer delay before revisit). This produced **79% greater learning efficiency** than Atkinson's classic adaptive system. For knowledge state estimation, Bayesian Knowledge Tracing (Corbett and Anderson, 1994) remains the field standard, with mastery declared at **P(mastery) ≥ 0.95** based on response patterns.

ALEKS operationalizes the zone of proximal development through Knowledge Space Theory: after an adaptive assessment (~25–30 questions), students practice items on the **"outer fringe"** of their knowledge state — items they are ready to learn next based on prerequisite mastery. This fringe-based targeting is more principled than uniform difficulty ramping.

### Concrete app design implications

**Difficulty adjustment algorithm (ADHD-calibrated):**

| Signal | Action |
|--------|--------|
| Rolling accuracy > 95% over 3 problems | Increase difficulty — learner is under-challenged |
| Rolling accuracy 85–95% | **Optimal zone for this learner** — maintain current level |
| Rolling accuracy 75–85% | Provide immediate scaffolding (hints, partial solutions) |
| Rolling accuracy < 75% or 2 consecutive errors | Decrease difficulty one level immediately |
| Rolling accuracy < 50% | Drop to worked example mode — learner lacks prerequisite schema |
| Response time > 2× personal rolling baseline | Flag fatigue — ease difficulty regardless of accuracy |
| Session exceeds 15 minutes without break | Prompt gamified break |

Note the tighter thresholds compared to a neurotypical calibration (which might tolerate 70–80% as optimal and wait for 3 consecutive errors). The **2-error trigger** rather than 3-error reflects the ADHD frustration tolerance data.

- **Track response time, not just accuracy.** A correct answer that takes 3× the learner's baseline time signals shaky knowledge or cognitive fatigue — both warrant difficulty adjustment. Implement the ARTS approach: faster correct responses earn longer spacing intervals.
- **Use a warm-up sequence.** Start each session with 2–3 problems at the learner's established comfort level before introducing challenge-zone items. This activates relevant schemas and provides early dopamine hits from success.
- **Inject "confidence boosters" dynamically.** When the system detects a struggling pattern (declining accuracy or increasing response times), insert one easier problem before continuing at the target difficulty. This prevents the frustration cascade.
- **End every session on a success.** If the learner is at minute 12 and has just gotten two problems wrong, the final problem should be at a reduced difficulty level. The peak-end effect means the last experience disproportionately shapes willingness to return.
- **Make progress visible and granular.** Rather than "Chapter 4: 60% complete," show "You've mastered 12 of 18 reaction types — today you nailed E2 eliminations." ADHD learners respond to concrete, immediate progress indicators over abstract completion metrics.

### Organic chemistry vs. calculus calibration differences

For organic chemistry, difficulty primarily scales along **two axes**: number of steps in the mechanism and similarity of the correct reaction type to distractors (SN1 vs. SN2 is harder to discriminate than SN2 vs. aldol condensation). The app should separately track difficulty along both axes — a student might handle 4-step mechanisms fine but struggle with SN1/SN2 discrimination.

For calculus, difficulty scales along **problem complexity** (number of techniques required) and **setup ambiguity** (whether the correct technique is immediately obvious from the integrand's form). A student might execute integration by parts flawlessly but fail to recognize when it's the right tool. The interleaving mechanic (Section 2) specifically addresses this discrimination challenge.

### Common implementation mistakes

- **Applying the 85% rule literally to STEM problems.** Wilson et al. explicitly cautioned against this. For multi-step chemistry and calculus problems, 85% accuracy may be too easy for optimal learning in neurotypical students and roughly right only for ADHD learners who need the frustration buffer.
- **Using accuracy alone for difficulty adjustment.** A student who gets 80% correct but takes 5 minutes per problem is in a very different state than one who gets 80% correct in 45 seconds per problem. Response time is essential data.
- **Failing to distinguish productive from unproductive struggle.** Three consecutive errors with different error types (the student is exploring) is productive. Three consecutive errors with the same error type (the student is stuck in a misconception loop) is unproductive and requires a different intervention — not just easier problems, but targeted feedback or a worked example addressing that specific misconception.
- **Not accounting for time-of-day and session-to-session fatigue variation.** A student doing a 7 AM session before class is in a different cognitive state than after a 6-hour work shift. The app should learn the learner's baseline performance by time of day and adjust difficulty targets accordingly.

---

## Conclusion: how these five mechanics interlock

The mechanics above are not independent modules — they form an integrated system. **Spacing and interleaving are delivery mechanisms** that determine when and in what order problems appear. **Retrieval practice format determines what the learner actually does** with each problem. **Session design constrains the container** in which all of this occurs. **Difficulty calibration is the real-time feedback loop** that keeps everything in the productive zone.

Three synthesis insights emerge that are not obvious from any single mechanic alone. First, the transition from worked examples to retrieval practice (Section 3) interacts with the blocking-to-interleaving transition (Section 2): both transitions should be gated on the same performance threshold (~60–70% accuracy), and they can be executed simultaneously — moving from blocked worked examples to interleaved retrieval practice in a single phase shift. Second, microlearning session constraints (Section 4) limit the number of interleaved problem types per session to roughly 3–4 for multi-step problems; the app should rotate which types are interleaved across sessions rather than trying to cover all types in every session. Third, the ADHD-calibrated difficulty system (Section 5) should **automatically shorten sessions** when fatigue signals accumulate, rather than maintaining a fixed 15-minute target — a session that ends at 8 minutes on a high-fatigue day is better than a session that produces three consecutive failures at minute 12 and a learner who doesn't open the app tomorrow.