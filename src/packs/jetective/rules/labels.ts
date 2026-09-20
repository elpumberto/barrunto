import type { Label } from '@/engine';

/**
 * What each says on hover is one short line: the catalogue of packs lists them all, and cannot scroll.
 */

/** How each judgment is painted: its word, what it says on hover, its glyph (the pack's own drawing) and its colours. */
export const labels = {
	automated: {
		text: 'Automated',
		hint: 'Posts as a program would.',
		glyph:
			'<rect x="2" y="4" width="8" height="6" rx="1.5" fill="currentColor"/><path d="M6 1.5V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="1.5" r="1" fill="currentColor"/>',
		color: '#6B7A8F',
		ink: '#FFFFFF'
	},
	scam: {
		text: 'Scam',
		hint: 'Promises money, asks for DMs.',
		glyph:
			'<path d="M6 1 11.2 10.5H.8z" fill="currentColor"/><path d="M6 4.6v2.8" stroke="var(--color, #fff)" stroke-width="1.4" stroke-linecap="round"/><circle cx="6" cy="9" r=".8" fill="var(--color, #fff)"/>',
		color: '#B3261E',
		ink: '#FFFFFF'
	},
	billboard: {
		text: 'Billboard',
		hint: 'Every post sells one thing.',
		glyph:
			'<path d="M1.5 4.5v3h2l4 2.5v-8l-4 2.5z" fill="currentColor"/><path d="M9.2 4.2a2.6 2.6 0 0 1 0 3.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
		color: '#7A4FB5',
		ink: '#FFFFFF'
	},
	farm: {
		text: 'Farm',
		hint: 'Farms likes and follows.',
		glyph:
			'<path d="M6 10.5V5.5M6 7.5C6 5.5 4.5 4.5 2 4.5c0 2 1.5 3 4 3zM6 6c0-2 1.5-3.5 4-3.5 0 2-1.5 3.5-4 3.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
		color: '#C2571A',
		ink: '#FFFFFF'
	},
	maker: {
		text: 'Maker',
		hint: 'Makes things and shows them.',
		glyph:
			'<path d="M7.6 1.2a2.9 2.9 0 0 0-2.7 3.9L1.3 8.7a1.4 1.4 0 0 0 2 2l3.6-3.6a2.9 2.9 0 0 0 3.8-3.5L8.9 5.4 7.2 4.8 6.6 3.1l1.8-1.8a2.9 2.9 0 0 0-.8-.1z" fill="currentColor"/>',
		color: '#B7791F',
		ink: '#FFFFFF'
	},
	pro: {
		text: 'Pro',
		hint: 'Knows the trade they post about.',
		glyph:
			'<rect x="1.5" y="4" width="9" height="6.5" rx="1.2" fill="currentColor"/><path d="M4.2 4V2.6c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9V4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
		color: '#1F5FA8',
		ink: '#FFFFFF'
	},
	regular: {
		text: 'Regular',
		hint: "Somebody's own account.",
		glyph:
			'<circle cx="6" cy="3.6" r="2.4" fill="currentColor"/><path d="M1.5 11a4.5 4.5 0 0 1 9 0z" fill="currentColor"/>',
		color: '#0C8468',
		ink: '#FFFFFF'
	}
} satisfies Record<string, Label>;
