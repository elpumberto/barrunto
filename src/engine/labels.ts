import { DEFAULT_TREATMENT, SENSITIVITIES } from './types';
import type { Judgment, Sensitivity, Strengths, Treatment } from './types';

/** Whether a strength is enough for the judgment's label at this sensitivity. Reaching the threshold clears it. */
export const clears = (judgment: Judgment, strength: number, sensitivity: Sensitivity) =>
	strength >= judgment.thresholds[sensitivity];

/** The lowest sensitivity at which a strength gets the judgment's label, if it does at any. */
export const labelledFrom = (judgment: Judgment, strength: number): Sensitivity | null =>
	SENSITIVITIES.find((sensitivity) => clears(judgment, strength, sensitivity)) ?? null;

/** The judgments whose strength clears their threshold at this sensitivity, in the pack's order. */
export function labelsFor(
	judgments: Judgment[],
	strengths: Strengths,
	sensitivity: Sensitivity
): Judgment[] {
	return judgments.filter((j) => clears(j, strengths[j.id] ?? 0, sensitivity));
}

/**
 * What is done to an item with these labels: the most the user asks for among them, hiding before
 * fading. When labels pull apart, as Bait and Signal on one post do, the strictest wins: what the
 * user would rather not see is not let through for what else it may be.
 */
export function treatmentFor(
	labelled: Judgment[],
	treatments: Record<string, Treatment>
): Treatment {
	const asked = labelled.filter((j) => j.noise).map((j) => treatments[j.id] ?? DEFAULT_TREATMENT);
	return asked.includes('hide') ? 'hide' : asked.includes('fade') ? 'fade' : 'label';
}
