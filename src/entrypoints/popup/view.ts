import { packSettingsOf } from '@/engine';
import type { Pack } from '@/engine';
import type { KeyFailure } from '@/messages';
// The types alone, and not `@/storage`: drawing the popup needs no Chrome, and so its tests need none either.
import { MOST_AHEAD } from '@/storage/types';
import type { ConnectionStatus, Counters, Settings } from '@/storage/types';
import { onPackControl, packControls, toggle } from './pack-controls';
import type { PackActions } from './pack-controls';
import eyebrow from '@/assets/icon.svg?raw';
import wordmark from '@/assets/wordmark.svg?raw';
import { fold, redraw } from './redraw';
import { packsView } from './packs-view';
import { texts } from './texts';

/** Everything the popup shows. The stored part comes from storage; the key form's part is the popup's own. */
export interface PopupState {
	connection: ConnectionStatus;
	settings: Settings;
	/** The packs there are. */
	packs: Pack[];
	/** The packs of the page the popup was opened over, on or off: two may act on one site. */
	here: Pack[];
	/** Which of them the popup is showing, by id, once the user has picked one. */
	picked: string | null;
	/** For each pack, by id, whether Chrome holds the user's leave for its sites. A pack is on when it is wanted and has it. */
	leave: Record<string, boolean>;
	/** Which view is up: the home view, which is about this page, or the catalogue of packs. */
	view: 'home' | 'packs';
	/** In the catalogue, the pack whose description is unfolded. */
	about: string | null;
	session: Counters;
	total: Counters;
	/** The last four characters of the stored key. */
	keyTail: string;
	form: KeyForm;
}

/** The key form: whether it was asked for, whether a key is being checked, why the last one failed, and what is typed. */
export interface KeyForm {
	open: boolean;
	checking: boolean;
	failure: KeyFailure | null;
	typed: string;
}

export const closedForm: KeyForm = { open: false, checking: false, failure: null, typed: '' };

/** How much of the key is shown. */
export const tailOf = (apiKey: string | null) => (apiKey ?? '').slice(-4);

export interface PopupActions extends PackActions {
	connect(apiKey: string): void;
	/** What is in the key field, as it is typed. It asks for no redraw. */
	typed(text: string): void;
	changeKey(): void;
	cancelKey(): void;
	removeKey(): void;
	setPaused(paused: boolean): void;
	setTuning(tuning: boolean): void;
	setLookAhead(items: number): void;
	setCheckDrafts(checkDrafts: boolean): void;
	resetCounters(): void;
	go(view: PopupState['view']): void;
	/** Shows another pack of this page. */
	pick(packId: string): void;
	/** Unfolds what a pack is about, or folds it back if it was the one unfolded. */
	showAbout(packId: string): void;
	setEnabled(packId: string, on: boolean): void;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 1.9K, 352K, 1.2M: from a thousand up, one decimal at most. Anything that is not a number reads as 0. */
export function compact(value: number): string {
	const n = Math.round(Number(value)) || 0;
	const short = (size: number, letter: string) => {
		const units = n / size;
		return `${units.toFixed(units < 99.95 ? 1 : 0).replace(/\.0$/, '')}${letter}`;
	};
	if (n >= 999_500) return short(1e6, 'M');
	if (n >= 1000) return short(1e3, 'K');
	return String(n);
}

/** The dot and the word at the top right. */
function statusOf({ connection, settings, form }: PopupState): [dot: string, word: string] {
	if (form.checking) return ['', texts.status.checking];
	// A key that was tried and refused says so in the form: the one in use may still be good.
	if (connection.state === 'keyRejected') {
		return ['bad', texts.status.keyRejected];
	}
	if (connection.state === 'noKey') return ['', texts.status.noKey];
	if (connection.state === 'trouble') return ['warn', texts.status.trouble];
	if (settings.paused) return ['', texts.status.paused];
	return ['good', texts.status.connected];
}

/** The brand, how things stand and, once there is a key, the switch that pauses it all. */
function head(state: PopupState, withSwitch: boolean): string {
	const [dot, word] = statusOf(state);
	return `<header class="head"><span class="icon">${eyebrow}</span><span class="wordmark" role="img" aria-label="Barrunto">${wordmark}</span>
		<span class="status" aria-live="polite"><span class="dot ${dot}"></span>${word}</span>
		${withSwitch ? toggle('pause', !state.settings.paused, texts.reading) : ''}</header>`;
}

function keyForm({ form, connection }: PopupState, canCancel: boolean): string {
	const failure = form.failure ?? (connection.state === 'keyRejected' ? 'keyRejected' : null);
	const locked = form.checking ? 'disabled' : '';
	return `<form class="row" data-form="key">
		<label class="title" for="key">${texts.key.label}</label>
		<input id="key" class="field ${failure ? 'failed' : ''}" type="password" autocomplete="off" spellcheck="false" placeholder="${texts.key.placeholder}" ${locked} />
		${failure ? `<p class="failure">${texts.key.failure[failure]}</p>` : ''}
		<button class="go" type="submit" ${locked}>${form.checking ? texts.key.checking : texts.key.connect}</button>
		${canCancel ? `<button class="link" type="button" data-action="cancel" ${locked}>${texts.key.cancel}</button>` : ''}
		<p class="help">${texts.key.promise}</p>
	</form>`;
}

/** Whether a pack is on: the user wants it, and Chrome holds their leave for its sites. */
const isOn = ({ settings, leave }: PopupState, pack: Pack) =>
	Boolean(settings.packs[pack.id]?.enabled && leave[pack.id]);

/** The pack of this page the popup shows: the one picked, or the first that is on, or the first. */
export const shownPack = (state: PopupState): Pack | null =>
	state.here.find((pack) => pack.id === state.picked) ??
	state.here.find((pack) => isOn(state, pack)) ??
	state.here[0] ??
	null;

/**
 * What the block about this page is called: its pack. Where two packs act on the page, their names
 * are the way from one to the other, in the same line: the popup has no room for one more.
 */
function nameOf(state: PopupState, shown: Pack | null): string {
	if (!shown) return `<div class="eyebrow">${texts.analysis}</div>`;
	if (state.here.length < 2) return `<div class="eyebrow">${shown.name}</div>`;
	const picks = state.here.map(
		(pack) =>
			`<button type="button" data-action="pick" data-pack="${pack.id}" data-on="${isOn(state, pack)}" aria-pressed="${pack === shown}">${pack.name}</button>`
	);
	return `<div class="eyebrow picks" role="group" aria-label="${texts.packs.here}">${picks.join('')}</div>`;
}

/**
 * How things are analyzed on this page: the controls of its pack while it is on, the offer to turn
 * it on while it is off, how far ahead of the user it reads, and the tuning mode.
 */
function analysis(state: PopupState): string {
	const { settings, leave, packs } = state;
	const pack = shownPack(state);
	const chosen = pack && packSettingsOf(pack, settings.packs[pack.id]);
	const anyOn = packs.some((p) => settings.packs[p.id]?.enabled && leave[p.id]);
	let ofThisPage: string;
	if (pack && chosen?.enabled && leave[pack.id]) ofThisPage = packControls(pack, chosen);
	else if (pack) {
		// Wanted and without leave is off too, but for another reason, and the way out is the same switch.
		const why = chosen?.enabled ? texts.packs.noLeave : texts.packs.off;
		ofThisPage = `<div class="inline"><div><div class="title">${why.title}</div><p class="${chosen?.enabled ? 'warning' : 'help'}">${why.help}</p></div>
			${toggle('enable', false, texts.packs.on(pack.name), `data-pack="${pack.id}"`)}</div>`;
	} else {
		ofThisPage = `<p class="${anyOn ? 'help' : 'warning'}">${anyOn ? texts.packs.notHere : texts.packs.noneOn}</p>`;
	}
	// Only where it means something: over a pack that is on and reads what is written on its site.
	const drafts =
		pack?.readsDrafts && chosen?.enabled && leave[pack.id]
			? `<div class="inline"><div><div class="title">${texts.drafts.title}</div><p class="help">${texts.drafts.help}</p></div>
			${toggle('drafts', settings.checkDrafts, texts.drafts.title)}</div>`
			: '';
	return `<section class="row">${nameOf(state, pack)}
		${ofThisPage}
		<div class="inline"><div><label class="title" for="ahead">${texts.ahead.title}</label><p class="help" id="ahead-help">${texts.ahead.help}</p></div>
			<input id="ahead" class="field count" type="number" min="0" max="${MOST_AHEAD}" step="1" value="${Number(settings.lookAhead) || 0}" title="${texts.ahead.none}" aria-describedby="ahead-help" /></div>
		${drafts}
		<div class="inline"><div><div class="title">${texts.tuning.title}</div><p class="help">${texts.tuning.help}</p></div>
			${toggle('tuning', settings.tuning, texts.tuning.title)}</div></section>`;
}

/** What goes on with Jev: what asking has taken, folded to a line, and the key it is asked with. */
function api({ session, total, keyTail }: PopupState): string {
	const counter = (name: string, key: keyof Counters) =>
		`<tr><td>${name}</td><td>${compact(session[key])}</td><td>${compact(total[key])}</td></tr>`;
	const usage = `<table class="counters">
			<tr><th><button class="link" type="button" data-action="reset">${texts.counters.reset}</button></th><th>${texts.counters.session}</th><th>${texts.counters.total}</th></tr>
			${counter(texts.counters.items, 'items')}${counter(texts.counters.tokensIn, 'tokensIn')}${counter(texts.counters.tokensOut, 'tokensOut')}</table>`;
	const brief = texts.counters.brief(
		compact(session.items),
		compact(session.tokensIn + session.tokensOut)
	);
	return `<section class="row"><div class="eyebrow">${texts.api}</div>
		${fold('usage', texts.counters.title, brief, usage)}
		<div class="key"><span class="title">${texts.key.title}</span><span class="tail">ts_••••••${escapeHtml(keyTail)}</span>
			<button class="link" type="button" data-action="change">${texts.key.change}</button>
			<button class="link" type="button" data-action="remove">${texts.key.remove}</button></div></section>`;
}

/** Two blocks: how things are analyzed on this page, and what goes on with Jev. */
function working(state: PopupState): string {
	const { connection } = state;
	return `${connection.state === 'trouble' ? `<p class="band" title="${texts.trouble.meanwhile}">${texts.trouble[connection.reason]}</p>` : ''}
	${analysis(state)}
	${api(state)}
	<footer class="foot"><button class="link" type="button" data-action="packs">${texts.packs.open} →</button></footer>`;
}

/** Which screen each popup shows, and where the focus goes on reaching each. */
const shown = new WeakMap<HTMLElement, string>();
const STARTS_AT: Record<string, string> = {
	key: '#key',
	packs: '[data-action="home"]',
	home: '[data-action="packs"]'
};

/**
 * Draws the popup for this state inside `root`, and sends what the user does to `actions`.
 * Everything drawn as HTML is Barrunto's own or a pack's (texts and drawings) except the key's
 * tail, which is escaped; what is typed goes in as the field's value, never as HTML.
 */
export function renderPopup(root: HTMLElement, state: PopupState, actions: PopupActions): void {
	const { connection, settings, form } = state;
	const needsKey = connection.state === 'noKey' || connection.state === 'keyRejected';
	const asksKey = needsKey || form.open;
	const screen = asksKey ? 'key' : state.view;
	const body = asksKey
		? keyForm(state, !needsKey)
		: state.view === 'packs'
			? packsView(state)
			: working(state);
	redraw(root, head(state, !asksKey) + body);

	// On a change of screen what had the focus is gone: it goes to where the new one starts.
	if (shown.get(root) !== screen) {
		if (shown.has(root)) root.querySelector<HTMLElement>(STARTS_AT[screen]!)?.focus();
		shown.set(root, screen);
	}

	const field = root.querySelector<HTMLInputElement>('#key');
	if (field) field.value = form.typed;

	root.oninput = () => field && actions.typed(field.value);
	root.onchange = (event) => {
		const changed = event.target as HTMLInputElement;
		if (changed.id !== 'ahead') return;
		// Whatever is typed, a whole number of items within bounds.
		const items = Math.max(0, Math.min(MOST_AHEAD, Math.round(Number(changed.value)) || 0));
		// Shown as it was taken: if that is what is stored already, nothing comes back to redraw it.
		changed.value = String(items);
		actions.setLookAhead(items);
	};
	root.onsubmit = (event) => {
		event.preventDefault();
		const apiKey = field?.value.trim();
		if (apiKey) actions.connect(apiKey);
	};
	root.onclick = (event) => {
		const button = (event.target as Element).closest<HTMLElement>('[data-action]');
		if (onPackControl(button, actions)) return;
		switch (button?.dataset.action) {
			case 'pause':
				return actions.setPaused(!settings.paused);
			case 'drafts':
				return actions.setCheckDrafts(!settings.checkDrafts);
			case 'tuning':
				return actions.setTuning(!settings.tuning);
			case 'reset':
				return actions.resetCounters();
			case 'cancel':
				return actions.cancelKey();
			case 'change':
				return actions.changeKey();
			case 'remove':
				return actions.removeKey();
			case 'packs':
				return actions.go('packs');
			case 'home':
				return actions.go('home');
			case 'pick':
				return actions.pick(button.dataset.pack!);
			case 'about':
				return actions.showAbout(button.dataset.pack!);
			case 'enable':
				return actions.setEnabled(
					button.dataset.pack!,
					button.getAttribute('aria-checked') !== 'true'
				);
		}
	};
}
