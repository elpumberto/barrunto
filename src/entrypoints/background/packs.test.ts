import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { pack as hn } from '@/packs/hn';
import { pack as x } from '@/packs/x';
import { changePack, settings } from '@/storage';
import { keepPacksCurrent, packsOn } from './packs';

/** Chrome's side of it, worked by hand: the leave held, the script registered, the tabs open. */
let held: string[];
let registered: { id: string; matches: string[] }[];
let onAdded: (permissions: { origins?: string[] }) => unknown;
let onRemoved: () => unknown;
const executeScript = vi.fn(async () => []);
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(async () => {
	fakeBrowser.reset();
	held = [];
	registered = [];
	executeScript.mockClear();
	Object.assign(browser, {
		permissions: {
			contains: async ({ origins = [] }: { origins?: string[] }) =>
				origins.every((origin) => held.includes(origin)),
			onAdded: { addListener: (listener: typeof onAdded) => (onAdded = listener) },
			onRemoved: { addListener: (listener: typeof onRemoved) => (onRemoved = listener) }
		},
		scripting: {
			getRegisteredContentScripts: async () => registered,
			registerContentScripts: async (scripts: typeof registered) => void (registered = scripts),
			updateContentScripts: async (scripts: typeof registered) => void (registered = scripts),
			unregisterContentScripts: async () => void (registered = []),
			executeScript
		},
		tabs: { query: async () => [{ id: 7 }] }
	});
	keepPacksCurrent();
	await settle();
});

describe('keeping the packs current', () => {
	it('has the script run only on the sites of packs that are on, and hands it to tabs already open', async () => {
		expect(registered).toEqual([]);
		held = [...hn.sites];
		await changePack(hn, () => ({ enabled: true }));
		await settle();
		expect(registered[0]!.matches).toEqual(hn.sites);
		expect(executeScript).toHaveBeenCalledTimes(1);

		await changePack(hn, () => ({ enabled: false }));
		await settle();
		expect(registered).toEqual([]);
	});

	it('turns a pack on when leave for its sites arrives, whoever asked for it and however Chrome words it', async () => {
		held = [...x.sites];
		await onAdded({ origins: ['*://x.com/*'] });
		await settle();
		expect((await settings.getValue()).packs.x?.enabled).toBe(true);
		expect(registered[0]!.matches).toEqual(x.sites);
		expect((await settings.getValue()).packs.hn).toBeUndefined();
	});

	it('takes a pack with no leave for off, and leaves what the user asked for as it is', async () => {
		await changePack(x, () => ({ enabled: true }));
		await settle();
		expect(registered).toEqual([]);
		expect(await packsOn()).toEqual([]);
		expect((await settings.getValue()).packs.x?.enabled).toBe(true);
	});

	it('takes the script off a site when leave for it is taken back, and puts it back when it returns', async () => {
		held = [...x.sites, ...hn.sites];
		await changePack(x, () => ({ enabled: true }));
		await changePack(hn, () => ({ enabled: true }));
		await settle();
		expect([...registered[0]!.matches].sort()).toEqual([...x.sites, ...hn.sites].sort());
		expect(executeScript).toHaveBeenCalledTimes(2);

		held = [...hn.sites];
		await onRemoved();
		await settle();
		expect(registered[0]!.matches).toEqual(hn.sites);
		expect(executeScript).toHaveBeenCalledTimes(2);
	});

	it('holds nothing else up for a tab that never takes the script', async () => {
		executeScript.mockReturnValue(new Promise(() => {}));
		held = [...hn.sites];
		await changePack(hn, () => ({ enabled: true }));
		await settle();
		await changePack(hn, () => ({ enabled: false }));
		await settle();
		expect(registered).toEqual([]);
	});
});
