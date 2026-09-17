import { beforeEach, describe, expect, it } from 'vitest';
import { draftColumn, findDrafts, readDraft } from './draft';

/** A box to write in shaped like X.com's, next to its author's picture, with made-up words. */
const draft = (n: number, lines: string[], attached = '') => `
	<div class="unit">
		<div><div data-testid="UserAvatar-Container-ada_nobody"></div></div>
		<div class="column"><div><div data-testid="tweetTextarea_${n}_label">
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
			author: { handle: '@ada_nobody' },
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

describe('draftColumn', () => {
	it('is what sits next to the picture, and never what holds another draft', () => {
		const boxes = write(`${draft(0, ['one'])}${draft(1, ['two'])}`);
		expect(boxes.map((box) => draftColumn(box).className)).toEqual(['column', 'column']);
		const [alone] = write(
			'<p><span contenteditable="true" data-testid="tweetTextarea_0"></span></p>'
		);
		expect(draftColumn(alone!).tagName).toBe('P');
	});
});
