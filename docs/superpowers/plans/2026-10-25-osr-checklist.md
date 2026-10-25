# OSR Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, bilingual (EN/DE) website listing the OSR Appendix F inspection-card items for monohull OSR 2 / 3 / 3 + liferaft / 4 per edition, with drawings, plain explanations and deep links to the official PDFs. It is fed by an LLM extraction workflow that opens a pull request.

**Architecture:** Astro pre-renders one page per `lang × edition × category` from YAML content validated by Zod plus a cross-file validator. A separate Node/TypeScript CLI (`scripts/extract/`) downloads the four category extract PDFs, asks Claude for the merged card structure, computes page numbers and cross-checks deterministically with `pdftotext`, carries over or generates explanations and SVG drawings, writes YAML, and emits a PR summary. GitHub Actions run CI, deploy to Pages on `main`, and run the extraction on manual dispatch, ending in a PR.

**Tech Stack:** Node 22 LTS, npm, TypeScript (strict), Astro 5 (content collections, `glob` loader, i18n routing), Vitest, `yaml`, `@anthropic-ai/sdk` (`messages.parse` + `zodOutputFormat`), `fast-xml-parser`, poppler `pdftotext`, GitHub Actions (`actions/deploy-pages`, `peter-evans/create-pull-request@v7`).

**Spec:** `docs/superpowers/specs/2026-10-25-osr-checklist-design.md` (+ `docs/adr/0001-tech-stack.md`)

## Global Constraints

- Categories, exactly and in this order: `osr2`, `osr3`, `osr3-liferaft`, `osr4`. Labels: "OSR 2", "OSR 3", "OSR 3 + liferaft" / "OSR 3 + Rettungsinsel", "OSR 4".
- Languages: `en`, `de`. URL shape: `{BASE}/{lang}/{edition}/{category}/`, e.g. `/de/2027-v2/osr3-liferaft/`.
- Default category `osr3`. Default language: `de` if `navigator.language` starts with `de`, else `en`.
- Default edition: the one whose `effectiveFrom ≤ today ≤ effectiveTo`, decided **in the browser** on `/` and `/{lang}/`.
- Item ids: kebab-case English slugs, stable across editions. Rule numbers match `^\d+\.\d+(\.\d+)?$`.
- No verbatim OSR/card wording is committed or rendered. Card lines are stored only as `cardHash` = `"sha256:" + hex(sha256(normalised line))`. Normalisation: lower-case, strip rule numbers (`\b\d+\.\d+(\.\d+)?\b`), collapse whitespace, trim.
- PDFs are linked on World Sailing's servers, never rehosted. Every source link shows the page number as text ("p. 15" / "S. 15").
- Footer text (verbatim): EN "OSR © ORC Ltd. 2002, amendments 2003-2026 © World Sailing Limited. This is an unofficial guide. Always refer to the official regulations." DE "OSR © ORC Ltd. 2002, Änderungen 2003-2026 © World Sailing Limited. Dies ist ein inoffizieller Leitfaden. Maßgeblich sind allein die offiziellen Regeln."
- Disclaimer on every checklist page (EN/DE): unofficial guide; official OSR text takes precedence; the person in charge remains responsible (OSR 1.02).
- Drawings: `viewBox="0 0 200 200"`, stroke-only, `stroke="currentColor"`, no `<text>`, no `<script>`, no `on*` attributes, no external `href`, < 10 KB.
- Claude model: env `OSR_MODEL`, default `claude-opus-5-5`, `output_config.effort: "high"`. No forced `tool_choice`; structured outputs via `client.messages.parse` + `zodOutputFormat`.
- The extraction workflow never pushes to `main`; it only opens a PR on branch `extract/{edition}`.
- Layout: phone-first, no horizontal scroll at 360 px, cards 1 column on phone and 2–3 on desktop, light/dark via `prefers-color-scheme`.

## Review Focus

1. **An item applies to a category but its page or DE text is missing** (LLM gap or hand edit). Expected: the build fails naming the item and category; it never renders a link without a page. Test in Task 2 (`validateContent`).
2. **Visitor opens `/` on a date outside every edition's range** (before the first or after the last, e.g. 2028 before a new edition exists). Expected: the latest edition that has started is used; if none has started, the earliest. Test in Task 3 (`inForceEdition`).
3. **A section has no items for the chosen category** (e.g. "Grab bag" in OSR 4). Expected: no empty heading. Test in Task 3 (`buildChecklist`).
4. **The LLM returns an SVG with `<script>`, `onload`, an external `href`, `<text>`, fixed `width`/`height`, or broken XML.** Expected: rejected (or width/height stripped) before it is written. Test in Task 7 (`sanitizeSvg`).
5. **A rule number appears on the card but not in that category's extract text, or the same rule set appears on two card lines** (e.g. several 4.21.4 lines). Expected: listed under "Needs attention" in the PR; distinct items stay distinct (ids come from the LLM, not the rule set). Test in Task 6 (`locatePages` / `crossCheck`) and Task 8 (`mergeAndCheck` keeps duplicate rule sets apart).

---

## File Structure

```
package.json, tsconfig.json, astro.config.mjs, vitest.config.ts, .nvmrc (22)
src/
  content.config.ts            Zod schemas: editions, items collections
  content/
    editions/{id}.yaml         edition manifest
    items/{edition}/{id}.yaml  one item
    drawings/{id}.svg          shared drawings
  lib/
    categories.ts              CATEGORIES, Category, LANGS, Lang, Localized
    editions.ts                inForceEdition, previousEdition
    checklist.ts               buildChecklist
    links.ts                   pdfLink, pageUrl, pickLang
    validate.ts                validateContent
  i18n/ui.ts                   UI strings + t()
  layouts/Base.astro
  components/TopBar.astro, ItemCard.astro, Disclaimer.astro, Footer.astro
  pages/index.astro, pages/[lang]/index.astro, pages/[lang]/[edition]/[category]/index.astro
scripts/extract/
  types.ts                     shared pipeline types
  hash.ts                      cardHash
  pdftext.ts                   pdfPages (pdftotext → string[] per page)
  pages.ts                     locatePages, crossCheck
  svg.ts                       sanitizeSvg
  claude.ts                    extractStructure, generateExplanations, generateDrawing (live API)
  pipeline.ts                  runPipeline (orchestration, deps injected)
  write.ts                     writeEdition (YAML out), prSummary
  run.ts                       CLI entry
tests/                         mirrors src/lib and scripts/extract; fixtures under tests/fixtures/
.github/workflows/ci.yml, deploy.yml, extract-edition.yml
REVIEW.md
```

---

### Task 1: Project scaffold and content schemas

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `.nvmrc`, `.gitignore`, `src/lib/categories.ts`, `src/content.config.ts`
- Create seed content: `src/content/editions/2027-v2.yaml`, `src/content/items/2027-v2/jackstays.yaml`, `src/content/items/2027-v2/foghorn.yaml`, `src/content/drawings/jackstays.svg`, `src/content/drawings/foghorn.svg`
- Test: `tests/lib/categories.test.ts`

**Interfaces:**
- Produces (`src/lib/categories.ts`):
  - `export const CATEGORIES = ["osr2","osr3","osr3-liferaft","osr4"] as const; export type Category = typeof CATEGORIES[number];`
  - `export const LANGS = ["en","de"] as const; export type Lang = typeof LANGS[number];`
  - `export type Localized = Record<Lang, string>;`
  - `export const CATEGORY_LABEL: Record<Category, Localized>` (values from Global Constraints)
- Produces (`src/content.config.ts`): collections `editions` (glob `src/content/editions/*.yaml`) and `items` (glob `src/content/items/**/*.yaml`, id = path without extension, e.g. `2027-v2/jackstays`). Exported Zod schemas `editionSchema`, `itemSchema` and their inferred types `Edition`, `Item`, with the exact shapes of spec §5.1 and §5.2:
  - `Edition = { id, label: Localized, effectiveFrom: Date, effectiveTo: Date, pdfs: Record<Category, url>, sections: {id, title: Localized, officialTitle: string}[] }`
  - `Item = { id, drawing, rules: string[] (regex), name: Localized, applies: Partial<Record<Category, {section, order: number, pages: number[] (min 1), cardHash: string (/^sha256:[0-9a-f]{64}$/), explanation: Localized}>> }`. `applies` must have ≥ 1 key.
  - Put the schemas in `src/lib/schemas.ts` (plain `zod` import) and re-use them in `content.config.ts`, so the CLI can import them without `astro:content`.

- [ ] **Step 1: Scaffold.** `npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git`, then `npm i -D vitest yaml zod` and `npm i`. Scripts: `dev`, `build` (`astro build`), `test` (`vitest run`), `check` (`astro check`), `extract` (`tsx scripts/extract/run.ts`; add `tsx` as a dev dependency). `astro.config.mjs`: `site: process.env.SITE_URL ?? "http://localhost:4321"`, `base: process.env.BASE_PATH ?? "/"`, `trailingSlash: "always"`, i18n `{ locales: ["en","de"], defaultLocale: "en", routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false } }`.
- [ ] **Step 2: Write the failing test** `tests/lib/categories.test.ts`: `CATEGORIES` equals `["osr2","osr3","osr3-liferaft","osr4"]`; every category has non-empty `en` and `de` labels; `itemSchema.safeParse` rejects `rules: ["4-04"]`, rejects an `applies` entry with `pages: []`, and accepts the seed jackstays fixture (loaded with `yaml.parse`).
- [ ] **Step 3: Run** `npx vitest run tests/lib/categories.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement** `categories.ts`, `schemas.ts`, `content.config.ts`. Write the seed content by hand from the Mo2/Mo3/Mo3Life/Mo4 **V2** extracts (URLs in spec §3): an edition manifest with the four PDFs, `effectiveFrom 2027-01-01`, `effectiveTo 2027-12-31` and the sections those two items use; jackstays (OSR 4.04.2; applies to osr2, osr3, osr3-liferaft, not osr4) and foghorn (4.09; all four). Use own-words explanations with real page numbers, and two simple SVGs following the drawing constraints. The bootstrap PR (Task 10) replaces this seed.
- [ ] **Step 5: Run** `npx vitest run` and `npx astro sync`. Expected: PASS; sync reports no schema errors.
- [ ] **Step 6: Commit** `feat: scaffold Astro project with content schemas and seed content`.

### Task 2: Cross-file content validation

**Files:**
- Create: `src/lib/validate.ts`
- Test: `tests/lib/validate.test.ts`

**Interfaces:**
- Consumes: `Edition`, `Item`, `CATEGORIES` (Task 1).
- Produces: `validateContent(input: { editions: Edition[]; items: { edition: string; item: Item }[]; drawingIds: Set<string> }): string[]`. It returns human-readable errors and an empty array when valid.

- [ ] **Step 1: Write failing tests**, one per rule, each asserting that the returned array contains a message with the item id and category:
  - item references a section id not in its edition's `sections` → error
  - item folder names an edition that has no manifest → error
  - `item.drawing` not in `drawingIds` → error
  - `applies[cat].explanation.de` empty string → error (Review Focus 1)
  - duplicate `order` within the same edition + category + section → error
  - the valid seed fixture → `[]`
- [ ] **Step 2: Run** `npx vitest run tests/lib/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `validateContent`.** It is a pure function and does no I/O.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add cross-file content validation`.

### Task 3: Checklist and edition logic

**Files:**
- Create: `src/lib/editions.ts`, `src/lib/checklist.ts`, `src/lib/links.ts`
- Test: `tests/lib/editions.test.ts`, `tests/lib/checklist.test.ts`, `tests/lib/links.test.ts`

**Interfaces:**
- Produces:
  - `inForceEdition(editions: Pick<Edition,"id"|"effectiveFrom"|"effectiveTo">[], today: Date): string`. Returns the edition whose range contains `today`; otherwise the latest with `effectiveFrom ≤ today`; otherwise the earliest by `effectiveFrom`.
  - `previousEdition(editions, id: string): string | undefined`. The edition with the latest `effectiveFrom` before the given one.
  - `buildChecklist(edition: Edition, items: Item[], category: Category): { section: Edition["sections"][number]; items: Item[] }[]`. Sections are in manifest order, items are sorted by `applies[category].order`, only items with `applies[category]` are included, and empty sections are omitted.
  - `pdfLink(pdfUrl: string, page: number): string` returns `${pdfUrl}#page=${page}`.
  - `pageUrl(base: string, lang: Lang, edition: string, category: Category): string` returns `${base}${lang}/${edition}/${category}/` (`base` always ends with `/`).
  - `pickLang(navigatorLanguage: string | undefined): Lang`.

- [ ] **Step 1: Write failing tests:**
  - `inForceEdition`: editions `2026-v1` (2026-01-01..2026-12-31) and `2027-v2` (2027-01-01..2027-12-31). `2026-10-25` → `2026-v1`; `2027-01-01` → `2027-v2`; `2028-03-01` → `2027-v2`; `2025-06-01` → `2026-v1` (Review Focus 2).
  - `previousEdition(..., "2027-v2")` → `"2026-v1"`; `previousEdition(..., "2026-v1")` → `undefined`.
  - `buildChecklist`: with a section that has only osr2 items, calling it for `osr4` omits that section (Review Focus 3); items come back sorted by order; an item without `applies.osr4` is excluded for osr4.
  - `pdfLink("https://x/a.pdf", 15)` → `"https://x/a.pdf#page=15"`. `pageUrl("/osr-checklist/","de","2027-v2","osr3")` → `"/osr-checklist/de/2027-v2/osr3/"`.
  - `pickLang`: `"de-AT"`, `"de-CH"` and `"de"` give `de`; `"en-GB"`, `"fr"` and `undefined` give `en`.
- [ ] **Step 2: Run** `npx vitest run tests/lib`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add checklist grouping, edition selection and link helpers`.

### Task 4: Pages, components and styling

**Files:**
- Create: `src/i18n/ui.ts`, `src/layouts/Base.astro`, `src/components/TopBar.astro`, `src/components/ItemCard.astro`, `src/components/Disclaimer.astro`, `src/components/Footer.astro`, `src/pages/index.astro`, `src/pages/[lang]/index.astro`, `src/pages/[lang]/[edition]/[category]/index.astro`
- Test: `tests/build.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: `t(lang: Lang, key: UiKey): string` in `src/i18n/ui.ts`. Keys at least: `edition`, `category`, `inForceFrom`, `officialPdf`, `page` (EN "p." / DE "S."), `disclaimer`, `footer`, `language`.
- The optional "stricter than OSR n" badge (spec §4.3) is **not built in v1**: the merged data has no reliable "stricter" signal without storing card wording. Planner's call.

- [ ] **Step 1: Write the failing build smoke test** `tests/build.test.ts`. It runs `astro build` once in `beforeAll` (timeout 120 s) and then asserts:
  - `dist/{lang}/2027-v2/{cat}/index.html` exists for all 2 × 4 combinations (8 files);
  - every `href` containing `.pdf#page=` is followed in the same item card by visible text matching `/(p\.|S\.) \d+/`;
  - `dist/de/2027-v2/osr4/index.html` contains no `jackstays` card (via a `data-item="jackstays"` attribute), and `osr3` does contain it;
  - each checklist page contains the footer text from Global Constraints in its language;
  - `dist/index.html` contains `location.replace(` and a `<noscript>` block with a link to every edition × language checklist page (`/{lang}/{edition}/osr3/`).
- [ ] **Step 2: Run** `npx vitest run tests/build.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement pages.**
  - `[lang]/[edition]/[category]/index.astro`: `getStaticPaths` loads both collections, calls `validateContent` and **throws on any error** (build fails), then emits all lang × edition × category paths. It renders the TopBar, a header (edition label, "in force from", link to `edition.pdfs[category]`), the Disclaimer, the sections from `buildChecklist`, and the Footer.
  - `TopBar`: an edition `<select>` whose options' `value` is `pageUrl(...)` for the same lang and category, plus a tiny inline script that navigates on change; category links in a segmented control with `aria-current="page"`; a language link to the same edition and category.
  - `ItemCard`: the inlined SVG (read via `import.meta.glob("/src/content/drawings/*.svg", { query: "?raw", import: "default", eager: true })`), the name, the explanation for the category, and for each rule `OSR {rule}` linked with `pdfLink` to the first page, plus a page text. Root element carries `data-item={id}`.
  - `index.astro` and `[lang]/index.astro`: an inline script with the editions' `{id, effectiveFrom, effectiveTo}` serialized and the same selection rule as `inForceEdition` (import the function and inline it with `define:vars` or a bundled `<script>`). It uses `pickLang` (root only) and `location.replace(pageUrl(...,"osr3"))`, with `<noscript>` links as a fallback.
  - CSS in `Base.astro`: colour tokens on `:root` with a dark override under `@media (prefers-color-scheme: dark)`, a card grid of `repeat(auto-fill, minmax(18rem, 1fr))`, drawings at `max-width: 8rem`, and `color: var(--fg)` so `currentColor` works.
- [ ] **Step 4: Run** `npx vitest run` and `npx astro check`. Expected: PASS and 0 errors.
- [ ] **Step 5: Manual check.** `npm run dev`, open `/de/2027-v2/osr3/` at 360 px width in a browser's device mode: no horizontal scroll, and dark mode readable.
- [ ] **Step 6: Commit** `feat: render checklist pages with top bar, item cards and redirects`.

### Task 5: CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: `ci.yml`.** Runs on `pull_request` and on `push` to non-`main` branches. Ubuntu, Node from `.nvmrc`, `npm ci`, `npx astro check`, `npm test`.
- [ ] **Step 2: `deploy.yml`.** Runs on `push` to `main` and `workflow_dispatch`. Permissions `pages: write`, `id-token: write`, `contents: read`. Steps: checkout, setup-node, `actions/configure-pages@v5` (id `pages`), `npm ci`, `npm test`, `npm run build` with env `SITE_URL=${{ steps.pages.outputs.origin }}`, `BASE_PATH=${{ steps.pages.outputs.base_path }}/`, then `actions/upload-pages-artifact@v3` (path `dist`) and a `deploy` job running `actions/deploy-pages@v4`.
- [ ] **Step 3: Verify locally.** `BASE_PATH=/osr-checklist/ npm run build`, then `grep -r 'href="/de/' dist | head` gives no output (every internal link carries the base).
- [ ] **Step 4: Commit** `ci: add test workflow and GitHub Pages deployment`.

### Task 6: Extraction building blocks: hashing, PDF text, pages, cross-check

**Files:**
- Create: `scripts/extract/types.ts`, `scripts/extract/hash.ts`, `scripts/extract/pdftext.ts`, `scripts/extract/pages.ts`
- Test: `tests/extract/hash.test.ts`, `tests/extract/pages.test.ts`, fixture `tests/fixtures/pages-mo3.json` (an array of page strings shaped like `pdftotext -layout` output: a Section 4 page containing `4.04.2` and `4.09`, plus an Appendix F page whose first lines include `APPENDIX F`)

**Interfaces:**
- Produces (`types.ts`):
  - `ExtractedItem = { id: string; rules: string[]; name: Localized; perCategory: Partial<Record<Category, { section: string; order: number; cardLine: string }>>; uncertain?: string }`
  - `ExtractedSection = { id: string; officialTitle: string; title: Localized }`
  - `Extraction = { sections: ExtractedSection[]; items: ExtractedItem[] }`
  - `Attention = { itemId?: string; category: Category; rule?: string; message: string }`
- Produces:
  - `cardHash(line: string): string`, using the normalisation from Global Constraints.
  - `pdfPages(pdfPath: string): Promise<string[]>`. Runs `pdftotext -layout <pdf> -` via `execFile` and splits on `\f`. Index 0 is page 1.
  - `locatePages(rule: string, pages: string[]): number[]`. Returns 1-based pages **before the first page containing `APPENDIX F`** where `rule` occurs as a whole token (`(?<![\d.])4\.04\.2(?![\d])`), first occurrence first.
  - `crossCheck(items: ExtractedItem[], pagesByCat: Record<Category, string[]>): Attention[]`. It emits (a) for each item × category on the card, each rule with no located page: `"rule {r} on card but not found in extract text"`; and (b) for each category, rules of the form `[45]\.\d\d\.\d+` that appear on Section 4/5 pages but on no card item of that category: `"rule {r} in extract but on no card line"`.

- [ ] **Step 1: Write failing tests:**
  - `cardHash("Jackstays 4.04.2  per side")` equals `cardHash("jackstays per side")`, starts with `sha256:` and is 71 characters long; different text gives a different hash.
  - `locatePages("4.04.2", fixture)` returns the Section 4 page number and not the Appendix F page; `locatePages("4.04.20", fixture)` returns `[]` (no prefix match); `locatePages("4.04", …)` does not match inside `4.04.2`.
  - `crossCheck` with an item whose rule `9.99.9` is absent gives one Attention with that rule (Review Focus 5a); a rule present in the fixture's Section 4 page and on no item gives the "on no card line" message.
- [ ] **Step 2: Run** `npx vitest run tests/extract`. Expected: FAIL.
- [ ] **Step 3: Implement.** `pdftext.ts` has no unit test; Task 10 exercises it.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(extract): add card hashing, page location and cross-check`.

### Task 7: SVG sanitiser and Claude calls

**Files:**
- Create: `scripts/extract/svg.ts`, `scripts/extract/claude.ts`
- Test: `tests/extract/svg.test.ts`

**Interfaces:**
- Consumes: types from Task 6.
- Produces:
  - `sanitizeSvg(svg: string): string`. Throws `Error` on invalid XML (parse with `fast-xml-parser`'s `XMLValidator`), on a root that isn't `<svg>`, on `<script>`, `<text>`, `<foreignObject>` or `<image>`, on any `on*` attribute, on any `href`/`xlink:href` not starting with `#`, or on output over 10 240 bytes. It removes root `width` and `height`, and sets `viewBox="0 0 200 200"` if it is missing.
  - `extractStructure(client: Anthropic, pdfs: Record<Category, Buffer>, previous: { id: string; rules: string[]; name: Localized }[]): Promise<Extraction>`. One `client.messages.parse` call with the four PDFs as base64 `document` blocks (each with `title` = category) followed by the instruction text, and `output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) }` with `max_tokens: 32000`. The prompt must say: use only Appendix F inspection-card lines; one item per distinct card line concept, merged across categories; keep separate items when several lines share rule numbers; reuse an id from `previous` when it is the same concept; `section` ids are kebab-case from the card headings; `order` is the line's position within its section on that category's card (10, 20, …); `cardLine` is the card wording; set `uncertain` with a reason when unsure; DE titles and names use German sailing terminology with the official English term in brackets. If `stop_reason` is not `end_turn`, or `parsed_output` is null, throw.
  - `generateExplanations(client, item: ExtractedItem, ruleTextByCat: Partial<Record<Category, string>>): Promise<Partial<Record<Category, Localized>>>`. One `parse` call per item, given the concatenated text of the located pages per category. Rules: 2–3 sentences, concrete numbers for that category, nothing invented, no verbatim copying beyond technical terms, EN and DE.
  - `generateDrawing(client, item: ExtractedItem): Promise<string>`. Returns raw SVG text following the drawing constraints. The caller sanitises it.
  - Model `process.env.OSR_MODEL ?? "claude-opus-5-5"`. The client is created by the caller with `new Anthropic()`.

- [ ] **Step 1: Write failing tests** for `sanitizeSvg` (Review Focus 4): rejects `<svg><script/></svg>`, `<svg onload="x"/>`, `<svg><use href="https://e/x"/></svg>`, `<svg><text>Hi</text></svg>`, `<svg>` without a closing tag, and `<div/>`. It accepts `<svg width="200" height="200" viewBox="0 0 200 200"><path d="M0 0L10 10" stroke="currentColor"/></svg>` and the result contains no `width=`. It accepts `<use href="#a"/>`.
- [ ] **Step 2: Run** `npx vitest run tests/extract/svg.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `svg.ts` and `claude.ts`. Install `@anthropic-ai/sdk` and `fast-xml-parser`. `claude.ts` has no unit tests; the pipeline tests inject fakes and Task 10 exercises the real calls.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Expected: PASS and no type errors.
- [ ] **Step 5: Commit** `feat(extract): add SVG sanitiser and Claude extraction/generation calls`.

### Task 8: Pipeline orchestration, carry-over and writing

**Files:**
- Create: `scripts/extract/pipeline.ts`, `scripts/extract/write.ts`, `scripts/extract/run.ts`
- Test: `tests/extract/pipeline.test.ts`, `tests/extract/write.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 6 and 7.
- Produces:
  - `type Deps = { extractStructure: (pdfs, previous) => Promise<Extraction>; generateExplanations: (item, ruleTextByCat) => Promise<Partial<Record<Category, Localized>>>; generateDrawing: (item) => Promise<string>; existingDrawings: Set<string> }`. These are the `claude.ts` functions with the client already bound.
  - `runPipeline(input: { edition: Pick<Edition,"id"|"label"|"effectiveFrom"|"effectiveTo"|"pdfs">; pdfs: Record<Category, Buffer>; pagesByCat: Record<Category, string[]>; previousItems: Item[] }, deps: Deps): Promise<{ edition: Edition; items: Item[]; drawings: Record<string, string>; attention: Attention[]; diff: { added: string[]; removed: string[]; changed: string[]; carried: string[] } }>`
  - `writeEdition(root: string, result): Promise<void>`. Writes `src/content/editions/{id}.yaml`, `src/content/items/{id}/{itemId}.yaml` (it deletes the folder first so removed items disappear), and `src/content/drawings/{id}.svg` for new drawings only.
  - `prSummary(result, editionId: string): string`. Markdown with sections "Needs attention" (first, with each Attention and each `uncertain`), "Added", "Removed", "Changed", "Carried over", and a link to `REVIEW.md`.

- [ ] **Step 1: Write failing tests** with fake deps (counting calls) and fixtures:
  - **Carry-over:** a previous item `jackstays` whose `applies.osr3.cardHash` equals the new hash keeps its old osr3 explanation, and `generateExplanations` is not called for it; a changed hash for osr2 triggers exactly one call for that item, requesting only `osr2`. The item appears in `diff.changed`.
  - **Drawings:** `generateDrawing` is called only for ids not in `existingDrawings`. An unsafe SVG from the fake gives an Attention ("drawing rejected: …") and that item falls back to `drawing: "placeholder"`. Ship `src/content/drawings/placeholder.svg` with this task.
  - **Pages:** `applies[cat].pages` comes from `locatePages` over all the item's rules (deduplicated and sorted). If none is found, the item is still written with `pages: [1]` **and** an Attention is added, so the reviewer must fix it before merge. (The page-1 fallback keeps the schema valid while the Attention blocks a careless merge.)
  - **Duplicates (Review Focus 5b):** two extracted items with identical `rules` but different ids remain two items.
  - **Diff:** `diff.added` and `diff.removed` are computed against `previousItems` ids.
  - `prSummary` puts "Needs attention" before "Added".
  - `writeEdition` into a temp dir followed by reading back with `itemSchema` and `validateContent` gives no errors.
- [ ] **Step 2: Run** `npx vitest run tests/extract`. Expected: FAIL.
- [ ] **Step 3: Implement** `pipeline.ts` and `write.ts`. `cardHash(cardLine)` is computed here; `cardLine` is never written.
- [ ] **Step 4: Implement `run.ts` CLI:** `npm run extract -- --edition 2027-v2 --label-en "2027 (Version 2)" --label-de "2027 (Version 2)" --from 2027-01-01 --to 2027-12-31 --osr2 <url> --osr3 <url> --osr3-liferaft <url> --osr4 <url> [--summary-out pr-body.md]`. It downloads the PDFs to `os.tmpdir()/osr-{edition}/`, runs `pdfPages` on each, takes the previous edition's items from `previousEdition()` over the manifests on disk (empty if none), binds the deps with `new Anthropic()`, calls `runPipeline` and `writeEdition`, and writes the summary file. It exits non-zero on any thrown error.
- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(extract): add pipeline with carry-over, YAML writer and CLI`.

### Task 9: Extraction workflow and review guide

**Files:**
- Create: `.github/workflows/extract-edition.yml`, `REVIEW.md`

- [ ] **Step 1: `extract-edition.yml`.** Trigger `workflow_dispatch` only, with inputs `edition`, `label_en`, `label_de`, `from`, `to`, `osr2_url`, `osr3_url`, `osr3_liferaft_url`, `osr4_url`. Permissions `contents: write`, `pull-requests: write`. Steps: checkout; setup-node; `sudo apt-get install -y poppler-utils`; `npm ci`; `npm run extract -- …inputs… --summary-out pr-body.md` with `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`; `npm test` and `npm run build`. If the build fails, the job still opens the PR with the failure appended to the body: use `continue-on-error` on the build step and append its outcome. Then `peter-evans/create-pull-request@v7` with `branch: extract/${{ inputs.edition }}`, `title: "OSR edition ${{ inputs.edition }}"`, `body-path: pr-body.md`, `add-paths: src/content/**`.
- [ ] **Step 2: `REVIEW.md`.** Explains what to check per item: categories against the card in each PDF, page links open the right page, the explanation is faithful and uses concrete numbers, the German terms are right, the drawing is recognisable. It also says: resolve every "Needs attention" line before merging; fix by committing to the PR branch; merging publishes.
- [ ] **Step 3: Verify.** `npx --yes @action-validator/cli .github/workflows/extract-edition.yml` (or `actionlint` if available) reports no errors.
- [ ] **Step 4: Commit** `ci: add manual extraction workflow opening a review PR`.

### Task 10: Bootstrap real content (needs the owner)

This task needs an Anthropic API key and a GitHub repository. It is the first live run of `claude.ts` and `pdftext.ts`.

- [ ] **Step 1: Owner creates the GitHub repo** `osr-checklist` (public), adds the remote, pushes `main`, enables Pages (source: GitHub Actions), and adds the `ANTHROPIC_API_KEY` secret.
- [ ] **Step 2: Resolve the remaining V1 PDF URLs** (Mo3, Mo3Life, Mo4) from `https://www.sailing.org/document/osr-monohull-category-{3,3-liferaft,4}-extract-26/` (the PDF link is in the page payload). Then run the workflow for `2026-v1` (2026-01-01..2026-12-31).
- [ ] **Step 3: Owner reviews and merges** the `2026-v1` PR following `REVIEW.md`.
- [ ] **Step 4: Run the workflow for `2027-v2`** (2027-01-01..2027-12-31, V2 URLs from spec §3). It carries over from `2026-v1`. In the same PR, delete the hand-written seed items if the pipeline didn't overwrite them. Owner reviews and merges.
- [ ] **Step 5: Verify the live site.** `/` redirects to the `2026-v1` edition today (2026); `/de/2027-v2/osr3-liferaft/` shows liferaft items absent from `/de/2027-v2/osr3/`; a PDF link opens the right page on desktop.
