export type PacingProfile = {
  delayMs: number;
  batchSize: number;
  cooldownMs: number;
};

export type Mode = "auto" | "turbo" | "balanced" | "safe" | "custom";

export const PRESETS = {
  turbo:    { delayMs: 100, batchSize: 0,  cooldownMs: 0    },
  balanced: { delayMs: 250, batchSize: 30, cooldownMs: 1500 },
  safe:     { delayMs: 400, batchSize: 20, cooldownMs: 3000 },
} as const satisfies Record<string, PacingProfile>;

export function resolvePacing(
  mode: Mode,
  custom?: { delayMs: number; batchSize: number },
): PacingProfile {
  switch (mode) {
    case "auto":
    case "balanced":
      return { ...PRESETS.balanced };

    case "turbo":
    case "safe":
      return { ...PRESETS[mode] };

    case "custom":
      if (!custom) return { ...PRESETS.balanced };
      return { delayMs: custom.delayMs, batchSize: custom.batchSize, cooldownMs: 0 };
  }
}
