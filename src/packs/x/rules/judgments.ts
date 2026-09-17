import type { Judgment, Sensitivity } from '@/engine';
import { labels } from './labels';

/** The same for every judgment: a strength means the same whichever recipe it comes from. */
const thresholds: Record<Sensitivity, number> = { low: 0.6, medium: 0.42, high: 0.3, ultra: 0.2 };

const bait: Judgment = {
	id: 'bait',
	recipe: [
		{ kind: 'trait', id: 'asksReaction', weight: 0.5 },
		{ kind: 'trait', id: 'fishesReplies', weight: 0.5 },
		{ kind: 'trait', id: 'overpromises', weight: 0.3 },
		{ kind: 'trait', id: 'templated', weight: 0.25 },
		{ kind: 'signal', id: 'replyRatio', weight: 0.15 },
		{ kind: 'trait', id: 'teaches', weight: -0.3 }
	],
	thresholds,
	label: labels.bait
};

const flame: Judgment = {
	id: 'flame',
	recipe: [
		{ kind: 'trait', id: 'attacks', weight: 0.7 },
		{ kind: 'signal', id: 'replyRatio', weight: 0.35 }
	],
	thresholds,
	label: labels.flame
};

const signal: Judgment = {
	id: 'signal',
	recipe: [
		{ kind: 'trait', id: 'teaches', weight: 0.5 },
		{ kind: 'trait', id: 'concrete', weight: 0.2 },
		{ kind: 'signal', id: 'length', weight: 0.15 },
		{ kind: 'trait', id: 'firstHand', weight: 0.1 },
		{ kind: 'trait', id: 'careful', weight: 0.1 },
		{ kind: 'trait', id: 'templated', weight: -0.3 },
		{ kind: 'trait', id: 'fishesReplies', weight: -0.3 },
		{ kind: 'trait', id: 'asksReaction', weight: -0.25 }
	],
	thresholds,
	label: labels.signal
};

/** In the order their labels hang. */
export const judgments: Judgment[] = [bait, flame, signal];
