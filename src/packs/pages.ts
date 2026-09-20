import type { CardHalf, PageHalf } from '@/engine';
import { page as hn } from './hn/page';
import { page as jetective } from './jetective/page';
import { page as x } from './x/page';

// The half of each pack that runs inside the page, by pack id. Only the content script takes these.

/** The ones that read many items on a page and hang labels on them. */
export const pages: Record<string, PageHalf> = { x, hn };

/** The ones that read one thing per page and show a card about it. */
export const cards: Record<string, CardHalf> = { jetective };
