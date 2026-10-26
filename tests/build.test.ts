import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CATEGORIES, LANGS } from "../src/lib/categories";

const FOOTER = {
  en: "OSR © ORC Ltd. 2002, amendments 2003-2026 © World Sailing Limited. This is an unofficial guide. Always refer to the official regulations.",
  de: "OSR © ORC Ltd. 2002, Änderungen 2003-2026 © World Sailing Limited. Dies ist ein inoffizieller Leitfaden. Maßgeblich sind allein die offiziellen Regeln.",
};

const page = (lang: string, category: string) => readFileSync(`dist/${lang}/2027-v2/${category}/index.html`, "utf8");

/** Splits a page into item-card chunks keyed by data-item. */
const cards = (html: string) =>
  html
    .split(/(?=<article[^>]*data-item=)/)
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf("</article>")));

describe("built site", () => {
  beforeAll(() => {
    execSync("npx astro build", { stdio: "pipe", env: { ...process.env, BASE_PATH: "/" } });
  }, 120_000);

  it("renders every language × category page for the edition", () => {
    for (const lang of LANGS) for (const cat of CATEGORIES) expect(existsSync(`dist/${lang}/2027-v2/${cat}/index.html`)).toBe(true);
  });

  it("shows a page number next to every PDF deep link", () => {
    for (const lang of LANGS)
      for (const cat of CATEGORIES)
        for (const card of cards(page(lang, cat))) {
          const links = card.match(/\.pdf#page=\d+/g) ?? [];
          expect(links.length).toBeGreaterThan(0);
          expect(card).toMatch(lang === "de" ? /S\.(&nbsp;|\s)\d+/ : /p\.(&nbsp;|\s)\d+/);
        }
  });

  it("only shows items that apply to the category", () => {
    const dir = "src/content/items/2027-v2";
    const items = readdirSync(dir).map((f) => parse(readFileSync(`${dir}/${f}`, "utf8")) as { id: string; applies: object });
    expect(items.length).toBeGreaterThan(0);
    for (const cat of CATEGORIES) {
      const html = page("de", cat);
      for (const item of items) expect(html.includes(`data-item="${item.id}"`), `${item.id} on ${cat}`).toBe(cat in item.applies);
    }
  });

  it("has no copyright footer", () => {
    for (const lang of LANGS) {
      expect(page(lang, "osr3")).not.toContain(FOOTER[lang]);
      expect(page(lang, "osr3")).not.toContain("<footer");
    }
  });

  it("redirects from the root with a no-script fallback to every checklist", () => {
    const root = readFileSync("dist/index.html", "utf8");
    expect(root).toContain("location.replace(");
    const noscript = root.slice(root.indexOf("<noscript>"), root.indexOf("</noscript>"));
    for (const lang of LANGS) expect(noscript).toContain(`/${lang}/2027-v2/osr3/`);
  });
});
