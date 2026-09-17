import { SENSITIVITIES, TREATMENTS } from '@/engine';
import type { Judgment, Pack, PackSettings, Sensitivity, Treatment } from '@/engine';
import { fold } from './redraw';
import { texts } from './texts';

// What the user can adjust of a pack: the sensitivity, which every pack has, what is done to what
// its noise judgments label, and then the pack's own controls. Everything drawn as HTML here is Barrunto's own or a pack's, constants in the
// code: nothing comes from a page.

export const toggle = (action: string, on: boolean, name: string, data = '') =>
	`<button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="${name}" data-action="${action}" ${data}></button>`;

/** A label as it goes on a page. */
export const chip = ({ text, glyph, color, ink }: Judgment['label']) =>
	`<span class="chip" style="--color:${color};--ink:${ink}"><svg viewBox="0 0 12 12" aria-hidden="true">${glyph}</svg>${text}</span>`;

/** For each noise judgment, what is done to what it labels; folded, a line that says it in brief. */
function noise(pack: Pack, chosen: PackSettings): string {
	const judgments = pack.rules.judgments.filter((j) => j.noise);
	if (!judgments.length) return '';
	const asked = (j: Judgment) => chosen.treatments[j.id]!;
	const rows = judgments.map(
		(j) =>
			`<div class="inline treatment">${chip(j.label)}<div class="stops three" role="group" aria-label="${j.label.text}">${TREATMENTS.map(
				(t) =>
					`<button type="button" data-action="treatment" data-pack="${pack.id}" data-judgment="${j.id}" data-value="${t}" aria-pressed="${t === asked(j)}">${texts.noise.treatments[t]}</button>`
			).join('')}</div></div>`
	);
	const count = (t: Treatment) => judgments.filter((j) => asked(j) === t).length;
	return fold(
		'noise',
		texts.noise.title,
		texts.noise.brief(count('fade'), count('hide')),
		rows.join('')
	);
}

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
		<div class="stops" role="group" aria-label="${texts.sensitivity.title}">${stops}</div>
		<p class="help">${texts.sensitivity.help[chosen.sensitivity]}</p>${noise(pack, chosen)}${own}`;
}

export interface PackActions {
	setSensitivity(packId: string, sensitivity: Sensitivity): void;
	setOption(packId: string, controlId: string, on: boolean): void;
	setTreatment(packId: string, judgmentId: string, treatment: Treatment): void;
}

/** Sends a click on one of a pack's controls to `actions`. Says whether the click was one of those. */
export function onPackControl(button: HTMLElement | null, actions: PackActions): boolean {
	const { action, pack, judgment, value } = button?.dataset ?? {};
	if (!pack || !value) return false;
	if (action === 'sensitivity') actions.setSensitivity(pack, value as Sensitivity);
	else if (action === 'treatment' && judgment) {
		actions.setTreatment(pack, judgment, value as Treatment);
	} else if (action === 'option') {
		actions.setOption(pack, value, button!.getAttribute('aria-checked') !== 'true');
	} else return false;
	return true;
}
