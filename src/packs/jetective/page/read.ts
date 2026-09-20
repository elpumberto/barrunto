import { fnv1a } from '@/engine';
import type { Reading } from '@/engine';
import { MOST_POSTS } from '../profile';
import type { Profile, ProfilePost } from '../profile';
import { selectors } from './selectors';

/** Words as the reader sees them: emoji are images on X.com, with the character in their alt. */
function visibleText(node: Element): string {
	let text = '';
	for (const child of node.childNodes) {
		if (child instanceof HTMLImageElement) text += child.alt;
		else if (child instanceof Element) text += visibleText(child);
		else text += child.textContent ?? '';
	}
	return text;
}

/** The handle an address on X.com ends in, in lower case: `/ada_nobody`, or the whole address of it. */
const handleIn = (href: string | null | undefined) =>
	href?.match(/\/([a-z0-9_]{1,15})\/?$/i)?.[1]?.toLowerCase() ?? null;

/**
 * Whether the handle under the name is this one. Anything may be written in a name, another
 * account's handle too, and those who pass for somebody else do: what is looked for is this handle,
 * and not whatever comes first with an "@" before it.
 */
function showsHandle(name: Element, handle: string): boolean {
	for (const span of name.querySelectorAll('span')) {
		if (span.childElementCount) continue;
		if (span.textContent?.trim().toLowerCase() === `@${handle}`) return true;
	}
	return false;
}

/** Whether something in a post sits in a post quoted inside it: in a box of the kind that has an author of its own. */
function isQuoted(found: Element, article: Element): boolean {
	let box = found.closest(selectors.quoted);
	while (box && article.contains(box) && box !== article) {
		if (box.querySelector(selectors.author)) return true;
		box = box.parentElement?.closest(selectors.quoted) ?? null;
	}
	return false;
}

/** What belongs to the post itself and not to a post quoted inside it. */
function own(article: Element, selector: string): Element | null {
	for (const found of article.querySelectorAll(selector)) {
		if (!isQuoted(found, article)) return found;
	}
	return null;
}

/** How many accounts' posts are kept in mind. Of each, as many as Jev is ever asked about: the first the page showed. */
const ACCOUNTS_KEPT = 20;

/**
 * X.com keeps on the page only the posts near what is on screen, and takes them away as the user
 * goes down it. The ones it has shown of each account are kept in mind here, for as long as this
 * page lives: that is how more of them get read than fit the screen, with nothing asked of X.com.
 */
const shown = new Map<string, Map<string, ProfilePost>>();

function keptWith(handle: string, onPage: ProfilePost[]): ProfilePost[] {
	const kept = shown.get(handle) ?? new Map<string, ProfilePost>();
	shown.delete(handle);
	shown.set(handle, kept);
	// Once there are as many as Jev is ever asked about, they stay as they are: the questions point
	// at each post by its place, and the answers are kept under what those posts were.
	for (const post of onPage) {
		if (kept.has(post.id) || kept.size < MOST_POSTS) kept.set(post.id, post);
	}
	for (const other of [...shown.keys()].slice(0, Math.max(0, shown.size - ACCOUNTS_KEPT))) {
		shown.delete(other);
	}
	return [...kept.values()];
}

/** For the tests: nothing is kept in mind from one to the next. */
export const forgetPosts = () => shown.clear();

/**
 * The account's own posts among the ones the page shows. Under Replies and Reposts there are other
 * people's too, which say nothing of this account.
 */
function ownPosts(column: Element, handle: string): ProfilePost[] {
	const posts: ProfilePost[] = [];
	for (const article of column.querySelectorAll(selectors.post)) {
		const author = own(article, selectors.author);
		const link = author?.querySelector<HTMLAnchorElement>(selectors.profileLink);
		if (handleIn(link?.getAttribute('href')) !== handle) continue;
		// What someone shows only to their followers is not Barrunto's to send anywhere.
		if (author?.querySelector(selectors.protectedAccount)) continue;
		const words = own(article, selectors.text);
		const text = words ? visibleText(words).trim() : '';
		if (!text) continue;
		const context = article.querySelector(selectors.context);
		const time = own(article, selectors.time);
		posts.push({
			id:
				time
					?.closest('a')
					?.getAttribute('href')
					?.match(/\/status\/(\d+)/)?.[1] ?? text,
			text,
			at: time?.getAttribute('datetime') ?? null,
			pinned: context !== null && context.querySelector('a') === null,
			hasLink:
				words?.querySelector(selectors.linkOut) != null || own(article, selectors.card) !== null
		});
	}
	return posts;
}

type Data = Pick<Profile, 'created' | 'followers' | 'following' | 'postCount'>;
const NO_DATA: Data = { created: null, followers: null, following: null, postCount: null };

/** What X.com calls each count in its data. */
const COUNTS = { followers: 'Follows', following: 'Friends', postCount: 'Tweets' } as const;

/** When the account was opened and its counts, from the data about this handle, if the page has it. */
function dataOf(root: ParentNode, handle: string): Data {
	for (const script of root.querySelectorAll(selectors.data)) {
		try {
			const data = JSON.parse(script.textContent ?? '');
			const entity = data?.mainEntity;
			if (String(entity?.additionalName).toLowerCase() !== handle) continue;
			const counts: { name?: unknown; userInteractionCount?: unknown }[] = Array.isArray(
				entity.interactionStatistic
			)
				? entity.interactionStatistic
				: [];
			const count = (name: string) => {
				const found = counts.find((c) => c?.name === name)?.userInteractionCount;
				return typeof found === 'number' && found >= 0 ? found : null;
			};
			const created = typeof data.dateCreated === 'string' ? data.dateCreated : null;
			return {
				created: created && Number.isFinite(Date.parse(created)) ? created : null,
				followers: count(COUNTS.followers),
				following: count(COUNTS.following),
				postCount: count(COUNTS.postCount)
			};
		} catch {
			// Not data, or not as expected: the signals that need it say nothing.
		}
	}
	return NO_DATA;
}

/**
 * Reads the profile of `subject`, the handle the address names. X.com goes from one profile to
 * another without loading a page, and for a moment shows the one before under the new address:
 * until the page shows this handle, there is nothing to read.
 */
export function readProfile(root: ParentNode, subject: string): Reading<Profile> {
	const column = root.querySelector(selectors.column);
	const name = column?.querySelector(selectors.name);
	if (!column || !name) return null;
	if (!showsHandle(name, subject)) return null;
	const handle = subject;

	// What someone shows only to their followers is not Barrunto's to send anywhere, and an account
	// that is not there has nothing to read. The user's own is read as any other.
	if (name.querySelector(selectors.protectedAccount)) return { skipped: 'protected account' };
	if (column.querySelector(selectors.nothingHere) && !column.querySelector(selectors.tab)) {
		return { skipped: 'no account to read' };
	}

	const words = name.querySelector(selectors.nameWords);
	const bio = column.querySelector(selectors.bio);
	const posts = keptWith(handle, ownPosts(column, handle));
	return {
		item: {
			// Jev answers about each post by its place: the answers kept under an id are for these
			// posts, in this order, and for no others.
			id: `${handle}:${fnv1a(posts.map((post) => post.id).join()).toString(36)}`,
			handle,
			name: (words ? visibleText(words).trim() : '') || `@${handle}`,
			bio: bio ? visibleText(bio).trim() : '',
			posts,
			...dataOf(root, handle),
			readAt: new Date().toISOString()
		}
	};
}

/**
 * Where the case file goes: at the end of the profile's header, under its counts and over its tabs.
 * The header is what comes right before the tabs; nothing else on the page says where it ends.
 */
export function cardAnchor(root: ParentNode): HTMLElement | null {
	const tabs = root.querySelector(selectors.tab)?.closest(selectors.tabs)?.parentElement;
	const header = tabs?.previousElementSibling;
	return header instanceof HTMLElement && header.querySelector(selectors.name) ? header : null;
}
