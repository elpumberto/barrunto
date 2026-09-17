import { beforeEach, describe, expect, it } from 'vitest';
import { findPosts, labelAnchor, labelPlace, postId, readPost, tuningAnchor } from './read';

/** A post shaped like X.com's, with made-up people and words. */
const article = (inner: string) => `<article data-testid="tweet">${inner}</article>`;
const header = (name: string, handle: string, id: string) => `
	<div data-testid="User-Name">
		<a href="/${handle}"><span><span>${name}</span></span></a>
		<a href="/${handle}"><span>@${handle}</span></a>
		<a href="/${handle}/status/${id}"><time datetime="2026-01-01T10:00:00.000Z">2h</time></a>
	</div>`;
const actions = (replies: string, reposts: string, likes: string) => `
	<div role="group">
		<button data-testid="reply" aria-label="${replies}"></button>
		<button data-testid="retweet" aria-label="${reposts}"></button>
		<button data-testid="like" aria-label="${likes}"></button>
	</div>`;

const read = (html: string) => {
	document.body.innerHTML = html;
	return readPost(findPosts(document)[0]!);
};

beforeEach(() => (document.body.innerHTML = ''));

describe('readPost', () => {
	it('takes the text, the author, the metrics and what it carries', () => {
		const reading = read(
			article(`${header('Ada Nobody', 'ada_nobody', '1234567890')}
			<div data-testid="tweetText"><span>Shipping on a Friday </span><img alt="🚀"><a href="https://t.co/abc">example.com</a></div>
			<div data-testid="tweetPhoto"></div>
			${actions('1,412 Replies. Reply', '38 reposts. Repost', '12 Likes. Like')}`)
		);
		expect(reading).toEqual({
			item: {
				id: '1234567890',
				text: 'Shipping on a Friday 🚀example.com',
				author: { name: 'Ada Nobody', handle: '@ada_nobody' },
				metrics: { replies: 1412, reposts: 38, likes: 12 },
				hasMedia: true,
				hasLink: true,
				inThread: false,
				isCutShort: false,
				quoted: null
			}
		});
	});

	it('does not take a quoted post for the post', () => {
		const reading = read(
			article(`${header('Ada Nobody', 'ada_nobody', '1')}
			<div role="link" tabindex="0">${header('Bob Noone', 'bob', '2')}<div data-testid="tweetText">quoted words</div></div>
			${actions('', '', '')}`)
		);
		expect(reading).toEqual({ skipped: 'no text' });
		expect(postId(findPosts(document)[0]!)).toBe('1');
	});

	it('skips ads', () => {
		const ad = `<div data-testid="User-Name"><span>Widgets Co.</span></div><div data-testid="tweetText">Buy</div>`;
		expect(read(article(ad))).toEqual({ skipped: 'ad' });
	});

	it('does not read the posts of a protected account, nor quote them', () => {
		const lock = '<svg data-testid="icon-lock"></svg>';
		const locked = header('Ada Nobody', 'ada_nobody', '7').replace('</a>', `${lock}</a>`);
		expect(read(article(`${locked}<div data-testid="tweetText">for followers</div>`))).toEqual({
			skipped: 'protected account'
		});

		const quoting = `${header('Bob Noone', 'bob', '8')}<div data-testid="tweetText">look at this</div>
			<div role="link" tabindex="0"><div data-testid="User-Name"><span>Ada</span>${lock}<span>@ada</span></div><div data-testid="tweetText">for followers</div></div>`;
		expect(read(article(quoting))).toMatchObject({ item: { text: 'look at this', quoted: null } });
	});

	it('reads a name made of emoji, and a name that starts with an at sign', () => {
		const emoji = `<div data-testid="User-Name"><a href="/cat"><span><img alt="🐈"></span></a><a href="/cat"><span>@cat</span></a><a href="/cat/status/9"><time>1h</time></a></div>`;
		expect(read(article(`${emoji}<div data-testid="tweetText">meow</div>`))).toMatchObject({
			item: { author: { name: '🐈', handle: '@cat' } }
		});
		expect(
			read(article(`${header('@home', 'realhandle', '10')}<div data-testid="tweetText">hi</div>`))
		).toMatchObject({ item: { author: { name: '@home', handle: '@realhandle' } } });
	});

	it('returns nothing for what it does not understand', () => {
		expect(read(article('<div>something new</div>'))).toBeNull();
	});
});

/** Posts cut from X.com's real page, down to the bones and with everyone's names and words replaced. */
describe('readPost, on samples of the real page', () => {
	const samples = import.meta.glob<string>('./samples/*.html', {
		query: '?raw',
		import: 'default',
		eager: true
	});
	const sample = (name: string) => read(samples[`./samples/${name}.html`]!);

	it('reads a plain post', () => {
		expect(sample('plain')).toMatchObject({
			item: {
				id: '1000',
				text: expect.stringContaining('Made-up words of a post.'),
				author: { name: 'Some One', handle: '@someone1' },
				metrics: { replies: 0, reposts: 0, likes: 1 },
				hasMedia: false
			}
		});
	});

	it('does not take a post with a video for an ad', () => {
		expect(sample('video')).toMatchObject({
			item: { hasMedia: true, metrics: { replies: 2, reposts: 5, likes: 5 } }
		});
	});

	it('reads the post and not the one it quotes', () => {
		const reading = sample('quote');
		expect(reading).toMatchObject({
			item: {
				id: '1000',
				author: { name: 'Some One', handle: '@someone1' },
				metrics: { replies: 3, reposts: 24, likes: 138 },
				quoted: { author: '@someone2', text: expect.stringContaining('the quoted post') }
			}
		});
		expect(reading && 'item' in reading && reading.item.text).not.toContain('the quoted post');
	});

	it('notices a text that is cut short', () => {
		const cut = Object.keys(samples).filter((name) => samples[name]!.includes('show-more-link'));
		expect(cut.length).toBeGreaterThan(0);
		for (const name of cut)
			expect(read(samples[name]!)).toMatchObject({ item: { isCutShort: true } });
		expect(sample('plain')).toMatchObject({ item: { isCutShort: false } });
	});
});

describe('labelAnchor', () => {
	it('is the box of the timeline around the post, whose edge is the line; or the post, where there is none', () => {
		document.body.innerHTML =
			'<div data-testid="cellInnerDiv"><div><article data-testid="tweet"></article></div></div><article id="bare"></article>';
		const [boxed, bare] = [...document.querySelectorAll('article')];
		expect(labelAnchor(boxed!).dataset.testid).toBe('cellInnerDiv');
		expect(labelAnchor(bare!)).toBe(bare);
	});
});

describe('tuningAnchor', () => {
	// X.com lays a post out as a row: what is put inside it lands beside its content and squeezes it.
	it('is around the post and not the post itself, nor anything that is faded or hidden with it', () => {
		document.body.innerHTML =
			'<div data-testid="cellInnerDiv"><div id="around"><article data-testid="tweet"><div id="content"></div></article></div></div>';
		const post = document.querySelector('article')!;
		expect(tuningAnchor(post).id).toBe('around');
		expect(tuningAnchor(post).contains(post)).toBe(true);
	});

	it('is the post itself where several share what is around them, so that each keeps its own detail', () => {
		document.body.innerHTML =
			'<div><article data-testid="tweet"></article><article data-testid="tweet"></article></div>';
		const [first, second] = [...document.querySelectorAll('article')];
		expect(tuningAnchor(first!)).toBe(first);
		expect(tuningAnchor(second!)).toBe(second);
	});
});

describe('labelPlace', () => {
	const cell = (inside: string) => `<div data-testid="cellInnerDiv">${inside}</div>`;
	/** Where the page has drawn an element, worked by hand. */
	const drawn = (el: Element, top: number, height: number) =>
		(el.getBoundingClientRect = () => ({ top, height }) as DOMRect);
	const post = (id: string) => document.getElementById(id)!;

	// As X.com does it: a gap of 9 pixels after a module, with its line in the middle of it.
	it('hangs the labels from the line above, wherever in its gap X.com has drawn it', () => {
		document.body.innerHTML = `<div>${cell('<p>Show more</p>')}${cell('<div><div id="line"></div></div>')}${cell('<article id="after-gap"></article>')}${cell('<article id="after-post"></article>')}</div>`;
		const [module, gap, first, second] = [...document.querySelectorAll('[data-testid]')];
		drawn(module!, 0, 52);
		drawn(gap!, 52, 9);
		drawn(gap!.firstElementChild!, 52, 9);
		drawn(post('line'), 56, 1);
		drawn(first!, 61, 200);
		drawn(second!, 261, 200);

		expect(labelPlace(post('after-gap'))).toEqual({ top: '-5px', right: '84px' });
		expect(labelPlace(post('after-post')).top).toBe('0');
	});

	it('hangs them from the top of a gap with no line in it', () => {
		document.body.innerHTML = `<div>${cell('')}${cell('<article id="a"></article>')}</div>`;
		const [gap, first] = [...document.querySelectorAll('[data-testid]')];
		drawn(gap!, 100, 9);
		drawn(first!, 109, 200);
		expect(labelPlace(post('a')).top).toBe('-9px');
	});

	it('takes nothing with words in it, taller than a gap or with no height at all for a gap', () => {
		document.body.innerHTML = `<div>${cell('<span>Show more</span>')}${cell('<article id="a"></article>')}${cell('')}${cell('<article id="b"></article>')}${cell('')}${cell('<article id="c"></article>')}</div>`;
		const cells = [...document.querySelectorAll('[data-testid]')];
		drawn(cells[0]!, 0, 9);
		drawn(cells[2]!, 0, 300);
		drawn(cells[4]!, 0, 0);
		for (const id of ['a', 'b', 'c']) expect(labelPlace(post(id)).top).toBe('0');
	});
});
