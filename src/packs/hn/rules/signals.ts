import type { PageSignal } from '@/engine';
import type { Comment } from '../comment';

/** Room to say something: nothing up to 200 characters, everything from 800. */
const length: PageSignal<Comment> = {
	id: 'length',
	name: 'length',
	from: ({ text }) => (text.length - 200) / 600
};

export const signals: PageSignal<Comment>[] = [length];
