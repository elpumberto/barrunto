// Loads the built extension into a headless Chrome and walks the whole path once, with no network:
// a bad key, a good key, a pack turned on in the popup's catalogue, a made-up x.com page, labels on
// the posts that dwell, a change of sensitivity in the popup opened over the page reaching it,
// counters, a post of the user's own read as they write it; then a made-up Hacker News thread,
// left alone while its pack is off and labelled without a reload once it is turned on.
// It needs the stand-in build, which also holds leave for every pack's site: `npm run smoke`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const EXTENSION = resolve('.output/chrome-mv3');
const POSTS = 12;
const ON_SCREEN = 5;
const COMMENTS = 9;
const AHEAD = 2;
const DRAFTS = 1;
/** How many of the made-up comments fit the screen: the story's title takes a little of it. */
const IN_SIGHT = 5;

const background = await readFile(`${EXTENSION}/background.js`, 'utf8');
assert.ok(
	!background.includes('dangerouslyAllowBrowser'),
	'this build talks to the real Jev: build with `npm run build:stand-in`'
);

// As X.com has them: each post in a box of the timeline, with an element of its own around it.
const post = (
	n
) => `<div data-testid="cellInnerDiv"><div><div><article data-testid="tweet" style="position:relative;height:160px">
	<div data-testid="User-Name"><a href="/user${n}"><span>User ${n}</span></a><a href="/user${n}"><span>@user${n}</span></a>
		<a href="/user${n}/status/${1000 + n}"><time>2h</time></a></div>
	<div><div data-testid="tweetText"><span>Made-up post number ${n}, with a few words in it.</span></div>
		<div role="group"><button data-testid="reply" aria-label="${n * 40} Replies. Reply"></button>
			<button data-testid="retweet" aria-label="3 reposts. Repost"></button>
			<button data-testid="like" aria-label="${n * 7} Likes. Like"></button></div></div></article></div></div></div>`;
// Where a post is written, as X.com has it: the box next to its author's picture. Out of the way of the posts.
const composer = `<div style="position:fixed;right:0;bottom:0;width:300px;display:flex"><div><div data-testid="UserAvatar-Container-me"></div></div>
	<div id="draft"><div contenteditable="true" data-testid="tweetTextarea_0" style="min-height:20px"></div></div></div>`;
const home = `<!doctype html><body style="margin:0;background:#fff">${Array.from({ length: POSTS }, (_, n) => post(n)).join('')}${composer}</body>`;

const comment = (
	n
) => `<tr class="athing comtr" id="${2000 + n}"><td><table><tr><td class="ind" indent="0"></td>
	<td class="default" style="height:160px"><span class="comhead"><a class="hnuser">user${n}</a></span>
		<div class="comment"><div class="commtext">Made-up comment number ${n}, with a few words in it.</div></div></td></tr></table></td></tr>`;
const thread = `<!doctype html><body style="margin:0"><table class="fatitem"><tr><td><span class="titleline"><a href="#">A made-up story</a></span></td></tr></table>
	<table>${Array.from({ length: COMMENTS }, (_, n) => comment(n)).join('')}</table></body>`;

const labelsOnPage = (page, items = '[data-testid="cellInnerDiv"]', anchor = ':scope >') =>
	page.$$eval(
		items,
		(articles, anchor) =>
			articles.map((article) =>
				[
					...(article
						.querySelector(`${anchor} [data-barrunto="labels"]`)
						?.shadowRoot?.querySelectorAll('.label') ?? [])
				].map((label) => label.dataset.id)
			),
		anchor
	);

const browser = await puppeteer.launch({
	...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }),
	headless: true,
	pipe: true,
	enableExtensions: [EXTENSION],
	args: process.env.CI ? ['--no-sandbox'] : []
});

try {
	const errors = [];
	const worker = await browser.waitForTarget((target) => target.type() === 'service_worker');
	const extension = new URL(worker.url()).host;

	const popup = await browser.newPage();
	popup.on('pageerror', (error) => errors.push(`popup: ${error.message}`));
	await popup.goto(`chrome-extension://${extension}/popup.html`);
	await popup.waitForSelector('#key');
	await popup.type('#key', 'bad-key');
	await popup.click('.go');
	await popup.waitForSelector('.failure');
	assert.match(await popup.$eval('.failure', (el) => el.textContent), /rejected this key/);
	await popup.$eval('#key', (field) => (field.value = ''));
	await popup.type('#key', 'any-key-1234');
	await popup.click('.go');
	await popup.waitForSelector('.counters');
	assert.match(await popup.$eval('.key .tail', (el) => el.textContent), /1234$/);
	assert.match(await popup.$eval('.warning', (el) => el.textContent), /No rule pack is on/);

	// Nothing acts anywhere until its pack is turned on, in the popup's catalogue of packs.
	const turnOn = async (pack) => {
		await popup.bringToFront();
		await popup.click('[data-action="packs"]');
		await popup.click(`[data-action="enable"][data-pack="${pack}"]`);
		await popup.waitForSelector(`[data-action="enable"][data-pack="${pack}"][aria-checked="true"]`);
		await popup.click('[data-action="home"]');
	};
	/** The sites Chrome has the content script run on, as the background registered it. */
	const registered = async () => {
		const background = await worker.worker();
		const scripts = await background.evaluate(() => chrome.scripting.getRegisteredContentScripts());
		return scripts.flatMap((script) => script.matches).sort();
	};
	assert.deepEqual(await registered(), [], 'with no pack on, the script runs nowhere');
	await turnOn('x');
	assert.deepEqual(await registered(), ['https://x.com/*'], 'and then only where a pack is on');
	await popup.click('[data-action="tuning"]');

	/** How many items Barrunto reads ahead of the user, set in the popup. */
	const readAhead = async (items) => {
		await popup.bringToFront();
		await popup.$eval(
			'#ahead',
			(field, value) => {
				field.value = value;
				field.dispatchEvent(new Event('change', { bubbles: true }));
			},
			String(items)
		);
	};
	// With nothing read ahead, only what stays on screen is asked about.
	await readAhead(0);

	// The popup as the user opens it, over the page in front: that page's pack is what it shows.
	const overThePage = async (pack, act) => {
		const background = await worker.worker();
		await background.evaluate(() => chrome.action.openPopup());
		const opened = await browser.waitForTarget(
			(target) => target.url().endsWith('/popup.html') && target !== popup.target()
		);
		const real = await opened.asPage();
		real.on('pageerror', (error) => errors.push(`popup over the page: ${error.message}`));
		await real.waitForSelector('.eyebrow');
		assert.match(await real.$eval('.eyebrow', (el) => el.textContent), pack);
		await act(real);
		await real.close().catch(() => {});
	};

	const page = await browser.newPage();
	page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
	await page.setViewport({ width: 700, height: 160 * ON_SCREEN });
	await page.setRequestInterception(true);
	const SITES = { 'https://x.com/': home, 'https://news.ycombinator.com/': thread };
	page.on('request', (request) => {
		const body = Object.entries(SITES).find(([site]) => request.url().startsWith(site))?.[1];
		return body ? request.respond({ contentType: 'text/html', body }) : request.abort();
	});
	await page.bringToFront();
	await page.goto('https://x.com/home');

	// The posts on screen dwell, get analyzed and are counted; the ones below are left alone.
	// (A tab that is not in front is told nothing about what is on screen, so the page stays in front.)
	// With tuning mode on, every item that has been looked at gets its line, labelled or not: that is
	// how the items looked at are counted.
	const looked = (items) =>
		[...document.querySelectorAll(`${items} > [data-barrunto="tuning"]`)].filter((host) =>
			host.shadowRoot.querySelector('.box')
		).length;
	const waitForLooked = async (items, count) => {
		await page
			.waitForFunction(`(${looked})(${JSON.stringify(items)}) === ${count}`, { timeout: 15000 })
			.catch(() => {});
		assert.equal(await page.evaluate(looked, items), count, `${count} of ${items} are looked at`);
	};
	await waitForLooked('[data-testid="cellInnerDiv"] > div > div', ON_SCREEN);
	await popup.bringToFront();
	const analyzed = () =>
		popup.$eval('.counters tr:nth-child(2) td:nth-child(2)', (el) => Number(el.textContent));
	assert.equal(await analyzed(), ON_SCREEN, 'only the posts that dwelt on screen are analyzed');

	// A change of sensitivity in the popup reaches the page and repaints it without asking again.
	const onMedium = (await labelsOnPage(page)).flat().length;
	await page.bringToFront();
	await overThePage(/^X$/, (real) => real.click('[data-action="sensitivity"][data-value="ultra"]'));
	await page.bringToFront();
	await page.waitForFunction(
		(before) =>
			[...document.querySelectorAll('[data-barrunto="labels"]')].reduce(
				(sum, host) => sum + host.shadowRoot.querySelectorAll('.label').length,
				0
			) > before,
		{ timeout: 5000 },
		onMedium
	);
	const labels = await labelsOnPage(page);
	const onUltra = labels.flat().length;
	await popup.bringToFront();

	console.log('labels per post on ultra:', JSON.stringify(labels));
	assert.equal(await analyzed(), ON_SCREEN, 'moving the sensitivity asks Jev nothing');
	assert.ok(onUltra > onMedium, 'ultra labels more than medium');
	assert.ok(labels.slice(ON_SCREEN).flat().length === 0, 'posts never on screen get no label');

	// What the user writes is read as one more post, once they stop typing, and told to them alone.
	await page.bringToFront();
	await page.type(
		'[data-testid="tweetTextarea_0"]',
		'A made-up post of my own, long enough to ask about.'
	);
	await page.waitForFunction(
		() =>
			document.querySelector('#draft > [data-barrunto="draft"]')?.shadowRoot.querySelector('.said'),
		{ timeout: 8000 }
	);
	await popup.bringToFront();
	assert.equal(await analyzed(), ON_SCREEN + DRAFTS, 'the draft is asked about once');

	// A pack that is off acts nowhere; turned on, it reads its own site with its own labels.
	await page.bringToFront();
	await page.goto('https://news.ycombinator.com/item?id=1');
	assert.deepEqual(
		await registered(),
		['https://x.com/*'],
		'a pack that is off is registered nowhere'
	);
	await new Promise((resolve) => setTimeout(resolve, 1500));
	assert.equal(await page.$('[data-barrunto]'), null, 'a pack that is off leaves its site alone');
	await turnOn('hn');
	// Reading ahead: the comments in sight and the next few past them, and no further.
	await readAhead(AHEAD);
	await page.bringToFront();
	await overThePage(/Hacker News/, (real) =>
		real.click('[data-action="sensitivity"][data-value="ultra"]')
	);
	await page.bringToFront();
	await waitForLooked('td.default', IN_SIGHT + AHEAD);
	const onThread = await labelsOnPage(page, 'tr.comtr', '.comhead >');
	console.log('labels per comment on ultra:', JSON.stringify(onThread));
	assert.ok(onThread.flat().length > 0, 'some comments get a label on ultra');
	assert.ok(
		onThread.flat().every((id) => ['insight', 'snark', 'tangent'].includes(id)),
		'comments get the labels of their own pack'
	);

	// What the user would rather not see is folded away, and nothing else is.
	await overThePage(/Hacker News/, async (real) => {
		await real.click('[data-fold="noise"] summary');
		await real.click('[data-action="treatment"][data-judgment="snark"][data-value="hide"]');
	});
	await page.bringToFront();
	await page.waitForFunction(() => document.querySelector('[data-barrunto="fold"]'), {
		timeout: 5000
	});
	const folded = await page.$$eval('tr.comtr', (rows) =>
		rows.map((row) => row.querySelector('[data-barrunto="fold"]') !== null)
	);
	assert.deepEqual(
		folded,
		onThread.map((ids) => ids.includes('snark')),
		'what is labelled Snark is folded away, whatever else it is labelled, and nothing else is'
	);

	await popup.bringToFront();
	assert.equal(
		await analyzed(),
		ON_SCREEN + DRAFTS + IN_SIGHT + AHEAD,
		'the comments in sight and the ones read ahead are counted with the posts, and no others'
	);

	// A pack turned off and on again with its page open: the page is handed the script a second time,
	// and the copy that carries on reads what the first one never got to.
	const flip = async (pack, to) => {
		await popup.bringToFront();
		await popup.click('[data-action="packs"]');
		await popup.click(`[data-action="enable"][data-pack="${pack}"]`);
		await popup.waitForSelector(
			`[data-action="enable"][data-pack="${pack}"][aria-checked="${to}"]`
		);
		await popup.click('[data-action="home"]');
	};
	await flip('hn', false);
	assert.deepEqual(await registered(), ['https://x.com/*'], 'turned off, its site is let go of');
	await flip('hn', true);
	await page.bringToFront();
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await waitForLooked('td.default', COMMENTS);

	assert.deepEqual(errors, [], 'nothing threw in the popup or the page');
	console.log('ok');
} finally {
	await browser.close();
}
