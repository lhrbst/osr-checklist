import { createHash } from "node:crypto";

/** Fingerprint of an inspection-card line; the wording itself is never stored. */
export function cardHash(line: string): string {
  const normalised = line
    .toLowerCase()
    .replace(/\b\d+\.\d+(\.\d+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `sha256:${createHash("sha256").update(normalised).digest("hex")}`;
}
