import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { strengthsFor } from '@/engine';
import type { Answers } from '@/engine';
import { send } from '@/messages';
import type { Analysis } from '@/messages';
import { pack as jetective } from '@/packs/jetective';
import type { Profile } from '@/packs/jetective';
import { answersFor } from '@/packs/jetective/rules/made-up';
import { page as profilePage } from '@/packs/jetective/page';
import { forgetPosts } from '@/packs/jetective/page/read';
import { connection, pageSettings } from '@/storage/session';
import { defaultSettings } from '@/storage/types';
import type { Settings } from '@/storage/types';
import { LONGEST_WAIT_MS, QUIET_MS, watchCards } from './cards';

vi.mock('@/messages', () => ({ send: vi.fn() }));

let ctx: ContentScriptContext;
const watch = () => watchCards(ctx, jetective, profilePage);
const chosen = (change: Partial<Settings> = {}): Settings => ({
	...defaultSettings,
	packs: { jetective: { enabled: true, sensitivity: 'medium', treatments: {} } },
	...change
});

/** So that no two made-up posts say the same. */
const ABOUT = [
	'rain',
	'bread',
	'trains',
	'chess',
	'maps',
	'bees',
	'paint',
	'tides',
	'knots',
	'owls'
];
const post = (handle: string, words: string, day: number) =>
	`<article data-testid="tweet"><div data-testid="User-Name"><a href="/${handle}"><span>Made Up</span></a>
		<a href="/${handle}/status/${1000 + day}"><time datetime="2026-01-${10 + day}T10:00:00.000Z">1d</time></a></div>
		<div data-testid="tweetText"><span>${words}</span></div></article>`;
/** A profile as X.com lays it out: the header, the tabs after it, and the posts, which come later. */
const profile = (handle: string, posts = 0) =>
	`<div data-testid="primaryColumn"><div id="parent">
		<div id="header"><div><div data-testid="UserName"><div dir="ltr"><span><span>Made Up</span></span></div>
			<div><span>@${handle}</span></div></div></div></div>
		<div><nav><a role="tab" href="/${handle}/with_replies"></a></nav></div>
		<section id="posts">${Array.from({ length: posts }, (_, n) => post(handle, `Made-up words about ${ABOUT[n]}.`, n)).join('')}</section>
	</div></div>`;
const goTo = (path: string, html: string) => {
	window.history.pushState({}, '', path);
	document.body.innerHTML = html;
};
const addPosts = (handle: string, count: number) =>
	document
		.querySelector('#posts')!
		.insertAdjacentHTML(
			'beforeend',
			Array.from({ length: count }, (_, n) =>
				post(handle, `More words about ${ABOUT[9 - n]}.`, 9 - n)
			).join('')
		);

const file = () => document.querySelector('#header > [data-barrunto="card"]')?.shadowRoot ?? null;
const charges = () =>
	[...(file()?.querySelectorAll<HTMLElement>('.charge') ?? [])].map((charge) => charge.dataset.id);
const said = () => file()?.querySelector('.sheet')?.textContent ?? '';
/** Whose file it is, as its sheet says. */
const whose = () =>
	[...(file()?.querySelectorAll('.facts dd') ?? [])].find((fact) =>
		fact.textContent?.startsWith('@')
	)?.textContent;

/**
 * What Jev might answer about whatever profile the page sends: of its posts, so many of each kind;
 * with the strengths the background would work out from it.
 */
const answering = (kinds: Parameters<typeof answersFor>[1], given: Answers = {}) =>
	(async ({ item }: { item: Profile }): Promise<Analysis> => {
		const answers = answersFor(item, kinds, given);
		return { analyzed: true, answers, strengths: strengthsFor(jetective.rules, answers, item) };
	}) as unknown as typeof send;
/** Clear enough to show with few posts on the page, which hold every such judgment back. */
const SCAM = answering({ money: 30 }, { asksPrivate: 0.9, pressures: 0.9 });
const NOTHING = answering({});

beforeEach(async () => {
	fakeBrowser.reset();
	forgetPosts();
	vi.useFakeTimers();
	vi.mocked(send).mockReset();
	ctx = { isInvalid: false, onInvalidated: vi.fn() } as unknown as ContentScriptContext;
	await connection.setValue({ state: 'connected' });
	await pageSettings.setValue(chosen());
});
afterEach(() => {
	// What watched the page of one test lets go of it before the next.
	(ctx as { isInvalid: boolean }).isInvalid = true;
	vi.useRealTimers();
	window.history.pushState({}, '', '/');
});

describe('watching for a profile', () => {
	it('asks once about a profile with a few posts on it, and shows the file over the tabs', async () => {
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(50);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				packId: 'jetective',
				urgent: true,
				item: expect.objectContaining({ handle: 'ada_nobody', name: 'Made Up' })
			})
		);
		expect(charges()).toEqual(['scam']);
		expect(whose()).toBe('@ada_nobody');
		expect(file()!.querySelector('.tab span')!.textContent).toMatch(/^Case Nº JJ-[0-9A-F]{6}$/);
		expect(file()!.querySelector('.stamp')!.textContent).toBe('Hunch');
		expect(said()).toContain('Looks like a scam');
		expect(said()).toContain('6 of 6 posts promise money');
		expect(said()).toContain('not a verdict');

		addPosts('ada_nobody', 3);
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS * 2);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('waits for the posts, which come after the header, and asks with what there is once the page settles', async () => {
		vi.mocked(send).mockImplementation(NOTHING);
		goTo('/ada_nobody', profile('ada_nobody', 0));
		await watch();
		await vi.advanceTimersByTimeAsync(QUIET_MS - 500);
		addPosts('ada_nobody', 2);
		await vi.advanceTimersByTimeAsync(QUIET_MS - 500);
		expect(send).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(QUIET_MS);
		expect(send).toHaveBeenCalledTimes(1);
		const [{ item }] = vi.mocked(send).mock.calls[0] as unknown as [{ item: { posts: unknown[] } }];
		expect(item.posts).toHaveLength(2);
		expect(charges()).toEqual([]);
		expect(said()).toContain('Nothing clear on this account');
	});

	it('does not wait for ever on a page that never stops changing', async () => {
		vi.mocked(send).mockImplementation(NOTHING);
		goTo('/ada_nobody', profile('ada_nobody', 1));
		await watch();
		for (let waited = 0; waited < LONGEST_WAIT_MS + 1000; waited += 500) {
			document.body.append(document.createElement('i'));
			await vi.advanceTimersByTimeAsync(500);
		}
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('asks nothing about an account with nothing to go by, and says why only in tuning mode', async () => {
		await pageSettings.setValue(chosen({ tuning: true }));
		goTo('/ada_nobody', profile('ada_nobody', 0));
		await watch();
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS * 2);
		expect(send).not.toHaveBeenCalled();
		expect(file()).toBeNull();
		const tuning = document.querySelector('#header > [data-barrunto="tuning"]')!.shadowRoot!;
		expect(tuning.textContent).toContain('too little to tell');
	});

	it('leaves alone every page that is no profile', async () => {
		goTo('/home', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS * 2);
		goTo('/ada_nobody/status/1', profile('ada_nobody', 6));
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS * 2);
		expect(send).not.toHaveBeenCalled();
		expect(document.querySelector('[data-barrunto]')).toBeNull();
	});

	it('follows the user from one profile to another with no page loaded, and back to none', async () => {
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/home', '<div data-testid="primaryColumn"></div>');
		await watch();
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).not.toHaveBeenCalled();

		// The address changes first, and for a moment the page still shows the profile before.
		goTo('/bob_noone', profile('ada_nobody', 6));
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).not.toHaveBeenCalled();
		document.body.innerHTML = profile('bob_noone', 6);
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).toHaveBeenCalledTimes(1);
		expect(whose()).toBe('@bob_noone');

		// Its tabs are the same profile: nothing is asked again.
		window.history.pushState({}, '', '/bob_noone/with_replies');
		addPosts('bob_noone', 2);
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS);
		expect(send).toHaveBeenCalledTimes(1);
		expect(file()).not.toBeNull();

		// X.com may keep the header's element for the next page: the file goes with the profile.
		window.history.pushState({}, '', '/home');
		document.body.append(document.createElement('i'));
		await vi.advanceTimersByTimeAsync(1000);
		expect(file()).toBeNull();
	});

	it('takes another look each time the user has gone further down the profile and it has shown a good few more posts, until Jev has all it is ever shown', async () => {
		vi.mocked(send).mockImplementationOnce(NOTHING);
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(said()).toContain('Nothing clear on this account');

		// As X.com does on the way down: the posts that were there go, and others come.
		const further = (from: number) => {
			document.querySelector('#posts')!.innerHTML = Array.from({ length: 8 }, (_, n) =>
				post(
					'ada_nobody',
					`Words further down about ${ABOUT[(from + n) % 10]}, ${from + n}.`,
					from + n
				)
			).join('');
		};
		const askedAbout = (call: number) =>
			(vi.mocked(send).mock.calls[call]![0] as unknown as { item: Profile }).item;
		further(10);
		await vi.advanceTimersByTimeAsync(400);
		// A good few more posts than were asked about: worth another look.
		expect(send).toHaveBeenCalledTimes(2);
		expect(askedAbout(1).posts).toHaveLength(14);
		expect(askedAbout(1).id).not.toBe(askedAbout(0).id);
		await vi.advanceTimersByTimeAsync(600);
		expect(charges()).toEqual(['scam']);
		expect(said()).toContain('14 posts');

		// A couple more are not.
		further(12);
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS);
		expect(send).toHaveBeenCalledTimes(2);
		further(18);
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).toHaveBeenCalledTimes(3);
		expect(askedAbout(2).posts).toHaveLength(22);
		further(26);
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).toHaveBeenCalledTimes(4);
		expect(askedAbout(3).posts).toHaveLength(30);

		// By then Jev has been shown as many as it ever is.
		further(40);
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS);
		expect(send).toHaveBeenCalledTimes(4);
	});

	it('leaves the file as it is while the page changes around it and it has nothing new to say', async () => {
		await pageSettings.setValue(chosen({ tuning: true }));
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		const sheet = file()!.querySelector('.file');
		const detail = document.querySelector('#header > [data-barrunto="tuning"]')!.shadowRoot!;
		const box = detail.querySelector('.box');

		for (let n = 0; n < 3; n++) {
			document.body.append(document.createElement('i'));
			await vi.advanceTimersByTimeAsync(500);
		}
		expect(file()!.querySelector('.file')).toBe(sheet);
		expect(detail.querySelector('.box')).toBe(box);

		// A change of sensitivity is something new to say.
		const low = { enabled: true, sensitivity: 'low' as const, treatments: {} };
		await pageSettings.setValue(chosen({ tuning: true, packs: { jetective: low } }));
		await vi.advanceTimersByTimeAsync(100);
		expect(file()!.querySelector('.file')).not.toBe(sheet);
	});

	it('does not try a look that failed again with every post the page shows next', async () => {
		vi.mocked(send).mockImplementationOnce(SCAM);
		vi.mocked(send).mockResolvedValue({ analyzed: false, reason: 'tooManyCalls' });
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		const more = Array.from({ length: 6 }, (_, n) =>
			post('ada_nobody', `Words further down, ${n}.`, 10 + n)
		);
		document.querySelector('#posts')!.insertAdjacentHTML('beforeend', more.join(''));
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).toHaveBeenCalledTimes(2);
		for (let n = 0; n < 3; n++) {
			document
				.querySelector('#posts')!
				.insertAdjacentHTML('beforeend', post('ada_nobody', `One more, ${n}.`, 20 + n));
			await vi.advanceTimersByTimeAsync(1000);
		}
		expect(send).toHaveBeenCalledTimes(2);
		expect(charges()).toEqual(['scam']);
	});

	it('asks again about what was turned down for something that no longer holds, as a pause lifted while the call waited', async () => {
		vi.mocked(send).mockResolvedValueOnce({ analyzed: false, reason: 'paused' });
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(send).toHaveBeenCalledTimes(2);
		expect(charges()).toEqual(['scam']);
	});

	it('does not go on asking about what is turned down every time', async () => {
		await pageSettings.setValue(chosen({ tuning: true }));
		vi.mocked(send).mockResolvedValue({ analyzed: false, reason: 'packOff' });
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS);
		expect(vi.mocked(send).mock.calls.length).toBeLessThanOrEqual(6);
		expect(file()).toBeNull();
		const detail = document.querySelector('#header > [data-barrunto="tuning"]')!.shadowRoot!;
		expect(detail.textContent).toContain('not analyzed: packOff');
	});

	it('keeps what it said when another look comes to nothing', async () => {
		vi.mocked(send).mockImplementationOnce(SCAM);
		vi.mocked(send).mockResolvedValue({ analyzed: false, reason: 'serviceDown' });
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		document.querySelector('#posts')!.innerHTML = Array.from({ length: 20 }, (_, n) =>
			post('ada_nobody', `Words further down, ${n}.`, 10 + n)
		).join('');
		await vi.advanceTimersByTimeAsync(2000);
		expect(send).toHaveBeenCalledTimes(2);
		expect(charges()).toEqual(['scam']);
	});

	it('says nothing of a profile the user has left by the time Jev answers', async () => {
		let answer!: (analysis: Analysis) => void;
		vi.mocked(send).mockReturnValue(new Promise((resolve) => (answer = resolve)));
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(said()).toContain('is on the case');
		expect(file()!.querySelector('.stamp')!.textContent).toBe('Under inquiry');

		goTo('/home', '<div data-testid="primaryColumn"><div id="header"></div></div>');
		await vi.advanceTimersByTimeAsync(500);
		answer({ analyzed: true, answers: {}, strengths: {} });
		await vi.advanceTimersByTimeAsync(500);
		expect(document.querySelector('[data-barrunto]')).toBeNull();
	});

	it('puts the file back when the page draws its header again without it', async () => {
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		file()!.host.remove();
		document.body.append(document.createElement('i'));
		await vi.advanceTimersByTimeAsync(1000);
		expect(charges()).toEqual(['scam']);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('shows what clears the sensitivity the user has chosen, asking nothing again', async () => {
		const given = { asksPrivate: 0.9, pressures: 0.9, sameTemplate: 0.95, readsGenerated: 0.9 };
		vi.mocked(send).mockImplementation(answering({ money: 4, stock: 2 }, given));
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(charges()).toEqual(['scam']);

		const ultra = { enabled: true, sensitivity: 'ultra' as const, treatments: {} };
		await pageSettings.setValue(chosen({ packs: { jetective: ultra } }));
		await vi.advanceTimersByTimeAsync(100);
		expect(charges()).toEqual(['scam', 'automated']);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('takes the file away while its pack is off or Barrunto is paused, and asks nothing', async () => {
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(file()).not.toBeNull();

		await pageSettings.setValue(chosen({ packs: {} }));
		await vi.advanceTimersByTimeAsync(100);
		expect(file()).toBeNull();
		goTo('/bob_noone', profile('bob_noone', 6));
		await vi.advanceTimersByTimeAsync(LONGEST_WAIT_MS);
		expect(send).toHaveBeenCalledTimes(1);

		await pageSettings.setValue(chosen());
		await vi.advanceTimersByTimeAsync(500);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it('says that it could not look into it when Jev fails, and tries again once Jev recovers', async () => {
		vi.mocked(send).mockResolvedValueOnce({ analyzed: false, reason: 'serviceDown' });
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		expect(said()).toContain('Not looked into: service down.');

		await connection.setValue({ state: 'trouble', reason: 'serviceDown' });
		await connection.setValue({ state: 'connected' });
		await vi.advanceTimersByTimeAsync(500);
		expect(send).toHaveBeenCalledTimes(2);
		expect(charges()).toEqual(['scam']);
	});

	it('puts the tuning detail under the file', async () => {
		await pageSettings.setValue(chosen({ tuning: true }));
		vi.mocked(send).mockImplementation(SCAM);
		goTo('/ada_nobody', profile('ada_nobody', 6));
		await watch();
		await vi.advanceTimersByTimeAsync(500);
		const ours = [...document.querySelectorAll('#header > [data-barrunto]')];
		expect(ours.map((node) => node.getAttribute('data-barrunto'))).toEqual(['card', 'tuning']);
	});
});
