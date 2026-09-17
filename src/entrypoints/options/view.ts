import { packSettingsOf } from '@/engine';
import type { Label, Pack } from '@/engine';
// The types alone, and not `@/storage`: drawing the page needs no Chrome, and so its tests need none either.
import type { ConnectionStatus, Settings } from '@/storage/types';
import eyebrow from '@/assets/icon.svg?raw';
import wordmark from '@/assets/wordmark.svg?raw';
import { onPackControl, packControls, toggle } from '@/ui/pack-controls';
import type { PackActions } from '@/ui/pack-controls';
import { redraw } from '@/ui/redraw';
import { texts } from './texts';

export interface OptionsState {
	packs: Pack[];
	settings: Settings;
	connection: ConnectionStatus;
	/** The pack Chrome refused leave for, the last time one was turned on. */
	refused: string | null;
}

export interface OptionsActions extends PackActions {
	setEnabled(packId: string, on: boolean): void;
}

/** A label as it hangs on a page, with what it means next to it. */
const legend = ({ text, hint, glyph, color, ink }: Label) =>
	`<li><span class="chip" style="--color:${color};--ink:${ink}"><svg viewBox="0 0 12 12" aria-hidden="true">${glyph}</svg>${text}</span><span class="help">${hint}</span></li>`;

/** `https://x.com/*` reads better as `x.com`. */
const siteName = (site: string) => site.replace(/^[^/]*\/\/|\/\*$/g, '');

function card(pack: Pack, { settings, refused }: OptionsState): string {
	const chosen = packSettingsOf(pack, settings.packs[pack.id]);
	return `<section class="card" data-pack="${pack.id}">
		<div class="inline"><div><h2>${pack.name}</h2>
			<p class="help">${texts.actsOn} <span class="site">${pack.sites.map(siteName).join(', ')}</span></p></div>
			${toggle('enable', chosen.enabled, texts.on(pack.name), `data-pack="${pack.id}"`)}</div>
		<p>${pack.description}</p>
		${refused === pack.id ? `<p class="failure">${texts.refused}</p>` : ''}
		<ul class="legend" aria-label="${texts.labels}">${pack.rules.judgments.map((j) => legend(j.label)).join('')}</ul>
		${chosen.enabled ? `<div class="controls">${packControls(pack, chosen)}</div>` : ''}
	</section>`;
}

/**
 * Draws the packs page for this state inside `root`, and sends what the user does to `actions`.
 * Everything drawn as HTML is Barrunto's own or a pack's, constants in the code.
 */
export function renderOptions(
	root: HTMLElement,
	state: OptionsState,
	actions: OptionsActions
): void {
	const html = `<header class="head"><span class="icon">${eyebrow}</span><span class="wordmark" role="img" aria-label="Barrunto">${wordmark}</span>
			<span class="status">${texts.title}</span></header>
		<p class="intro">${texts.intro}</p>
		${state.connection.state === 'noKey' ? `<p class="band">${texts.noKey}</p>` : ''}
		${state.packs.map((pack) => card(pack, state)).join('')}
		<p class="help">${texts.reload}</p>`;
	redraw(root, html);

	root.onclick = (event) => {
		const button = (event.target as Element).closest<HTMLElement>('[data-action]');
		if (onPackControl(button, actions)) return;
		const { action, pack } = button?.dataset ?? {};
		if (action === 'enable' && pack) {
			actions.setEnabled(pack, button!.getAttribute('aria-checked') !== 'true');
		}
	};
}
