import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

const MAX_BYTES = 10 * 1024;
const VIEW_BOX = "0 0 200 200";
const FORBIDDEN_ELEMENTS = new Set(["script", "text", "foreignobject", "image", "style", "iframe", "a"]);
const ATTRS = ":@";
const PREFIX = "@_";

type XmlNode = Record<string, unknown> & { [ATTRS]?: Record<string, string> };

const options = { preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: PREFIX } as const;

function check(nodes: XmlNode[]): void {
  for (const node of nodes) {
    const tag = Object.keys(node).find((k) => k !== ATTRS)!;
    if (tag === "#text" || tag === "?xml") continue;
    if (FORBIDDEN_ELEMENTS.has(tag.toLowerCase())) throw new Error(`forbidden element <${tag}>`);
    for (const [rawName, value] of Object.entries(node[ATTRS] ?? {})) {
      const name = rawName.slice(PREFIX.length).toLowerCase();
      if (name.startsWith("on")) throw new Error(`forbidden event handler ${name}`);
      if ((name === "href" || name.endsWith(":href")) && !String(value).startsWith("#")) {
        throw new Error(`external reference ${name}="${value}"`);
      }
      if (/url\(\s*['"]?(?!#)/i.test(String(value))) throw new Error(`external url() in ${name}`);
    }
    check(node[tag] as XmlNode[]);
  }
}

/** Validates an LLM-written drawing and normalises its root; throws on anything unsafe. */
export function sanitizeSvg(svg: string): string {
  const valid = XMLValidator.validate(svg);
  if (valid !== true) throw new Error(`invalid XML: ${valid.err.msg}`);

  const nodes = new XMLParser(options).parse(svg) as XmlNode[];
  const roots = nodes.filter((n) => !("?xml" in n) && !("#text" in n));
  if (roots.length !== 1 || !("svg" in roots[0])) throw new Error("root element must be <svg>");
  check(roots);

  const attrs = { ...(roots[0][ATTRS] ?? {}) };
  delete attrs[`${PREFIX}width`];
  delete attrs[`${PREFIX}height`];
  attrs[`${PREFIX}viewBox`] ??= VIEW_BOX;
  roots[0][ATTRS] = attrs;

  const out = new XMLBuilder({ ...options, suppressEmptyNode: true }).build(roots) as string;
  if (Buffer.byteLength(out) > MAX_BYTES) throw new Error(`drawing larger than ${MAX_BYTES} bytes`);
  return out;
}
