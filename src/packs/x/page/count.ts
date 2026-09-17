const MULTIPLIERS: [RegExp, number][] = [
	[/^(k|mil)$/i, 1e3],
	[/^(m|mill|millones|mln)$/i, 1e6],
	[/^(b|mrd)$/i, 1e9]
];

/**
 * The number in a count as X.com writes it: "412", "1,234", "1.2K", "3,4 mil", "2 M".
 * Text with no number in it counts as zero.
 */
export function parseCount(text: string): number {
	const match = text.match(/(\d[\d.,\s]*)\s*([a-z]*)/i);
	if (!match) return 0;
	const digits = match[1]!.replace(/\s/g, '');
	const multiplier = MULTIPLIERS.find(([unit]) => unit.test(match[2]!))?.[1];

	if (multiplier) return Math.round(Number(digits.replace(',', '.')) * multiplier);
	return Number(digits.replace(/[.,]/g, '')) || 0;
}
