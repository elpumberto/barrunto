// Loads the built extension into a headless Chrome and walks the whole path once, with no network:
// a bad key, a good key, a pack turned on in the popup's catalogue, a made-up x.com page, labels on
// the posts that dwell, a change of sensitivity in the popup opened over the page reaching it,
// counters, a post of the user's own read as they write it; a made-up profile with a second pack on
// the same site, each doing its part and each turned off without taking the other down; then a
// made-up Hacker News thread, left alone while its pack is off and labelled without a reload once
// it is turned on.
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
/** The posts on a made-up profile, short enough to be all on screen under the header and the case file. */
const PROFILE_POSTS = 5;
/** How many of the made-up comments fit the screen: the story's title takes a little of it. */
const IN_SIGHT = 5;
/** Chrome cuts a popup at this height, in pixels, and Barrunto's does not scroll. */
const MOST_POPUP = 600;

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

// A profile as X.com has it: the header with the name over the
// handle, the tabs right after it, the posts after those, and what X.com tells search engines in the head.
const profilePost = (handle, n) =>
	`<div data-testid="cellInnerDiv"><div><div><article data-testid="tweet" style="position:relative;height:60px">
	<div data-testid="User-Name"><div><a href="/${handle}"><span><span>Made Up</span></span></a></div>
		<div><a href="/${handle}"><span>@${handle}</span></a><a href="/${handle}/status/${n}"><time datetime="2026-01-0${(n % 9) + 1}T10:00:00.000Z">1d</time></a></div></div>
	<div><div data-testid="tweetText"><span>Made-up post number ${n} of a profile, with a few words in it.</span></div>
		<div role="group"><button data-testid="reply" aria-label="2 Replies. Reply"></button>
			<button data-testid="retweet" aria-label="3 reposts. Repost"></button>
			<button data-testid="like" aria-label="9 Likes. Like"></button></div></div></article></div></div></div>`;
const profileData = (handle) =>
	JSON.stringify({
		'@type': 'ProfilePage',
		dateCreated: '2025-12-20T00:00:00.000Z',
		mainEntity: {
			additionalName: handle,
			interactionStatistic: [
				{ name: 'Follows', userInteractionCount: 12 },
				{ name: 'Friends', userInteractionCount: 900 },
				{ name: 'Tweets', userInteractionCount: 40 }
			]
		}
	});
const profileColumn = (
	handle,
	firstPost
) => `<div aria-label="Home timeline"><div><h2>Made Up</h2><div dir="ltr">40 posts</div></div><div></div>
	<div><div><div>
		<div class="header"><div style="height:40px"></div><div>
			<div data-testid="UserName"><div><div><div><div><div><div dir="ltr"><span><span>Made Up</span><span></span></span></div></div></div>
				<div><div tabindex="-1"><div><div dir="ltr"><span>@${handle}</span></div></div></div></div></div></div></div></div>
			<div><div data-testid="UserDescription" dir="auto"><span>A made-up bio, with a few words in it.</span></div></div>
			<div><div><a href="/${handle}/following"><span><span>900</span></span></a></div><div><a href="/${handle}/verified_followers"><span><span>12</span></span></a></div></div></div></div>
		<div><nav aria-label="Profile timelines"><div><div role="tablist"><div role="presentation"><a role="tab" href="/${handle}">Posts</a></div>
			<div role="presentation"><a role="tab" href="/${handle}/with_replies">Replies</a></div></div></div></nav></div>
		<section role="region">${Array.from({ length: PROFILE_POSTS }, (_, n) => profilePost(handle, firstPost + n)).join('')}</section>
	</div></div></div></div>`;
const profile = (
	handle,
	firstPost
) => `<!doctype html><head><script type="application/ld+json">${profileData(handle)}</script></head>
	<body style="margin:0;background:#fff"><main><div data-testid="primaryColumn">${profileColumn(handle, firstPost)}</div></main></body>`;

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
		// Where two packs act on the page, the one shown is the one of the two that is marked.
		const shown = await real.$eval(
			'.eyebrow',
			(el) => (el.querySelector('[aria-pressed="true"]') ?? el).textContent
		);
		assert.match(shown, pack);
		await act(real);
		await real.close().catch(() => {});
	};

	const page = await browser.newPage();
	page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
	await page.setViewport({ width: 700, height: 160 * ON_SCREEN });
	await page.setRequestInterception(true);
	const SITES = {
		'https://x.com/ada_nobody': profile('ada_nobody', 3000),
		'https://x.com/bob_noone': profile('bob_noone', 4000),
		'https://x.com/': home,
		'https://news.ycombinator.com/': thread
	};
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
	await overThePage(/^X Posts$/, async (real) => {
		// The popup cannot scroll and Chrome cuts it at 600 px: at its tallest, with the usage unfolded
		// over the pack with most controls, it has to fit.
		await real.click('[data-fold="usage"] summary');
		assert.equal(
			(await real.$$('[data-action="pick"]')).length,
			2,
			'both packs of X.com are named'
		);
		const tall = await real.$eval('#popup', (el) => el.offsetHeight);
		console.log('the popup at its tallest:', tall, 'px');
		assert.ok(tall <= MOST_POPUP, `the popup fits Chrome's window: ${tall} px`);
		await real.click('[data-action="sensitivity"][data-value="ultra"]');
	});
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

	// Two packs on one site. On a profile each does its part: one labels the posts, the other opens a
	// case file on the account, asked about once. What the popup gives back to Chrome is watched.
	await popup.evaluate(() => {
		window.givenBack = [];
		const giveBack = chrome.permissions.remove.bind(chrome.permissions);
		chrome.permissions.remove = (leave, ...rest) => {
			window.givenBack.push(...leave.origins);
			return giveBack(leave, ...rest);
		};
	});
	const givenBack = () => popup.evaluate(() => window.givenBack);
	await turnOn('jetective');
	// The catalogue cannot scroll either: unfolded over the pack that tells of most labels, it has to fit.
	await popup.click('[data-action="packs"]');
	await popup.click('[data-action="about"][data-pack="jetective"]');
	const catalogue = await popup.$eval('#popup', (el) => el.offsetHeight);
	console.log('the catalogue at its tallest:', catalogue, 'px');
	assert.ok(catalogue <= MOST_POPUP, `the catalogue fits Chrome's window: ${catalogue} px`);
	await popup.click('[data-action="about"][data-pack="jetective"]');
	await popup.click('[data-action="home"]');
	assert.deepEqual(
		await registered(),
		['https://x.com/*'],
		'a site two packs act on is named once'
	);
	await page.bringToFront();
	// A case file is tall: the screen is made tall enough for the posts of the profile to show under it.
	await page.setViewport({ width: 700, height: 1600 });
	await page.goto('https://x.com/ada_nobody');
	const caseFile = (handle) =>
		page.waitForFunction(
			(handle) => {
				const file = document.querySelector('.header > [data-barrunto="card"]')?.shadowRoot;
				const whose = [...(file?.querySelectorAll('.facts dd') ?? [])].map(
					(fact) => fact.textContent
				);
				return whose.includes(`@${handle}`) && !file.querySelector('.waiting')
					? [...file.querySelectorAll('.stamp, .line, .reads')].map((said) => said.textContent)
					: null;
			},
			{ timeout: 10000 },
			handle
		);
	console.log('the case file:', await (await caseFile('ada_nobody')).jsonValue());
	await waitForLooked('[data-testid="cellInnerDiv"] > div > div', PROFILE_POSTS);
	await overThePage(/^X Posts$/, async (real) => {
		await real.click('[data-action="pick"][data-pack="jetective"]');
		await real.waitForSelector('[data-pack="jetective"][aria-pressed="true"]');
		await real.click('[data-fold="usage"] summary');
		const tall = await real.$eval('#popup', (el) => el.offsetHeight);
		assert.ok(tall <= MOST_POPUP, `the popup fits over the other pack too: ${tall} px`);
		assert.equal(
			await real.$('[data-action="drafts"], #ahead'),
			null,
			'a pack shows only its own controls: no drafts to check, nothing to read ahead'
		);
		await real.click('[data-action="sensitivity"][data-pack="jetective"][data-value="ultra"]');
	});
	// Each pack has a sensitivity of its own, and moving it reaches the case file without asking again.
	await page.bringToFront();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.header > [data-barrunto="card"]')
				.shadowRoot.querySelector('.charge'),
		{ timeout: 5000 }
	);
	await popup.bringToFront();
	let counted = ON_SCREEN + DRAFTS + PROFILE_POSTS + 1;
	assert.equal(
		await analyzed(),
		counted,
		'the posts of the profile are asked about, and the account once'
	);

	// X.com goes from one profile to another without loading a page: the case file follows.
	await page.bringToFront();
	await page.evaluate(
		(column) => {
			history.pushState({}, '', '/bob_noone/with_replies');
			document.querySelector('script[type="application/ld+json"]').remove();
			document.querySelector('[data-testid="primaryColumn"]').innerHTML = column;
		},
		profileColumn('bob_noone', 4000)
	);
	await caseFile('bob_noone');
	await waitForLooked('[data-testid="cellInnerDiv"] > div > div', PROFILE_POSTS);
	await popup.bringToFront();
	counted += PROFILE_POSTS + 1;
	assert.equal(
		await analyzed(),
		counted,
		'and so is the next profile, gone to with no page loaded'
	);

	// Either pack turned off leaves the other at work, and with Chrome's leave for the site they share.
	const flipTo = async (pack, to) => {
		await popup.bringToFront();
		await popup.click('[data-action="packs"]');
		await popup.click(`[data-action="enable"][data-pack="${pack}"]`);
		await popup.waitForSelector(
			`[data-action="enable"][data-pack="${pack}"][aria-checked="${to}"]`
		);
		await popup.click('[data-action="home"]');
	};
	const onProfile = () =>
		page.evaluate(() => ({
			file: document.querySelector('.header > [data-barrunto="card"]') !== null,
			labels: document.querySelectorAll('[data-barrunto="labels"]').length
		}));
	await page.bringToFront();
	const labelled = (await onProfile()).labels;
	assert.ok(labelled > 0, 'some posts of the profile get a label on ultra');
	await flipTo('jetective', false);
	await page.bringToFront();
	await page.waitForFunction(() => !document.querySelector('.header > [data-barrunto="card"]'));
	assert.deepEqual(
		await onProfile(),
		{ file: false, labels: labelled },
		'the posts keep their labels'
	);
	assert.deepEqual(await givenBack(), [], 'leave for the site stays while the other pack needs it');
	assert.deepEqual(await registered(), ['https://x.com/*']);
	await flipTo('jetective', true);
	await page.bringToFront();
	await caseFile('bob_noone');
	await flipTo('x', false);
	assert.deepEqual(await givenBack(), [], 'whichever of the two is turned off');
	assert.deepEqual(await registered(), ['https://x.com/*']);
	await page.bringToFront();
	await page.reload();
	await caseFile('bob_noone');
	await new Promise((resolve) => setTimeout(resolve, 1500));
	assert.deepEqual(
		await onProfile(),
		{ file: true, labels: 0 },
		'the case file needs no other pack'
	);
	await flipTo('jetective', false);
	assert.deepEqual(await givenBack(), ['https://x.com/*'], 'the last pack off gives the site back');
	assert.deepEqual(await registered(), [], 'and the script runs nowhere');
	await flipTo('x', true);
	await popup.bringToFront();
	assert.equal(await analyzed(), counted, 'answers are kept: nothing was asked twice');

	// A pack that is off acts nowhere; turned on, it reads its own site with its own labels.
	await page.bringToFront();
	await page.setViewport({ width: 700, height: 160 * ON_SCREEN });
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
		counted + IN_SIGHT + AHEAD,
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
