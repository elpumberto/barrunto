// The popup draws itself whole on every change, and things change under it all the time: a counter
// going up is enough. What the user had in hand must survive that: where the focus was, what they
// were typing, and which folds they had opened.

/** What has the focus inside `root`, in a form that survives a redraw. */
function focusedIn(root: HTMLElement): string | null {
	const el = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
	if (!el) return null;
	if (el.id) return `#${el.id}`;
	const { action, pack, judgment, value, fold } = el.dataset;
	// The fold's summary, which takes the focus, and not the fold around it, which cannot.
	if (fold) return `summary[data-fold="${fold}"]`;
	if (!action) return null;
	const also = (name: string, data?: string) => (data ? `[data-${name}="${data}"]` : '');
	return `[data-action="${action}"]${also('pack', pack)}${also('judgment', judgment)}${also('value', value)}`;
}

/**
 * A part that shows one line until it is opened. `brief` is what that line says besides its title.
 * Folds share a name, so opening one closes the others (Chrome does that from 120, which is the
 * least Barrunto asks for) and the popup never outgrows its window.
 */
export const fold = (name: string, title: string, brief: string, body: string) =>
	`<details class="fold" name="fold" data-fold="${name}"><summary data-fold="${name}"><span class="title">${title}</span><span class="brief">${brief}</span></summary>
		<div class="folded">${body}</div></details>`;

const drawn = new WeakMap<HTMLElement, string>();

/**
 * Draws `html` inside `root`, and leaves where they were the focus, the open folds and what is being
 * typed, caret and all. What is already drawn is not drawn again.
 */
export function redraw(root: HTMLElement, html: string): void {
	if (drawn.get(root) === html && root.firstChild) return;
	drawn.set(root, html);

	const focused = focusedIn(root);
	const typing = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
	const typed = typing && root.contains(typing) ? caretOf(typing) : null;
	const open = [...root.querySelectorAll<HTMLElement>('details[open]')].map((d) => d.dataset.fold);

	root.innerHTML = html;

	for (const name of open) {
		root
			.querySelector<HTMLDetailsElement>(`details[data-fold="${name}"]`)
			?.setAttribute('open', '');
	}
	const back = focused ? root.querySelector<HTMLElement>(focused) : null;
	back?.focus();
	if (typed && back instanceof HTMLInputElement) {
		back.value = typed.value;
		// A number field has no caret to speak of, and says so by throwing.
		try {
			back.setSelectionRange(typed.start, typed.end);
		} catch {
			// Nothing to put back.
		}
	}
}

const caretOf = (input: HTMLInputElement) => ({
	value: input.value,
	start: input.selectionStart,
	end: input.selectionEnd
});
