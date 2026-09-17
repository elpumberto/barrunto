import { describe, expect, it } from 'vitest';
import { commentId, findComments, labelAnchor, readComment, tuningAnchor } from './read';

/** Pages cut from Hacker News's real markup, down to the bones and with everyone's names and words replaced. */
const samples = import.meta.glob<string>('./samples/*.html', {
	query: '?raw',
	import: 'default',
	eager: true
});

function open(name: string) {
	document.body.innerHTML = samples[`./samples/${name}.html`]!;
	const rows = findComments(document);
	return (id: string) => rows.find((row) => commentId(row) === id)!;
}

describe('readComment, on samples of the real page', () => {
	it('reads a top comment with its paragraphs apart, under its story and answering nobody', () => {
		expect(readComment(open('thread')('1001'))).toEqual({
			item: {
				id: '1001',
				text: 'Made-up words of a top comment.\n\nA second paragraph, with a https://site.example/x link.',
				author: 'someone1',
				depth: 0,
				story: { title: 'A made-up story about a database', text: '' },
				parent: null
			}
		});
	});

	it('finds the comment each one answers, however many sit in between', () => {
		const row = open('thread');
		expect(readComment(row('1003'))).toMatchObject({
			item: { depth: 2, parent: { author: 'someone2', text: 'Made-up words of a reply.' } }
		});
		expect(readComment(row('1004'))).toMatchObject({
			item: { depth: 1, parent: { author: 'someone1' } }
		});
	});

	it('leaves the reply link out, wherever the page puts it', () => {
		const reading = readComment(open('thread')('1003'));
		expect(reading).toMatchObject({ item: { text: 'Made-up words of a reply to the reply.' } });
	});

	it('skips what is left of a flagged comment', () => {
		expect(readComment(open('thread')('1005'))).toEqual({ skipped: 'no text' });
	});

	it('leaves a folded comment for when it is unfolded', () => {
		const folded = open('thread')('1006');
		expect(readComment(folded)).toBeNull();
		folded.classList.remove('coll');
		expect(readComment(folded)).toMatchObject({ item: { id: '1006' } });
	});

	it('on a page headed by a comment, takes it for what the top ones answer, and the story from its header', () => {
		expect(readComment(open('branch')('2001'))).toMatchObject({
			item: {
				story: { title: 'A made-up story about a database', text: '' },
				parent: { author: 'someone1', text: 'Made-up words of the comment that heads the page.' }
			}
		});
	});

	it('takes the words of a text post as part of the story', () => {
		expect(readComment(open('ask')('3001'))).toMatchObject({
			item: {
				story: {
					title: 'Ask HN: A made-up question?',
					text: 'Made-up words of whoever asks.\n\nWith a second paragraph.'
				},
				parent: null
			}
		});
	});

	it('reads the depth off the width of the push on a page that does not say it', () => {
		const row = open('thread')('1003');
		row.querySelector('td.ind')!.removeAttribute('indent');
		expect(readComment(row)).toMatchObject({ item: { depth: 2 } });
	});

	it('does not understand a row that is not shaped like a comment', () => {
		document.body.innerHTML =
			'<table><tr class="athing comtr" id="1"><td>something else</td></tr></table>';
		expect(readComment(findComments(document)[0]!)).toBeNull();
	});

	it('puts the labels at the end of the header and the tuning detail at the end of the comment', () => {
		const row = open('thread')('1001');
		expect(labelAnchor(row).className).toBe('comhead');
		expect(tuningAnchor(row).className).toBe('comment');
	});
});
