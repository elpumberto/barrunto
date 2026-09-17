import type { Judgment, Sensitivity } from '@/engine';
import { labels } from './labels';

/**
 * The same for every judgment: a strength means the same whichever recipe it comes from. They are
 * the X pack's; the weights below have had a first tuning against real threads. A short jab that
 * sneers, dismisses and jokes at once still comes out as strong as an outright insult.
 */
const thresholds: Record<Sensitivity, number> = { low: 0.6, medium: 0.42, high: 0.3, ultra: 0.2 };

const insight: Judgment = {
	id: 'insight',
	recipe: [
		{ kind: 'trait', id: 'teaches', weight: 0.5 },
		{ kind: 'trait', id: 'expertise', weight: 0.3 },
		// Having been there or naming names is not insight by itself: together they stay short of a label.
		{ kind: 'trait', id: 'firstHand', weight: 0.12 },
		{ kind: 'trait', id: 'concrete', weight: 0.08 },
		{ kind: 'signal', id: 'length', weight: 0.1 },
		{ kind: 'trait', id: 'dismissive', weight: -0.3 },
		{ kind: 'trait', id: 'quip', weight: -0.3 },
		{ kind: 'trait', id: 'meta', weight: -0.2 }
	],
	thresholds,
	label: labels.insight,
	noise: false
};

const snark: Judgment = {
	id: 'snark',
	recipe: [
		// Hostility alone is enough, as on X.com: a comment that argues and sneers is still a sneer.
		{ kind: 'trait', id: 'attacks', weight: 0.7 },
		{ kind: 'trait', id: 'dismissive', weight: 0.45 },
		{ kind: 'trait', id: 'quip', weight: 0.2 },
		{ kind: 'trait', id: 'teaches', weight: -0.3 }
	],
	thresholds,
	label: labels.snark,
	noise: true
};

const tangent: Judgment = {
	id: 'tangent',
	recipe: [
		{ kind: 'trait', id: 'meta', weight: 0.6 },
		{ kind: 'trait', id: 'offTopic', weight: 0.55 },
		{ kind: 'trait', id: 'teaches', weight: -0.2 }
	],
	thresholds,
	label: labels.tangent,
	noise: true
};

/** In the order their labels hang. */
export const judgments: Judgment[] = [insight, snark, tangent];
