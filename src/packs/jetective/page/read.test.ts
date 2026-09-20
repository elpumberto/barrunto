import { beforeEach, describe, expect, it } from 'vitest';
import { page } from '.';
import { cardAnchor, forgetPosts, readProfile } from './read';

/** A profile page laid out as X.com's real one, with everyone and everything in it made up. */
const samples = import.meta.glob<string>('./samples/*.html', {
	query: '?raw',
	import: 'default',
	eager: true
});
const profile = samples['./samples/profile.html']!;

beforeEach(forgetPosts);

const read = (html: string, subject = 'ada_nobody') => {
	document.documentElement.innerHTML = html;
	return readProfile(document, subject);
};

describe('readProfile, on a sample of the real page', () => {
	it("takes the handle, the name without its badges, the bio and the account's own posts with words", () => {
		const reading = read(profile);
		expect(reading).toMatchObject({
			item: {
				handle: 'ada_nobody',
				name: 'Ada Nobody 🔭',
				bio: 'Made-up words of a bio. http://example.com',
				posts: [
					{
						text: 'Made-up words of a pinned post.',
						at: '2025-11-02T09:00:00.000Z',
						pinned: true,
						hasLink: false
					},
					{ text: 'Made-up words of a post, the first.', pinned: false },
					{ text: 'Made-up words of a post that quotes another.', at: '2026-01-04T18:30:00.000Z' },
					{ text: 'Made-up words of a reply 🙂', at: '2026-01-03T12:40:00.000Z', pinned: false }
				]
			}
		});
	});

	it('takes when the account was opened and its counts from the data about this handle, not from the first there is', () => {
		expect(read(profile)).toMatchObject({
			item: {
				created: '2019-03-09T16:20:00.000Z',
				followers: 6522,
				following: 302,
				postCount: 1306
			}
		});
	});

	it('does without the data where the page has none, or none that makes sense', () => {
		const none = { created: null, followers: null, following: null, postCount: null };
		expect(read(profile.replace(/<script[\s\S]*?<\/script>/g, ''))).toMatchObject({ item: none });
		expect(read(profile.replace(/"dateCreated": "2019[^"]*"/, '"dateCreated": {'))).toMatchObject({
			item: none
		});
		expect(read(profile.replace('"2019-03-09T16:20:00.000Z"', '"soon"'))).toMatchObject({
			item: { created: null, followers: 6522 }
		});
	});

	it('says when it was read', () => {
		const reading = read(profile);
		const readAt = reading && 'item' in reading ? Date.parse(reading.item.readAt) : NaN;
		expect(Math.abs(Date.now() - readAt)).toBeLessThan(5000);
	});

	it('reads nothing while the page still shows another account than the address names', () => {
		expect(read(profile, 'bob_noone')).toBeNull();
		expect(read('<main><div data-testid="primaryColumn"></div></main>')).toBeNull();
	});

	it("reads an account whose name is made to look like a handle, another account's too", () => {
		const posing = profile.replace('<span><span>Ada Nobody <img', '<span><span>@bob_noone <img');
		expect(read(posing)).toMatchObject({ item: { handle: 'ada_nobody', name: '@bob_noone 🔭' } });
		expect(read(posing, 'bob_noone')).toBeNull();
	});

	it("reads the user's own profile as any other", () => {
		const mine = profile.replace('href="/dan_nothing"', 'href="https://x.com/Ada_Nobody"');
		expect(read(mine)).toMatchObject({ item: { handle: 'ada_nobody' } });
	});

	it('skips a protected account, and one that is not there', () => {
		const locked = profile.replace('data-testid="icon-verified"', 'data-testid="icon-lock"');
		expect(read(locked)).toEqual({ skipped: 'protected account' });

		const gone = profile
			.replace(/<nav role="navigation" aria-label="Profile timelines"[\s\S]*?<\/nav>/, '')
			.replace(
				'<section role="region"',
				'<div data-testid="emptyState"></div><section role="region"'
			);
		expect(read(gone)).toEqual({ skipped: 'no account to read' });
	});

	it('reads an account that has posted nothing, which is not one that is not there', () => {
		const quiet = profile.replace(
			/<section role="region"[\s\S]*<\/section>/,
			'<section role="region"><div data-testid="emptyState"></div></section>'
		);
		expect(read(quiet)).toMatchObject({ item: { handle: 'ada_nobody', posts: [] } });
	});
});

describe('the posts a profile has shown', () => {
	/** The sample with its posts taken away and these put in their place, as X.com does on the way down a profile. */
	const showing = (ids: number[]) =>
		profile.replace(
			/<div style="position: relative; min-height: 900px;">[\s\S]*<\/section>/,
			`<div>${ids
				.map(
					(
						id
					) => `<article data-testid="tweet"><div data-testid="User-Name"><a href="/Ada_Nobody"><span>Ada Nobody</span></a>
						<a href="/Ada_Nobody/status/${id}"><time datetime="2026-01-01T10:00:00.000Z">1h</time></a></div>
						<div data-testid="tweetText"><span>Made-up words of post ${id}.</span></div></article>`
				)
				.join('')}</div></section>`
		);
	const postsOf = (html: string) => {
		const reading = read(html);
		if (!reading || !('item' in reading)) throw new Error('not read');
		return reading.item;
	};

	it('are kept in mind as the page takes them away and shows others, each once', () => {
		expect(postsOf(showing([1, 2, 3])).posts.map((p) => p.id)).toEqual(['1', '2', '3']);
		expect(postsOf(showing([3, 4, 5])).posts.map((p) => p.id)).toEqual(['1', '2', '3', '4', '5']);
		expect(postsOf(showing([])).posts).toHaveLength(5);
	});

	it('are of their own account, and no more of each than is worth keeping', () => {
		postsOf(showing([1, 2, 3]));
		document.documentElement.innerHTML = showing([7]).replaceAll('Ada_Nobody', 'bob_noone');
		const other = readProfile(document, 'bob_noone');
		expect(other).toMatchObject({ item: { posts: [{ id: '7' }] } });

		const many = Array.from({ length: 60 }, (_, n) => 100 + n);
		expect(postsOf(showing(many)).posts).toHaveLength(30);
	});

	it('stay the first the page showed once there are as many as Jev is ever asked about, and so does the item', () => {
		const first = Array.from({ length: 30 }, (_, n) => 100 + n);
		const full = postsOf(showing(first));
		const further = postsOf(showing(Array.from({ length: 20 }, (_, n) => 125 + n)));
		expect(further.posts.map((p) => p.id)).toEqual(first.map(String));
		expect(further.id).toBe(full.id);
	});

	it('leave out what an account shows only to its followers', () => {
		const locked = showing([1, 2]).replace(
			'<a href="/Ada_Nobody/status/2">',
			'<svg data-testid="icon-lock"></svg><a href="/Ada_Nobody/status/2">'
		);
		expect(postsOf(locked).posts.map((p) => p.id)).toEqual(['1']);
	});

	it('make another item of the account whenever they change: Jev answers about each by its place', () => {
		const few = postsOf(showing([1, 2, 3, 4, 5]));
		expect(few.id).toMatch(/^ada_nobody:\w+$/);
		expect(postsOf(showing([5, 4])).id).toBe(few.id);
		const more = postsOf(showing([6]));
		expect(more.id).not.toBe(few.id);
		expect(more.handle).toBe('ada_nobody');
	});

	it('are worth another look each time there are a good few more than were asked about, until Jev has all it is ever shown', () => {
		const withPosts = (count: number) =>
			postsOf(showing(Array.from({ length: count }, (_, n) => 100 + n)));
		const [five, ten, eleven, seventeen, twentyEight, thirty] = [5, 10, 11, 17, 28, 30].map(
			withPosts
		);
		expect(page.again!(ten!, five!)).toBe(false);
		expect(page.again!(eleven!, five!)).toBe(true);
		expect(page.again!(seventeen!, eleven!)).toBe(true);
		expect(page.again!(seventeen!, seventeen!)).toBe(false);
		// The last few are worth it too: there is no more to wait for.
		expect(page.again!(thirty!, twentyEight!)).toBe(true);
		expect(page.again!(withPosts(40), thirty!)).toBe(false);
	});
});

describe('where the case file goes', () => {
	it('is the end of the header, right over the tabs', () => {
		document.documentElement.innerHTML = profile;
		const anchor = cardAnchor(document)!;
		expect(anchor.querySelector('[data-testid="UserName"]')).not.toBeNull();
		expect(anchor.querySelector('article')).toBeNull();
		expect(anchor.nextElementSibling!.querySelector('nav')).not.toBeNull();
	});

	it('is nowhere until the page has both the header and the tabs', () => {
		document.documentElement.innerHTML = profile.replace(
			/<nav role="navigation"[\s\S]*?<\/nav>/,
			''
		);
		expect(cardAnchor(document)).toBeNull();
	});
});

describe('when there is enough to ask about', () => {
	const item = (posts: number, bio = '') => {
		const reading = read(profile);
		if (!reading || !('item' in reading)) throw new Error('not read');
		const post = { text: 'Made-up words.', at: null, pinned: false, hasLink: false };
		const made = Array.from({ length: posts }, (_, n) => ({ ...post, id: String(n) }));
		return { ...reading.item, bio, posts: made };
	};

	it('is at once with a few posts, and with fewer only once the page has settled', () => {
		expect(page.ready(item(5), false)).toBe(true);
		expect(page.ready(item(2), false)).toBe(false);
		expect(page.ready(item(2), true)).toBe(true);
	});

	it('is never with no posts and no bio to speak of', () => {
		expect(page.ready(item(0, 'Hi'), true)).toBe(false);
		expect(page.ready(item(0, 'Made-up words of a bio, long enough.'), true)).toBe(true);
	});
});
