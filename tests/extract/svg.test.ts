import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../../scripts/extract/svg";

const NS = 'xmlns="http://www.w3.org/2000/svg"';

describe("sanitizeSvg", () => {
  it.each([
    ["a script element", `<svg ${NS}><script>alert(1)</script></svg>`],
    ["an event handler", `<svg ${NS} onload="alert(1)"/>`],
    ["an external href", `<svg ${NS}><use href="https://evil.example/x.svg#a"/></svg>`],
    ["an external xlink:href", `<svg ${NS}><use xlink:href="//evil.example/x"/></svg>`],
    ["a text element", `<svg ${NS}><text>Hi</text></svg>`],
    ["a foreignObject", `<svg ${NS}><foreignObject/></svg>`],
    ["an image element", `<svg ${NS}><image href="#a"/></svg>`],
    ["broken XML", `<svg ${NS}><path d="M0 0">`],
    ["a non-svg root", "<div/>"],
    ["an oversized drawing", `<svg ${NS}>${'<path d="M0 0L10 10"/>'.repeat(600)}</svg>`],
  ])("rejects %s", (_, svg) => {
    expect(() => sanitizeSvg(svg)).toThrow();
  });

  it("strips fixed width and height so the drawing scales", () => {
    const out = sanitizeSvg(
      `<svg ${NS} width="200" height="200" viewBox="0 0 200 200"><path d="M0 0L10 10" stroke="currentColor"/></svg>`,
    );
    expect(out).not.toMatch(/\swidth=/);
    expect(out).not.toMatch(/\sheight=/);
    expect(out).toContain('stroke="currentColor"');
  });

  it("adds the standard viewBox when missing", () => {
    expect(sanitizeSvg(`<svg ${NS}><circle cx="5" cy="5" r="4"/></svg>`)).toContain('viewBox="0 0 200 200"');
  });

  it("allows in-document references", () => {
    expect(() => sanitizeSvg(`<svg ${NS}><defs><path id="a" d="M0 0"/></defs><use href="#a"/></svg>`)).not.toThrow();
  });
});
