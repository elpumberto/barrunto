import { browser } from 'wxt/browser';
import { packs } from '@/packs';
import { connection, settings } from '@/storage';
import { hasLeave } from './packs';

const SIZES = [16, 32, 48, 128];
/** The identity's "status bad" and "status trouble", as on the light popup. */
const BADGE = { bad: '#B3261E', trouble: '#9A6200' };
const paths = (suffix: string) =>
	Object.fromEntries(SIZES.map((size) => [size, `/icon/${size}${suffix}.png`]));

/**
 * In colour while reading, grey while stopped or with no pack on, with a warning mark when the key
 * or Jev fails, or when a pack the user wants on is missing their leave for its site.
 */
async function paintIcon() {
	const [{ paused, packs: chosen }, status] = await Promise.all([
		settings.getValue(),
		connection.getValue()
	]);
	const wanted = packs.filter((pack) => chosen[pack.id]?.enabled);
	const leave = await Promise.all(wanted.map(hasLeave));
	const stopped = paused || !leave.includes(true) || status.state === 'noKey';
	const warning =
		status.state === 'keyRejected'
			? BADGE.bad
			: status.state === 'trouble' || leave.includes(false)
				? BADGE.trouble
				: null;

	await browser.action.setIcon({ path: paths(stopped ? '-grey' : '') });
	await browser.action.setBadgeText({ text: warning ? '!' : '' });
	if (warning) await browser.action.setBadgeBackgroundColor({ color: warning });
}

export function keepIconCurrent() {
	const repaint = () => void paintIcon().catch((error) => console.error('[barrunto] icon', error));
	settings.watch(repaint);
	connection.watch(repaint);
	browser.permissions.onAdded.addListener(repaint);
	browser.permissions.onRemoved.addListener(repaint);
	repaint();
}
