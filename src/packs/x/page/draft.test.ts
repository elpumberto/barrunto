import { beforeEach, describe, expect, it } from 'vitest';
import { draftAnchor, draftColumn, findDrafts, readDraft } from './draft';

/** A box to write in shaped like X.com's, next to its author's picture, with made-up words. */
const draft = (n: number, lines: string[], attached = '') => `
	<div class="unit">
		<div><div data-testid="UserAvatar-Container-ada_nobody"></div></div>
		<div class="column"><div class="editor"><div data-testid="tweetTextarea_${n}_label">
			<div contenteditable="true" role="textbox" data-testid="tweetTextarea_${n}">${lines
				.map((line) => `<div data-block="true"><span data-text="true">${line}</span></div>`)
				.join('')}</div>
		</div></div>${attached}</div>
	</div>`;

const write = (html: string) => {
	document.body.innerHTML = html;
	return findDrafts(document);
};
const itemOf = (box: HTMLElement) => {
	const reading = readDraft(box);
	if (!reading || !('item' in reading)) throw new Error('not read');
	return reading.item;
};

beforeEach(() => (document.body.innerHTML = ''));

describe('readDraft', () => {
	it('reads what is written as the post it would be: nobody has answered it yet', () => {
		const [box] = write(draft(0, ['Shipping on a Friday, again.', 'See https://example.com']));
		expect(itemOf(box!)).toMatchObject({
			text: 'Shipping on a Friday, again.\nSee https://example.com',
			// Whose it is goes nowhere.
			author: { name: 'the author', handle: '' },
			metrics: { replies: 0, reposts: 0, likes: 0 },
			hasMedia: false,
			hasLink: true,
			inThread: false,
			quoted: null
		});
	});

	it('names it after its words: the same words are the same item, and others another', () => {
		const idOf = (words: string) => itemOf(write(draft(0, [words]))[0]!).id;
		expect(idOf('Shipping on a Friday, again.')).toBe(idOf('Shipping on a Friday, again.'));
		expect(idOf('Shipping on a Friday, again.')).not.toBe(idOf('Shipping on a Monday, again.'));
	});

	it('skips a word or two', () => {
		expect(readDraft(write(draft(0, ['Ho ho ho']))[0]!)).toEqual({ skipped: 'too short to tell' });
	});

	it('tells the posts of a thread apart, each with what is attached to it', () => {
		const boxes = write(
			`<div role="dialog">${draft(0, ['The first of a made-up thread.'], '<div data-testid="attachments"></div>')}
			${draft(1, ['And the second one of the two.'])}</div>`
		);
		expect(boxes.map((box) => itemOf(box))).toMatchObject([
			{ text: 'The first of a made-up thread.', inThread: true, hasMedia: true },
			{ text: 'And the second one of the two.', inThread: true, hasMedia: false }
		]);
	});
});

describe('where a draft is', () => {
	it('has its column next to the picture before it, and its hunch around the editor alone', () => {
		// At the top of the timeline the column holds the buttons too: the hunch goes above them.
		const boxes = write(
			`${draft(0, ['one'], '<div data-testid="toolBar"></div>')}${draft(1, ['two'])}`
		);
		expect(boxes.map((box) => draftColumn(box)?.className)).toEqual(['column', 'column']);
		expect(boxes.map((box) => draftAnchor(box).className)).toEqual(['editor', 'editor']);
	});

	it("takes no picture after the box for its author's: that is somebody quoted under it", () => {
		const [box] =
			write(`<div class="unit"><div><div data-testid="UserAvatar-Container-ada_nobody"></div></div>
			<div class="column"><div class="editor"><div data-testid="tweetTextarea_0_label">
				<div contenteditable="true" data-testid="tweetTextarea_0"></div></div></div>
				<div class="quoted"><div data-testid="UserAvatar-Container-someone_else"></div></div></div></div>`);
		expect(draftColumn(box!)?.className).toBe('column');
	});

	it('stays out of the editor where the page is not as expected', () => {
		const [box] =
			write(`<section><div data-testid="tweetTextarea_0_label"><div class="DraftEditor-root">
			<div contenteditable="true" data-testid="tweetTextarea_0"></div></div></div></section>`);
		expect(draftColumn(box!)).toBeNull();
		expect(draftAnchor(box!).tagName).toBe('SECTION');
	});
});

describe('what is read of it', () => {
	it('reads emoji, which may be images, and keeps empty lines', () => {
		const [box] = write(
			draft(0, ['Shipping on a Friday <img alt="🚀">', '<br data-text="true">', 'Again.'])
		);
		expect(itemOf(box!).text).toBe('Shipping on a Friday 🚀\n\nAgain.');
	});

	it('is another item once something is attached: Jev is told of that too', () => {
		const words = ['Shipping on a Friday, again.'];
		const bare = itemOf(write(draft(0, words))[0]!).id;
		expect(itemOf(write(draft(0, words, '<div data-testid="attachments"></div>'))[0]!).id).not.toBe(
			bare
		);
	});

	it('is part of a thread only in the window one is written in', () => {
		const [top] = write(`${draft(0, ['The box at the top of the timeline.'])}
			<div role="dialog">${draft(0, ['The first of a made-up thread.'])}${draft(1, ['And the second one of the two.'])}</div>`);
		expect(itemOf(top!).inThread).toBe(false);
	});
});
