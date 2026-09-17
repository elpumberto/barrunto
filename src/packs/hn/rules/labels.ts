import type { Label } from '@/engine';

/** How each judgment is painted: its word, what it says on hover, its glyph (the pack's own drawing) and its colours. */
export const labels = {
	insight: {
		text: 'Insight',
		hint: 'Knows the subject, or was there: something to learn from it.',
		glyph:
			'<path d="M6 .8 7.4 4.6 11.2 6 7.4 7.4 6 11.2 4.6 7.4.8 6l3.8-1.4z" fill="currentColor"/>',
		color: '#0C8468',
		ink: '#FFFFFF'
	},
	snark: {
		text: 'Snark',
		hint: 'A sneer or a put-down, with no reasons behind it.',
		glyph: '<path d="M7.2.8 2.6 6.8h2.9l-.9 4.4 4.8-6.2H6.4z" fill="currentColor"/>',
		color: '#D63B2D',
		ink: '#FFFFFF'
	},
	tangent: {
		text: 'Tangent',
		hint: 'About the title, the site or something else altogether, not the subject.',
		glyph:
			'<path d="M1.2 9.6h3.6c2.2 0 3-1.1 3.6-2.6l1.4-3.8M7.6 2.6l2.4.4-.5 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
		color: '#5A6A8A',
		ink: '#FFFFFF'
	}
} satisfies Record<string, Label>;
