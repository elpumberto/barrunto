import { describe, expect, it } from 'vitest';
import { createQueue } from './queue';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
};

describe('queue', () => {
	it('never has more in flight than its limit, and keeps the order', async () => {
		const queue = createQueue(2);
		const gates = [deferred(), deferred(), deferred()];
		const started: number[] = [];
		const done = gates.map((gate, i) =>
			queue.add(() => {
				started.push(i);
				return gate.promise;
			})
		);

		expect(started).toEqual([0, 1]);
		gates[0]!.resolve();
		await done[0];
		await new Promise((resolve) => setTimeout(resolve));
		expect(started).toEqual([0, 1, 2]);
		gates[1]!.resolve();
		gates[2]!.resolve();
		await Promise.all(done);
	});

	it('frees the place of a task that throws before returning a promise', async () => {
		const queue = createQueue(1);
		const thrower = (): Promise<string> => {
			throw new Error('at once');
		};
		await expect(queue.add(thrower)).rejects.toThrow('at once');
		await expect(queue.add(() => Promise.resolve('next'))).resolves.toBe('next');
	});

	it('carries on after a task fails', async () => {
		const queue = createQueue(1);
		await expect(queue.add(() => Promise.reject(new Error('no')))).rejects.toThrow('no');
		await expect(queue.add(() => Promise.resolve('yes'))).resolves.toBe('yes');
	});
});
