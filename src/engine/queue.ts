export interface Queue {
	/**
	 * Runs the task when there is room, and resolves or rejects with it. An urgent task goes ahead of
	 * the ones that are not; among its kind, each waits its turn. `name` is what `hurry` finds it by.
	 */
	add<T>(task: () => Promise<T>, turn?: { name?: string; urgent?: boolean }): Promise<T>;
	/** Makes urgent a task that was not, if it is still waiting: it goes behind the urgent ones already there. */
	hurry(name: string): void;
}

interface Waiting {
	name?: string;
	urgent: boolean;
	start(): void;
}

/** Lets at most `limit` tasks be in flight at once; the rest wait, the urgent ones first, each kind in order. */
export function createQueue(limit: number): Queue {
	const waiting: Waiting[] = [];
	let inFlight = 0;

	const next = () => {
		if (inFlight >= limit) return;
		const urgent = waiting.findIndex((w) => w.urgent);
		const [turn] = waiting.splice(Math.max(urgent, 0), 1);
		turn?.start();
	};

	return {
		add<T>(task: () => Promise<T>, turn: { name?: string; urgent?: boolean } = {}) {
			const { name, urgent = true } = turn;
			return new Promise<T>((resolve, reject) => {
				const start = () => {
					inFlight++;
					// A task that throws before returning a promise has to free its place too.
					new Promise<T>((started) => started(task())).then(resolve, reject).finally(() => {
						inFlight--;
						next();
					});
				};
				waiting.push({ name, urgent, start });
				next();
			});
		},

		hurry(name) {
			const at = waiting.findIndex((w) => w.name === name && !w.urgent);
			if (at < 0) return;
			// To the end of the line, as the last to have become urgent.
			const [turn] = waiting.splice(at, 1);
			waiting.push({ ...turn!, urgent: true });
		}
	};
}
