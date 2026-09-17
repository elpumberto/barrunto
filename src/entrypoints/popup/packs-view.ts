import { packSettingsOf } from '@/engine';
import type { Label, Pack } from '@/engine';
import { toggle } from './pack-controls';
import type { PopupState } from './view';
import { texts } from './texts';

// The catalogue: which packs there are, what each does and whether it is on. How a pack is adjusted
// is not here but in the home view, over a page of that pack, where what it does is in sight.

/** A label as it goes on a page, with what it means next to it. */
const legend = ({ text, hint, glyph, color, ink }: Label) =>
	`<li><span class="chip" style="--color:${color};--ink:${ink}"><svg viewBox="0 0 12 12" aria-hidden="true">${glyph}</svg>${text}</span><span class="help">${hint}</span></li>`;

/** `https://x.com/*` reads better as `x.com`. */
export const siteName = (site: string) => site.replace(/^[^/]*\/\/|\/\*$/g, '');

function entry(pack: Pack, { settings, about }: PopupState): string {
	const { enabled } = packSettingsOf(pack, settings.packs[pack.id]);
	const open = about === pack.id;
	return `<section class="row pack" data-pack="${pack.id}"><div class="inline">
			<button class="more" type="button" data-action="about" data-pack="${pack.id}" aria-expanded="${open}">
				<span class="title">${pack.name}</span><span class="site">${pack.sites.map(siteName).join(', ')}</span></button>
			${toggle('enable', enabled, texts.packs.on(pack.name), `data-pack="${pack.id}"`)}</div>
		${open ? `<p>${pack.description}</p><ul class="legend">${pack.rules.judgments.map((j) => legend(j.label)).join('')}</ul>` : ''}
	</section>`;
}

export function packsView(state: PopupState): string {
	return `<nav class="back"><button class="link" type="button" data-action="home">← ${texts.packs.back}</button>
			<span class="eyebrow">${texts.packs.open}</span></nav>
		${state.packs.map((pack) => entry(pack, state)).join('')}
		<p class="row help">${texts.packs.leave}</p>`;
}
