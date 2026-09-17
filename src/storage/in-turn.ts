/**
 * One at a time: reading, changing and writing back must not interleave. Each thing that is written
 * that way has its own turns, so that a slow write of one never holds up the others.
 */
export function takingTurns() {
	let last: Promise<unknown> = Promise.resolve();
	return function inTurn<T>(write: () => Promise<T>): Promise<T> {
		const mine = last.then(write, write);
		last = mine.catch(() => {});
		return mine;
	};
}
