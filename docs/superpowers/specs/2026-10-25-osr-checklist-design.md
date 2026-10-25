# OSR Checklist: Design

- **Date:** 2026-10-25
- **Status:** Ready for owner approval
- **Tech stack:** see [ADR-0001](../../adr/0001-tech-stack.md)

## 1. Intent

Preparing a monohull for an offshore race means checking it against the World Sailing
Offshore Special Regulations (OSR). Today that means reading a long PDF, decoding
margin codes like `MoMu0,1,2,3` on every rule to see whether it applies, and then
deciphering formal wording to work out what physical item is actually meant.

The OSR Checklist website turns this into a clear, illustrated reference: pick your
category, and see every required item in plain language with a simple drawing,
grouped the way you would walk through the boat. Each item links to its exact source
in the official World Sailing PDF, so the regulation stays the authority and the
site is a guide to it.

**Success looks like:** a skipper or crew member can open the site on their phone,
choose "OSR 3", and understand within seconds what every required item is and where
it is defined, without opening the PDF unless they want to verify something.

## 2. Goals, non-goals, anti-goals

### Goals (v1)
- Equipment and requirements for **monohulls** in **OSR 2, OSR 3, OSR 3 + liferaft,
  OSR 4**.
- The items are **the lines of the official Appendix F Inspection Card** for each
  category, organised like the card (by where you check things on the boat).
- For every item: short name, plain-language explanation, simple drawing, OSR rule
  number(s), and a link to the right page of the official PDF.
- **English and German.**
- **Multiple OSR editions**, selectable via a dropdown.
- Comfortable on **phone and desktop**.

### Non-goals (v1)
- Ticking items off, saved progress, boat profiles, accounts, sharing with crew.
- Multihulls; categories 0, 1, 5 (inshore), 6 (dinghy).
- Showing the verbatim OSR text (requires copyright permission; may come later).
- Offline / installable app.
- National (MNA) or race-specific prescriptions.

### Anti-goals (what would make this a failure even if it works)
- **Wrong applicability.** Showing an item as not required for a category where it is
  required (or vice versa). This is safety equipment; a confidently wrong checklist
  is worse than none.
- **Detaching from the source.** Any item without a traceable OSR reference.
- **Presenting the site as official** or as a substitute for the regulations.
- Rehosting World Sailing's PDFs or reproducing their text without permission.

## 3. Source material

World Sailing publishes, per edition, one **extract PDF per monohull category**
(found via the document pages at https://www.sailing.org/offshore-special-regulations/).

Current editions:

| Edition id | In force | Mo2 | Mo3 | Mo3 + liferaft | Mo4 |
|---|---|---|---|---|---|
| `2026-v1` | 2026-01-01 to 2026-12-31 | [PDF](https://media.sailing.org/sailing/wp-content/uploads/2025/12/05090908/Extract-Mo2_2026-2027_v1.pdf) | (resolve) | (resolve) | (resolve) |
| `2027-v2` | from 2027-01-01 | [PDF](https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo2_2027-2027_v2.pdf) | [PDF](https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo3_2027-2027_v2.pdf) | [PDF](https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo3Life_2027-2027_v2.pdf) | [PDF](https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo4_2027-2027_v2.pdf) |

The remaining V1 URLs are on the World Sailing document pages
`/document/osr-monohull-category-{3,3-liferaft,4}-extract-26/`.

Each extract is 19–29 pages and contains:
- Sections 1–6 of the OSR, filtered to that category (full rule text, category codes in
  the left margin).
- **Appendix F, Inspection Card** for that category: the official checklist, roughly
  57 (Mo4) to 105 (Mo2) lines, each with short wording and one or more rule numbers,
  grouped into sections such as *Lay out on Chart Table or Other Surface*,
  *Lay out on Bunk(s)*, *Grab Bag*, *Below Deck Inspection*,
  *On Deck, Where Stowed or Ready for Deployment*,
  *At Helm or Ready for Immediate Deployment*, *Rigged/Fitted to Demonstrate Use*,
  *General*. Section sets differ slightly per category.

"Mo3 + liferaft" is Category 3 plus the Category 2 liferaft rules (OSR 4.20.x: liferaft
construction, equipment pack, packing/stowage, servicing). Race organisers choose it.

Known extraction pitfall: plain text extraction (`pdftotext -layout`) misaligns the
margin category codes with rule numbers and splits card lines from their rule
numbers. Do not rely on layout-text parsing for applicability.

## 4. User-facing behaviour

### 4.1 Navigation and URLs
Top bar on every page:
- **Edition dropdown**, e.g. "2026 (V1)", "2027 (V2)". The default is the edition in
  force today (by `effectiveFrom`). Because the site is static, "today" means **at
  build time** for the root redirect, plus a tiny client-side script on `/` that picks
  the in-force edition by the visitor's date, so the switch on 1 January works without
  a rebuild.
- **Category selector:** OSR 2 · OSR 3 · OSR 3 + liferaft · OSR 4.
- **Language switch:** EN / DE.

All three choices live in the URL: `/{lang}/{edition}/{category}/`, e.g.
`/de/2027-v2/osr3-liferaft/`. Category slugs: `osr2`, `osr3`, `osr3-liferaft`,
`osr4`. `/` redirects to the browser-preferred language (falls back to `en`), the
current edition and `osr3`. Switching any control keeps the other two.

### 4.2 Checklist page
- Short header: edition, category, "In force from …", and a link to the official
  extract PDF for this edition and category.
- A visible **disclaimer** (both languages): unofficial guide; the official OSR text
  takes precedence; the person in charge remains responsible (OSR 1.02).
- Sections in **inspection card order** for that category, each a heading followed by
  item cards.

### 4.3 Item card
- **Drawing** (SVG line art, no text, uses `currentColor`).
- **Name** in the page language. In German, common German sailing term with the
  official English term in brackets, e.g. "Strecktaue (Jackstays)".
- **Plain explanation**, 2–3 sentences: what the item is and the concrete requirement
  for this category (quantities, sizes, ratings). Category-specific numbers come from
  the extract for this category, not a generic text.
- **Source line:** each rule number, e.g. `OSR 4.04.2`, links to
  `{pdfUrl}#page={n}` of **this category's extract** for this edition, and the page
  number is shown as text ("p. 15"), because mobile PDF viewers often ignore `#page`.
- When an item has a different requirement than in the next-lower category (the
  card's "purple text"), a small "stricter than OSR n" badge. *(Nice-to-have; drop if
  it complicates v1.)*

### 4.4 Layout
Phone-first. Cards stack in one column on phones and sit 2–3 per row on desktop.
Light and dark mode follow the system setting. No horizontal scrolling at 360 px.

## 5. Content model

All content is in the repo under `src/content/`.

```
src/content/
  editions/
    2026-v1.yaml
    2027-v2.yaml
  items/
    2027-v2/
      jackstays.yaml
      fire-extinguishers.yaml
      ...
  drawings/
    jackstays.svg
    ...
```

### 5.1 Edition manifest (`editions/2027-v2.yaml`)
```yaml
id: 2027-v2
label: { en: "2027 (Version 2)", de: "2027 (Version 2)" }
effectiveFrom: 2027-01-01
effectiveTo: 2027-12-31
pdfs:
  osr2: https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo2_2027-2027_v2.pdf
  osr3: https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo3_2027-2027_v2.pdf
  osr3-liferaft: https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo3Life_2027-2027_v2.pdf
  osr4: https://www.sailing.org/wp-content/uploads/2026/06/Extract-Mo4_2027-2027_v2.pdf
sections:            # ordered; union over all categories
  - id: chart-table
    title: { en: "Lay out on chart table", de: "Am Kartentisch auslegen" }
    officialTitle: "Lay out on Chart Table or Other Surface"
  - ...
```

### 5.2 Item (`items/2027-v2/jackstays.yaml`)
```yaml
id: jackstays               # stable across editions; drives drawing + carry-over
drawing: jackstays          # -> drawings/jackstays.svg
rules: ["4.04.2"]
name:
  en: Jackstays
  de: Strecktaue (Jackstays)
applies:                    # per category; absent = not required
  osr2:
    section: on-deck        # placement is per category: it can differ between cards
    order: 120              # position within section (card order)
    pages: [17]             # page in the osr2 extract PDF
    cardHash: "sha256:…"    # fingerprint of the normalised official card line
    explanation:
      en: "A strong line on each side deck ..."
      de: "..."
  osr3:
    section: on-deck
    order: 110
    pages: [15]
    cardHash: "sha256:…"
    explanation: { en: "...", de: "..." }
  # ... osr3-liferaft likewise
  # osr4 absent -> not required in OSR 4
```

Explanations live **per category** because requirements differ (e.g. number of flares,
anchors). When a text is identical across categories it is still stored per
category. Simplicity over deduplication.

**No official wording is committed** (the repo is public; copyright). Instead,
`cardHash` is a SHA-256 of the card line normalised (lower-case, collapsed
whitespace, rule numbers stripped). It is enough to detect "this line changed" for
carry-over and the PR summary. The verbatim card text is only used in memory during the
workflow run, and is written to the workflow log/artifact (not the repo) for reviewers who
want to compare wording. *My call.*

### 5.3 Validation (Zod schemas in `src/content.config.ts`)
Build fails if: an item references an unknown section or category; a category entry
has no page or no EN/DE explanation; a drawing file is missing; rule numbers don't
match `^\d+\.\d+(\.\d+)?$`; an edition lacks a PDF for any of the four categories.

## 6. Extraction pipeline

### 6.1 Trigger and output
GitHub Actions workflow `extract-edition.yml`, **manual trigger only**
(`workflow_dispatch`) with inputs: `edition` id and the four PDF URLs (or path to a
pre-filled edition manifest). It:

1. Downloads the four extract PDFs into a temp directory (not committed).
2. **Extracts** (step 6.2) and **merges** (6.3) into item data.
3. **Carries over** explanations and drawings from the previous edition (6.4).
4. **Generates** missing explanations and drawings (6.5).
5. Writes `editions/{id}.yaml`, `items/{id}/*.yaml`, new `drawings/*.svg`.
6. Opens a **pull request** (`extract/{edition}`) with a summary in the PR body:
   items added / removed / changed vs. the previous edition, and any items the model
   flagged as uncertain.

It never pushes to `main`. Merging the PR publishes via the normal deploy workflow.

### 6.2 Extraction (per category PDF)
The script (TypeScript, `scripts/extract/`, run with Node) sends the four PDFs to the
**OpenAI Responses API** as file inputs, asking for strict structured JSON (Zod schema)
of the merged **Appendix F inspection card**: sections in order; for each line: card text,
rule numbers, per-category placement, and an `uncertain` reason. Page numbers are not
asked of the model; the script finds them in the `pdftotext` output. Model: env
`OSR_MODEL`, default `gpt-5.5`, reasoning effort high. *(Owner switched from Claude to
OpenAI on 2026-10-25.)*

### 6.3 Merge across categories
Card lines from the four categories are merged into items by matching rule numbers
and wording (LLM-assisted, then deterministic: same rule set = same item). An item's
`applies` gets an entry for each category whose card contains it.

**The item list is exactly the Appendix F inspection card lines** (project owner's
decision). Rules in Sections 1–6 that have no card line are out of scope for v1. A
category's card is the source of truth for whether an item applies to that category.

**Cross-check:** for each item × category, the script verifies that the rule
number actually occurs in that category's extract text (simple text search on
`pdftotext` output). Disagreements in either direction (on the card but not in the
extract, or in the extract's equipment sections but missing from the card) are **never
silently dropped or added**. The item follows the card, and the disagreement is listed
in a "Needs attention" section of the PR body for the reviewer to decide.

Item ids are kebab-case English slugs, reused from the previous edition when the rule
set matches, so drawings and explanations carry over.

### 6.4 Carry-over
For an item whose id exists in the previous edition **and** whose `cardHash` for a
category is unchanged, copy the explanation and drawing. Otherwise regenerate the
explanation for that category. Drawings are reused whenever the id matches.

### 6.5 Generation
- **Explanations:** the model gets the full rule text from the extract (pages listed),
  writes EN, then DE (German sailing terminology, official English term in brackets in
  the name). Rules: 2–3 sentences, concrete numbers, no invented requirements, no
  verbatim copying beyond short technical terms.
- **Drawings:** the model writes a single SVG per new item id: `viewBox="0 0 200 200"`,
  stroke-only line art, `stroke="currentColor"`, no `<text>`, no external refs,
  < 10 KB. The script validates with an SVG/XML parser and rejects anything with
  `<script>`, event handlers or external hrefs.

### 6.6 Secrets and cost
`OPENAI_API_KEY` as a repository secret. One edition run is ~4 PDFs × a few
calls plus generation for new items; expected low single-digit USD. The workflow is
never triggered by pushes or PRs, so the secret is not exposed to forks.

### 6.7 Bootstrapping v1
The initial content for both `2026-v1` and `2027-v2` is produced by running the
same workflow, one PR per edition; nothing goes live until those PRs are merged.

## 7. Human review

**The pull request is the review; merging it is the approval and publishes it.**
(Project owner's decision.) Nothing generated reaches the live site without a merged
PR, so there is no per-item "reviewed" flag and no "unverified" marking on the site.

The reviewer (for v1 the project owner) checks per item: correct categories, correct
page numbers, explanation faithful to the rule, German terminology, drawing
recognisable. Fixes are made as commits on the same PR branch before merging. A
`REVIEW.md` checklist in the repo describes this, and the PR body links to it.

## 8. Repository and deployment

- Single repository on GitHub (to be created), public, so GitHub Pages is free.
- `deploy.yml`: on push to `main`, `npm ci && npm run build`, deploy `dist/` to Pages.
- Site lives at `https://<user>.github.io/osr-checklist/` initially. Astro `base`
  configured accordingly; custom domain possible later.
- Node LTS, npm, TypeScript strict.

## 9. Testing

- Schema validation at build (5.3) is the primary content test.
- Unit tests (Vitest) for the extraction script's deterministic parts: merging,
  carry-over, cross-check, SVG sanitising, using fixture JSON (no live API calls in
  tests).
- A build smoke test in CI: build succeeds, expected page count
  (languages × editions × 4), every source link has a page number.

## 10. Legal and attribution

- No copyright footer (owner's decision, 2026-10-25): the site reproduces no OSR text, and the
  "unofficial guide" disclaimer sits at the top of every checklist page.
- Link to the official PDFs on World Sailing's servers; never rehost them.
- No verbatim regulation text rendered. Asking World Sailing/ORC for reprint
  permission is a possible later step.

## 11. Decisions log

**By the project owner:**
- Static reference first; tick-off/progress later, if at all.
- Inspection-card layout; items = card lines only (no rules beyond the card in v1).
- LLM extraction, run as CI, roughly once per edition; edition dropdown.
- AI-generated simple drawings.
- Links only, no verbatim OSR text, for now.
- "OSR 3 + liferaft" as a fourth category choice.
- English and German.
- No offline support needed for now.
- Hosting: GitHub Pages preferred if static (vServer as fallback).
- Every extraction is a GitHub Action that ends in a pull request; the owner reviews
  it; merging publishes. No unreviewed content goes live.

**Builder's calls (open to change):**
- Astro + content collections; YAML data files; pre-rendered per lang × edition × category.
- Extraction opens a PR, never publishes directly.
- Drawings as LLM-written SVG line art, text-free.
- Explanations stored per category; drawings shared per item id.
- Section and order stored per category (cards can differ).
- No verbatim card wording in the repo; `cardHash` fingerprints instead.
- Default category `osr3`; default language from browser.
- Client-side in-force edition pick on `/`.
- "Stricter than" badge as optional.
