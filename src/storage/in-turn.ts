/** One write at a time: reading, changing and writing back must not interleave. */
let last: Promise<unknown> = Promise.resolve();

export function inTurn<T>(write: () => Promise<T>): Promise<T> {
	const mine = last.then(write, write);
	last = mine.catch(() => {});
	return mine;
}
