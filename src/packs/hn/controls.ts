import type { Control } from '@/engine';

export const FADE = 'fade';

export const controls: Control[] = [
	{
		id: FADE,
		title: 'Fade the noise',
		help: 'Dims comments labelled Snark or Tangent. They stay readable.',
		initial: false
	}
];
