import { describe, expect, it } from "vitest";
import { stepSettings } from "../../scripts/extract/settings";

describe("stepSettings", () => {
  it("defaults to Sol at medium effort for the structure", () => {
    expect(stepSettings("structure", {})).toEqual({ model: "gpt-6.1-sol", effort: "medium" });
  });

  it("defaults to Luna at low effort for explanations and drawings", () => {
    expect(stepSettings("text", {})).toEqual({ model: "gpt-6-luna", effort: "low" });
  });

  it("takes model and effort from the environment", () => {
    const env = { OSR_MODEL_TEXT: "gpt-6.1-sol", OSR_EFFORT_TEXT: "medium" };
    expect(stepSettings("text", env)).toEqual({ model: "gpt-6.1-sol", effort: "medium" });
  });

  it("ignores empty variables, as GitHub passes unset vars as empty strings", () => {
    expect(stepSettings("structure", { OSR_MODEL_STRUCTURE: "", OSR_EFFORT_STRUCTURE: "" })).toEqual({
      model: "gpt-6.1-sol",
      effort: "medium",
    });
  });

  it("rejects an unknown effort", () => {
    expect(() => stepSettings("text", { OSR_EFFORT_TEXT: "extreme" })).toThrow(/OSR_EFFORT_TEXT/);
  });
});
