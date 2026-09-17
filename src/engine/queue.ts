export interface Queue {
	/** Runs the task when there is room, and resolves or rejects with it. */
	add<T>(task: () => Promise<T>): Promise<T>;
}

/** Lets at most `limit` tasks be in flight at once; the rest wait their turn, in order. */
export function createQueue(limit: number): Queue {
	const waiting: (() => void)[] = [];
	let inFlight = 0;

	const next = () => {
		if (inFlight >= limit) return;
		const start = waiting.shift();
		if (start) start();
	};

	return {
		add<T>(task: () => Promise<T>) {
			return new Promise<T>((resolve, reject) => {
				waiting.push(() => {
					inFlight++;
					// A task that throws before returning a promise has to free its place too.
					new Promise<T>((started) => started(task())).then(resolve, reject).finally(() => {
						inFlight--;
						next();
					});
				});
				next();
			});
		}
	};
}
