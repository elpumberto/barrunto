import { SENSITIVITIES } from '@/engine';
import type { Judgment, Sensitivity } from '@/engine';
import type { Ground } from '@/packs/x/page';
import labelsCss from './labels.css?inline';
import type { Tuning } from './tuning';
import tuningCss from './tuning.css?inline';

const MARK = 'data-barrunto';
const SVG = 'http://www.w3.org/2000/svg';

/** The piece of page Barrunto owns inside `parent`, sealed from X.com's styling. Made on first use. */
function shadowIn(parent: HTMLElement, kind: string, css: string): ShadowRoot {
	const found = parent.querySelector<HTMLElement>(`:scope > [${MARK}="${kind}"]`);
	if (found?.shadowRoot) return found.shadowRoot;

	const host = document.createElement('div');
	host.setAttribute(MARK, kind);
	const root = host.attachShadow({ mode: 'open' });
	const style = document.createElement('style');
	style.textContent = css;
	root.append(style);
	parent.append(host);
	return root;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function labelNode(judgment: Judgment, arrive: boolean): HTMLElement {
	const { text, hint, glyph, color, ink } = judgment.label;
	const label = el('span', arrive ? 'label arrive' : 'label');
	label.dataset.id = judgment.id;
	label.title = `${text}: ${hint} A hunch, not a verdict.`;
	label.style.setProperty('--color', color);
	label.style.setProperty('--ink', ink);

	const svg = document.createElementNS(SVG, 'svg');
	svg.setAttribute('viewBox', '0 0 12 12');
	svg.setAttribute('aria-hidden', 'true');
	// The glyph is the pack's own drawing, a constant in its code: nothing read from the page gets here.
	svg.innerHTML = glyph;

	const card = el('span', 'card');
	card.append(svg, text);
	label.append(el('i', 'string'), card);

	// Once it has dropped in, it must not drop in again each time the labels are put back in order.
	label.addEventListener('animationend', () => label.classList.remove('arrive'), { once: true });
	// A click on the label is not a click on the post.
	label.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	return label;
}

/**
 * Leaves hanging from the post exactly the labels of these judgments, in this order.
 * Those already up stay as they are, those no longer wanted go at once, new ones drop in.
 */
export function paintLabels(post: HTMLElement, judgments: Judgment[], arrive = true): void {
	if (getComputedStyle(post).position === 'static') post.style.position = 'relative';
	const root = shadowIn(post, 'labels', labelsCss);

	const up = new Map<string, HTMLElement>();
	for (const node of root.querySelectorAll<HTMLElement>('.label')) {
		if (node.dataset.id) up.set(node.dataset.id, node);
	}
	const wanted = judgments.map((j) => up.get(j.id) ?? labelNode(j, arrive));
	for (const node of up.values()) if (!wanted.includes(node)) node.remove();
	root.append(...wanted);
}

function bar(value: number, ticks?: { thresholds: Judgment['thresholds']; current: Sensitivity }) {
	const node = el('span', 'bar');
	const fill = el('span', 'fill');
	fill.style.width = `${value * 100}%`;
	node.append(fill);
	for (const position of ticks ? SENSITIVITIES : []) {
		const tick = el('span', position === ticks!.current ? 'tick current' : 'tick');
		tick.style.left = `${ticks!.thresholds[position] * 100}%`;
		node.append(tick);
	}
	return node;
}

/** What an ingredient put in is shown from this much. */
const WORTH_SHOWING = 0.01;

const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)}`;

export function clearTuning(anchor: HTMLElement): void {
	anchor.querySelector(`:scope > [${MARK}="tuning"]`)?.remove();
}

/** Puts the tuning detail at the end of `anchor`, in place of the one there. */
export function paintTuning(anchor: HTMLElement, tuning: Tuning, ground: Ground): void {
	const root = shadowIn(anchor, 'tuning', tuningCss);
	(root.host as HTMLElement).dataset.ground = ground;
	root.querySelector('.box')?.remove();

	const box = el('div', 'box');
	root.append(box);
	if (!tuning.analyzed) {
		box.textContent = `not analyzed: ${tuning.reason}`;
		return;
	}

	const inputs = el('div', 'traits');
	for (const input of tuning.inputs) {
		const row = el('div', 'row');
		row.append(
			el('span', '', input.isSignal ? `${input.name}*` : input.name),
			bar(input.value),
			el('span', '', input.value.toFixed(2))
		);
		inputs.append(row);
	}

	const judgments = el('div', 'judgments');
	for (const { judgment, strength, labelled, parts } of tuning.judgments) {
		const row = el('div', labelled ? 'row up' : 'row');
		row.style.setProperty('--color', judgment.label.color);
		const said = parts
			.filter((p) => Math.abs(p.amount) >= WORTH_SHOWING)
			.map((p) => `${p.name} ${signed(p.amount)}`)
			.join(' · ');
		row.append(
			el('span', '', `${labelled ? '●' : '○'} ${judgment.label.text}`),
			bar(strength, { thresholds: judgment.thresholds, current: tuning.sensitivity }),
			el('span', '', strength.toFixed(2)),
			el('span', 'parts', said)
		);
		judgments.append(row);
	}

	box.append(
		inputs,
		judgments,
		el(
			'span',
			'',
			`* page signal, no model · answers count past ${tuning.doubt.toFixed(2)} · ticks: low, medium, high and ultra thresholds`
		)
	);
}
