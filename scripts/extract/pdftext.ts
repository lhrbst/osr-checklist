import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Text of each PDF page (index 0 = page 1), via poppler's pdftotext. */
export async function pdfPages(pdfPath: string): Promise<string[]> {
  const { stdout } = await run("pdftotext", ["-layout", pdfPath, "-"], { maxBuffer: 64 * 1024 * 1024 });
  const pages = stdout.split("\f");
  if (pages.at(-1)?.trim() === "") pages.pop();
  return pages;
}
