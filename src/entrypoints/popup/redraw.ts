// The popup draws itself whole on every change. What the user had in hand must
// survive that: where the focus was, and which folds they had opened.

/** What has the focus inside `root`, in a form that survives a redraw. */
function focusedIn(root: HTMLElement): string | null {
	const el = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
	if (!el) return null;
	if (el.id) return `#${el.id}`;
	const { action, pack, value, fold } = el.dataset;
	if (fold) return `[data-fold="${fold}"]`;
	if (!action) return null;
	return `[data-action="${action}"]${pack ? `[data-pack="${pack}"]` : ''}${value ? `[data-value="${value}"]` : ''}`;
}

/** A part that shows one line until it is opened. `brief` is what that line says besides its title. */
export const fold = (name: string, title: string, brief: string, body: string) =>
	`<details class="fold" data-fold="${name}"><summary data-fold="${name}"><span class="title">${title}</span><span class="brief">${brief}</span></summary>
		<div class="folded">${body}</div></details>`;

/** Draws `html` inside `root`, and leaves the focus and the open folds where they were. */
export function redraw(root: HTMLElement, html: string): void {
	const focused = focusedIn(root);
	const open = [...root.querySelectorAll<HTMLElement>('details[open]')].map((d) => d.dataset.fold);
	root.innerHTML = html;
	for (const name of open) {
		root
			.querySelector<HTMLDetailsElement>(`details[data-fold="${name}"]`)
			?.setAttribute('open', '');
	}
	if (focused) root.querySelector<HTMLElement>(focused)?.focus();
}
