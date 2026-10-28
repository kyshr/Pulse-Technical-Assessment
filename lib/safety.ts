import type { NSFWJS, PredictionType } from "nsfwjs/core";

// Porn + Hentai probability at which a stranger's video is blurred again.
// "Sexy" (swimwear, etc.) is left out on purpose: it's mostly false alarms.
const EXPLICIT_THRESHOLD = 0.7;

let model: Promise<NSFWJS> | null = null;

// On-device classifier, loaded on first use (~3.5 MB, bundled in the app, so
// no frame or request ever leaves the browser).
export function loadSafetyModel(): Promise<NSFWJS> {
  model ??= Promise.all([
    import("nsfwjs/core"),
    import("nsfwjs/models/mobilenet_v2"),
  ]).then(([{ load }, { MobileNetV2Model }]) =>
    load("MobileNetV2", { modelDefinitions: [MobileNetV2Model] }),
  );
  return model;
}

export function isExplicit(predictions: PredictionType[]): boolean {
  const score = predictions
    .filter((p) => p.className === "Porn" || p.className === "Hentai")
    .reduce((sum, p) => sum + p.probability, 0);
  return score >= EXPLICIT_THRESHOLD;
}
