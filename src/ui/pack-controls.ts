import { SENSITIVITIES } from '@/engine';
import type { Pack, PackSettings, Sensitivity } from '@/engine';
import { texts } from './texts';

// What the user can adjust of a pack, drawn the same in the popup and in the packs page: the
// sensitivity, which every pack has, and then the pack's own controls. Everything drawn as HTML
// here is Barrunto's own or a pack's, constants in the code: nothing comes from a page.

export const toggle = (action: string, on: boolean, name: string, data = '') =>
	`<button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="${name}" data-action="${action}" ${data}></button>`;

export function packControls(pack: Pack, chosen: PackSettings): string {
	const of = `data-pack="${pack.id}"`;
	const stops = SENSITIVITIES.map(
		(s) =>
			`<button type="button" data-action="sensitivity" ${of} data-value="${s}" aria-pressed="${s === chosen.sensitivity}">${texts.sensitivity.stops[s]}</button>`
	).join('');
	const own = pack.controls
		.map(
			(control) =>
				`<div class="inline"><div><div class="title">${control.title}</div><p class="help">${control.help}</p></div>
				${toggle('option', chosen.options[control.id] ?? control.initial, control.title, `${of} data-value="${control.id}"`)}</div>`
		)
		.join('');
	return `<div class="title">${texts.sensitivity.title}</div>
		<div class="stops">${stops}</div>
		<p class="help">${texts.sensitivity.help[chosen.sensitivity]}</p>${own}`;
}

export interface PackActions {
	setSensitivity(packId: string, sensitivity: Sensitivity): void;
	setOption(packId: string, controlId: string, on: boolean): void;
}

/** Sends a click on one of a pack's controls to `actions`. Says whether the click was one of those. */
export function onPackControl(button: HTMLElement | null, actions: PackActions): boolean {
	const { action, pack, value } = button?.dataset ?? {};
	if (!pack || !value) return false;
	if (action === 'sensitivity') actions.setSensitivity(pack, value as Sensitivity);
	else if (action === 'option') {
		actions.setOption(pack, value, button!.getAttribute('aria-checked') !== 'true');
	} else return false;
	return true;
}

/** What has the focus inside `root`, in a form that survives a redraw. */
export function focusedIn(root: HTMLElement): string | null {
	const el = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
	if (!el) return null;
	if (el.id) return `#${el.id}`;
	const { action, pack, value } = el.dataset;
	if (!action) return null;
	return `[data-action="${action}"]${pack ? `[data-pack="${pack}"]` : ''}${value ? `[data-value="${value}"]` : ''}`;
}
