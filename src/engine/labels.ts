import type { Judgment, Sensitivity, Strengths } from './types';

/** Whether a strength is enough for the judgment's label at this sensitivity. Reaching the threshold clears it. */
export const clears = (judgment: Judgment, strength: number, sensitivity: Sensitivity) =>
	strength >= judgment.thresholds[sensitivity];

/** The judgments whose strength clears their threshold at this sensitivity, in the pack's order. */
export function labelsFor(
	judgments: Judgment[],
	strengths: Strengths,
	sensitivity: Sensitivity
): Judgment[] {
	return judgments.filter((j) => clears(j, strengths[j.id] ?? 0, sensitivity));
}
