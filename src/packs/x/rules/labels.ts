import type { Label } from '@/engine';

/** How each judgment is painted: its word, what it says on hover, its glyph (the pack's own drawing) and its colours. */
export const labels = {
	bait: {
		text: 'Bait',
		hint: 'Made to farm reactions or followers, adds little.',
		glyph:
			'<path d="M8 1v6.2a2.8 2.8 0 1 1-5.6 0V6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
		color: '#F2B632',
		ink: '#1B1300'
	},
	flame: {
		text: 'Flame',
		hint: 'Picking a fight, or already causing one.',
		glyph:
			'<path d="M6 .5c.4 2.2 3.5 3.6 3.5 6.6A3.5 3.5 0 0 1 6 11.5 3.5 3.5 0 0 1 2.5 7.1c0-1.3.7-2.2 1.4-2.9.2 1 .7 1.5 1.2 1.6C4.9 3.9 5.2 2 6 .5z" fill="currentColor"/>',
		color: '#D63B2D',
		ink: '#FFFFFF'
	},
	signal: {
		text: 'Signal',
		hint: 'Worth the time: there is something in it to take away.',
		glyph:
			'<circle cx="6" cy="6" r="1.3" fill="currentColor"/><path d="M3.2 3.2a4 4 0 0 0 0 5.6M8.8 3.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
		color: '#0C8468',
		ink: '#FFFFFF'
	}
} satisfies Record<string, Label>;
