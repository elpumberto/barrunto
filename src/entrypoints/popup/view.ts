import { packSettingsOf } from '@/engine';
import type { Pack } from '@/engine';
import type { KeyFailure } from '@/messages';
// The types alone, and not `@/storage`: drawing the popup needs no Chrome, and so its tests need none either.
import type { ConnectionStatus, Counters, Settings } from '@/storage/types';
import { focusedIn, onPackControl, packControls, toggle } from '@/ui/pack-controls';
import type { PackActions } from '@/ui/pack-controls';
import eyebrow from '@/assets/icon.svg?raw';
import wordmark from '@/assets/wordmark.svg?raw';
import { texts } from './texts';

/** Everything the popup shows. The stored part comes from storage; the key form's part is the popup's own. */
export interface PopupState {
	connection: ConnectionStatus;
	settings: Settings;
	/** The pack that acts on the page the popup was opened over, if one does and Barrunto can tell. */
	pack: Pack | null;
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
	resetCounters(): void;
	openPacks(): void;
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
	if (form.failure === 'keyRejected' || connection.state === 'keyRejected') {
		return ['bad', texts.status.keyRejected];
	}
	if (connection.state === 'noKey') return ['', texts.status.noKey];
	if (connection.state === 'trouble') return ['warn', texts.status.trouble];
	if (settings.paused) return ['', texts.status.paused];
	return ['good', texts.status.connected];
}

function head(state: PopupState): string {
	const [dot, word] = statusOf(state);
	return `<header class="head"><span class="icon">${eyebrow}</span><span class="wordmark" role="img" aria-label="Barrunto">${wordmark}</span>
		<span class="status"><span class="dot ${dot}"></span>${word}</span></header>`;
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

/** The controls of the pack that acts on this page, while it is on; or where to go to turn one on. */
function packRow({ settings, pack }: PopupState): string {
	const chosen = pack && packSettingsOf(pack, settings.packs[pack.id]);
	if (pack && chosen?.enabled) {
		return `<section class="row"><div class="eyebrow">${pack.name}</div>${packControls(pack, chosen)}</section>`;
	}
	const anyOn = Object.values(settings.packs).some((p) => p.enabled);
	return `<section class="row"><p class="${anyOn ? 'help' : 'warning'}">${anyOn ? texts.packs.notHere : texts.packs.noneOn}</p></section>`;
}

function working(state: PopupState): string {
	const { connection, settings, session, total, keyTail } = state;
	const reading = settings.paused ? texts.reading.off : texts.reading.on;
	const counter = (name: string, key: keyof Counters) =>
		`<tr><td>${name}</td><td>${compact(session[key])}</td><td>${compact(total[key])}</td></tr>`;
	return `${connection.state === 'trouble' ? `<p class="band">${texts.trouble[connection.reason]}</p>` : ''}
	<section class="row inline"><div><div class="title">${reading.title}</div><p class="help">${reading.help}</p></div>
		${toggle('pause', !settings.paused, texts.reading.on.title)}</section>
	${packRow(state)}
	<section class="row"><table class="counters">
		<tr><th></th><th>${texts.counters.session}</th><th>${texts.counters.total}</th></tr>
		${counter(texts.counters.items, 'items')}${counter(texts.counters.tokensIn, 'tokensIn')}${counter(texts.counters.tokensOut, 'tokensOut')}</table>
		<button class="link end" type="button" data-action="reset">${texts.counters.reset}</button></section>
	<section class="row"><div class="key"><span>Key ts_••••••${escapeHtml(keyTail)}</span>
		<button class="link" type="button" data-action="change">${texts.key.change}</button>
		<button class="link" type="button" data-action="remove">${texts.key.remove}</button></div></section>
	<section class="row inline"><div><div class="title">${texts.tuning.title}</div><p class="help">${texts.tuning.help}</p></div>
		${toggle('tuning', settings.tuning, texts.tuning.title)}</section>
	<section class="row"><button class="link" type="button" data-action="packs">${texts.packs.open}</button></section>`;
}

/**
 * Draws the popup for this state inside `root`, and sends what the user does to `actions`.
 * Everything drawn as HTML is Barrunto's own or a pack's (texts and drawings) except the key's
 * tail, which is escaped; what is typed goes in as the field's value, never as HTML.
 */
export function renderPopup(root: HTMLElement, state: PopupState, actions: PopupActions): void {
	const { connection, settings, form } = state;
	const needsKey = connection.state === 'noKey' || connection.state === 'keyRejected';
	const focused = focusedIn(root);
	root.innerHTML =
		head(state) + (needsKey || form.open ? keyForm(state, !needsKey) : working(state));

	const field = root.querySelector<HTMLInputElement>('#key');
	if (field) field.value = form.typed;
	if (focused) root.querySelector<HTMLElement>(focused)?.focus();

	root.oninput = () => field && actions.typed(field.value);
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
				return actions.openPacks();
		}
	};
}
