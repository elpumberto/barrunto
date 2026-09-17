import type { Usage } from '@/engine';
import { inTurn } from './in-turn';
import { noCounters, totalCounters } from './local';
import { sessionCounters } from './session';

/** Adds one analyzed item and what it cost to the session and total counters. */
export function countItem(usage: Usage): Promise<void> {
	return inTurn(async () => {
		for (const item of [sessionCounters, totalCounters]) {
			const now = await item.getValue();
			await item.setValue({
				items: now.items + 1,
				tokensIn: now.tokensIn + usage.tokensIn,
				tokensOut: now.tokensOut + usage.tokensOut
			});
		}
	});
}

export function resetCounters(): Promise<void> {
	return inTurn(async () => {
		await sessionCounters.setValue(noCounters);
		await totalCounters.setValue(noCounters);
	});
}
