import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { parse } from "yaml";
import { CATEGORIES, type Category } from "../../src/lib/categories";
import { previousEdition } from "../../src/lib/editions";
import { editionSchema, itemSchema, type Item } from "../../src/lib/schemas";
import { extractStructure, generateDrawing, generateExplanations } from "./llm";
import { pdfPages } from "./pdftext";
import { loadEditionSource } from "./sources";
import { runPipeline } from "./pipeline";
import { prSummary, writeEdition } from "./write";

const ROOT = process.cwd();
const CONTENT = join(ROOT, "src/content");

const { values: args } = parseArgs({
  options: {
    edition: { type: "string" },
    sources: { type: "string", default: "editions.sources.yaml" },
    "summary-out": { type: "string" },
  },
});

function required(name: keyof typeof args): string {
  const value = args[name];
  if (typeof value !== "string" || value === "") throw new Error(`missing --${name}`);
  return value;
}

const yamlFiles = async (dir: string) =>
  (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".yaml")).map((f) => join(dir, f));

async function main() {
  const edition = loadEditionSource(join(ROOT, args.sources!), required("edition"));

  const known = await Promise.all(
    (await yamlFiles(join(CONTENT, "editions"))).map(async (f) => editionSchema.parse(parse(await readFile(f, "utf8")))),
  );
  const others = known.filter((e) => e.id !== edition.id);
  const previousId = previousEdition([...others, edition], edition.id);
  const previousItems: Item[] = previousId
    ? await Promise.all(
        (await yamlFiles(join(CONTENT, "items", previousId))).map(async (f) => itemSchema.parse(parse(await readFile(f, "utf8")))),
      )
    : [];
  console.log(`edition ${edition.id}; carrying over from ${previousId ?? "nothing"} (${previousItems.length} items)`);

  const work = join(tmpdir(), `osr-${edition.id}`);
  await mkdir(work, { recursive: true });
  const pdfs = {} as Record<Category, Buffer>;
  const pagesByCat = {} as Record<Category, string[]>;
  for (const category of CATEGORIES) {
    const response = await fetch(edition.pdfs[category]);
    if (!response.ok) throw new Error(`download ${category}: HTTP ${response.status}`);
    pdfs[category] = Buffer.from(await response.arrayBuffer());
    const path = join(work, `${category}.pdf`);
    await writeFile(path, pdfs[category]);
    pagesByCat[category] = await pdfPages(path);
    console.log(`${category}: ${pagesByCat[category].length} pages`);
  }

  const client = new OpenAI();
  const existingDrawings = new Set(
    (await readdir(join(CONTENT, "drawings"))).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -".svg".length)),
  );
  const result = await runPipeline(
    { edition, pdfs, pagesByCat, previousItems },
    {
      extractStructure: (p, prev) => extractStructure(client, p, prev),
      generateExplanations: (item, text) => generateExplanations(client, item, text),
      generateDrawing: (item) => generateDrawing(client, item),
      existingDrawings,
      log: (line) => console.log(line),
    },
  );

  await writeEdition(ROOT, result);
  const summary = prSummary(result, edition.id);
  if (args["summary-out"]) await writeFile(args["summary-out"], summary);
  console.log(summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
