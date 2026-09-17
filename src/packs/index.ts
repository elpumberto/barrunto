import type { Pack } from '@/engine';
import { pack as hn } from './hn';
import { pack as x } from './x';

/** The packs Barrunto ships with, in the order they are shown. None of this touches a page. */
export const packs: Pack[] = [x, hn];

export const packById = (id: string): Pack | undefined => packs.find((pack) => pack.id === id);
