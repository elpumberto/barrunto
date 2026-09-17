import { browser } from 'wxt/browser';
import { connection, settings } from '@/storage';

const SIZES = [16, 32, 48, 128];
/** The identity's "status bad" and "status trouble", as on the light popup. */
const BADGE = { keyRejected: '#B3261E', trouble: '#9A6200' };
const paths = (suffix: string) =>
	Object.fromEntries(SIZES.map((size) => [size, `/icon/${size}${suffix}.png`]));

/** In colour while reading, grey while stopped or with no pack on, with a warning mark when the key or Jev fails. */
async function paintIcon() {
	const [{ paused, packs }, status] = await Promise.all([
		settings.getValue(),
		connection.getValue()
	]);
	const noPackOn = !Object.values(packs).some((pack) => pack.enabled);
	const stopped = paused || noPackOn || status.state === 'noKey';
	const warning =
		status.state === 'keyRejected' || status.state === 'trouble' ? BADGE[status.state] : null;

	await browser.action.setIcon({ path: paths(stopped ? '-grey' : '') });
	await browser.action.setBadgeText({ text: warning ? '!' : '' });
	if (warning) await browser.action.setBadgeBackgroundColor({ color: warning });
}

export function keepIconCurrent() {
	settings.watch(paintIcon);
	connection.watch(paintIcon);
	void paintIcon();
}
