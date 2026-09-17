// Loads the built extension into a headless Chrome and walks the whole path once, with no network:
// a bad key, a good key, a made-up x.com page, labels on the posts that dwell, a change of
// sensitivity reaching the page, counters in the popup. It needs the stand-in build: `npm run smoke`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const EXTENSION = resolve('.output/chrome-mv3');
const POSTS = 12;
const ON_SCREEN = 5;

const background = await readFile(`${EXTENSION}/background.js`, 'utf8');
assert.ok(
	!background.includes('dangerouslyAllowBrowser'),
	'this build talks to the real Jev: build with `npm run build:stand-in`'
);

const post = (n) => `<article data-testid="tweet" style="position:relative;height:160px">
	<div data-testid="User-Name"><a href="/user${n}"><span>User ${n}</span></a><a href="/user${n}"><span>@user${n}</span></a>
		<a href="/user${n}/status/${1000 + n}"><time>2h</time></a></div>
	<div><div data-testid="tweetText"><span>Made-up post number ${n}, with a few words in it.</span></div>
		<div role="group"><button data-testid="reply" aria-label="${n * 40} Replies. Reply"></button>
			<button data-testid="retweet" aria-label="3 reposts. Repost"></button>
			<button data-testid="like" aria-label="${n * 7} Likes. Like"></button></div></div></article>`;
const home = `<!doctype html><body style="margin:0;background:#fff">${Array.from({ length: POSTS }, (_, n) => post(n)).join('')}</body>`;

const labelsOnPage = (page) =>
	page.$$eval('article', (articles) =>
		articles.map((article) =>
			[
				...(article
					.querySelector(':scope > [data-barrunto="labels"]')
					?.shadowRoot?.querySelectorAll('.label') ?? [])
			].map((label) => label.dataset.id)
		)
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
	await popup.waitForSelector('.stops');
	assert.match(await popup.$eval('.key span', (el) => el.textContent), /1234$/);

	const page = await browser.newPage();
	page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
	await page.setViewport({ width: 700, height: 160 * ON_SCREEN });
	await page.setRequestInterception(true);
	page.on('request', (request) =>
		request.url().startsWith('https://x.com/')
			? request.respond({ contentType: 'text/html', body: home })
			: request.abort()
	);
	await page.goto('https://x.com/home');

	// The posts on screen dwell, get analyzed and are counted; the ones below are left alone.
	// (A tab that is not in front is told nothing about what is on screen, so the page stays in front.)
	const looked = () => document.querySelectorAll('article > [data-barrunto="labels"]').length;
	await page.waitForFunction(`(${looked})() === ${ON_SCREEN}`, { timeout: 15000 });
	await popup.bringToFront();
	const analyzed = () =>
		popup.$eval('.counters tr:nth-child(2) td:nth-child(2)', (el) => Number(el.textContent));
	assert.equal(await analyzed(), ON_SCREEN, 'only the posts that dwelt on screen are analyzed');

	// A change of sensitivity in the popup reaches the page and repaints it without asking again.
	const onMedium = (await labelsOnPage(page)).flat().length;
	await popup.click('[data-action="sensitivity"][data-value="ultra"]');
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
	assert.ok(labels.slice(ON_SCREEN + 1).flat().length === 0, 'posts never on screen get no label');
	assert.deepEqual(errors, [], 'nothing threw in the popup or the page');
	console.log('ok');
} finally {
	await browser.close();
}
