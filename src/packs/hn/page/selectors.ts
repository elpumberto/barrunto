/**
 * Where each thing sits on Hacker News's page. It has changed little in many years;
 * if Barrunto stops seeing comments, this is the file to fix.
 */
export const selectors = {
	/** A comment is a table row, whose id is the comment's number. */
	comment: 'tr.athing.comtr',
	/** Hacker News marks with this class a comment the reader has folded, and what hangs from it. */
	foldedClass: 'coll',
	text: '.commtext',
	/** The reply link, which some pages put inside the text. */
	reply: '.reply',
	author: '.hnuser',
	/** The cell that pushes a comment to the right, with how deep it sits. */
	indent: 'td.ind',
	/** The cell with the comment's header and words. */
	body: 'td.default',
	/** The header: who, when and the links to move about. The labels go at its end. */
	header: '.comhead',
	/** The block under the header: the tuning detail goes at its end. */
	content: '.comment',
	/** What heads the page: a story or, on a page that shows one branch of a thread, a comment. */
	head: '.fatitem',
	storyTitle: '.titleline > a',
	storyText: '.toptext',
	/** Where a comment shown away from its story names it: "on: …". */
	onStory: '.onstory a'
};
