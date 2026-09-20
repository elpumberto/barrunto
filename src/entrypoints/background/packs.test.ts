import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { pack as hn } from '@/packs/hn';
import { pack as x } from '@/packs/x';
import { packById } from '@/packs';
import { askedFor, changePack, settings } from '@/storage';
import { keepPacksCurrent, packsOn, reachOpenTabs } from './packs';

// A made-up pack that acts on X.com's site too, next to the real ones: two packs may share a site.
vi.mock('@/packs', async () => {
	const { pack: x } = await import('@/packs/x');
	const { pack: hn } = await import('@/packs/hn');
	const packs = [x, { ...x, id: 'people', name: 'People' }, hn];
	return { packs, packById: (id: string) => packs.find((pack) => pack.id === id) };
});
const people = packById('people')!;

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

	it('turns on the pack leave was asked for when it arrives, however Chrome words it, and no other on that site', async () => {
		await askedFor.setValue({ packId: 'people', at: Date.now() });
		held = [...x.sites];
		await onAdded({ origins: ['*://x.com/*'] });
		await settle();
		const { packs: chosen } = await settings.getValue();
		expect(chosen.people?.enabled).toBe(true);
		expect(chosen.x).toBeUndefined();
		expect(chosen.hn).toBeUndefined();
		expect(registered[0]!.matches).toEqual(x.sites);
		expect(await askedFor.getValue()).toBeNull();
	});

	it('turns nothing on for leave nobody asked for, nor for a pack whose leave has not arrived', async () => {
		held = [...x.sites];
		await onAdded({ origins: ['*://x.com/*'] });
		await settle();
		expect((await settings.getValue()).packs).toEqual({});

		await askedFor.setValue({ packId: 'hn', at: Date.now() });
		await onAdded({ origins: ['*://x.com/*'] });
		await settle();
		expect((await settings.getValue()).packs).toEqual({});
		expect(registered).toEqual([]);
	});

	it('takes no heed of a note left long ago by a question nobody said yes to', async () => {
		await askedFor.setValue({ packId: 'people', at: Date.now() - 10 * 60 * 1000 });
		held = [...x.sites];
		await onAdded({ origins: ['*://x.com/*'] });
		await settle();
		expect((await settings.getValue()).packs).toEqual({});
		expect(await askedFor.getValue()).toBeNull();
	});

	it('names a site once when two packs on it are on, and keeps the script there while one of them is', async () => {
		held = [...x.sites];
		await changePack(x, () => ({ enabled: true }));
		await changePack(people, () => ({ enabled: true }));
		await settle();
		expect(registered[0]!.matches).toEqual(x.sites);
		// The page is handed the script once: the second pack finds it there already.
		expect(executeScript).toHaveBeenCalledTimes(1);

		await changePack(x, () => ({ enabled: false }));
		await settle();
		expect(registered[0]!.matches).toEqual(x.sites);
		expect((await packsOn()).map((pack) => pack.id)).toEqual(['people']);
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

	it('hands the script again to the tabs already open after an update, though the sites are the same', async () => {
		held = [...hn.sites];
		await changePack(hn, () => ({ enabled: true }));
		await settle();
		expect(executeScript).toHaveBeenCalledTimes(1);
		await reachOpenTabs();
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
