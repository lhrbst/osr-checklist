const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/** "structure": the one card-extraction request; "text": explanations and drawings. */
export type Step = "structure" | "text";

const DEFAULTS: Record<Step, { model: string; effort: Effort }> = {
  structure: { model: "gpt-6.1-sol", effort: "medium" },
  text: { model: "gpt-6-luna", effort: "low" },
};

/** Model and reasoning effort per step, overridable via OSR_MODEL_<STEP> / OSR_EFFORT_<STEP>. */
export function stepSettings(step: Step, env: Record<string, string | undefined>): { model: string; effort: Effort } {
  const suffix = step.toUpperCase();
  const model = env[`OSR_MODEL_${suffix}`] || DEFAULTS[step].model;
  const effort = env[`OSR_EFFORT_${suffix}`] || DEFAULTS[step].effort;
  if (!(EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(`OSR_EFFORT_${suffix}="${effort}" is not one of ${EFFORTS.join(", ")}`);
  }
  return { model, effort: effort as Effort };
}
