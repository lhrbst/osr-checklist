import { createHash } from "node:crypto";

/** Fingerprint of regulation text, insensitive to layout whitespace. */
export function textHash(text: string): string {
  return `sha256:${createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex")}`;
}

/** Fingerprint of an inspection-card line; the wording itself is never stored. */
export function cardHash(line: string): string {
  const normalised = line
    .toLowerCase()
    .replace(/\b\d+\.\d+(\.\d+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `sha256:${createHash("sha256").update(normalised).digest("hex")}`;
}
