import type { PageHalf } from '@/engine';
import { page as hn } from './hn/page';
import { page as x } from './x/page';

/** The half of each pack that runs inside the page, by pack id. Only the content script takes this. */
export const pages: Record<string, PageHalf> = { x, hn };
