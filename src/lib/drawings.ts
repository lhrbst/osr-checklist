const files = import.meta.glob<string>("/src/content/drawings/*.svg", { query: "?raw", import: "default", eager: true });

/** Drawing id (file name without .svg) → SVG markup. */
export const drawings: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.slice(path.lastIndexOf("/") + 1, -".svg".length), svg]),
);
