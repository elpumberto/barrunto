import type { Control } from '@/engine';

export const FADE = 'fade';

export const controls: Control[] = [
	{
		id: FADE,
		title: 'Fade the noise',
		help: 'Dims Snark and Tangent comments.',
		initial: false
	}
];
