import { createJev } from './real';
import { standIn } from './stand-in';
import type { Jev } from './types';

export { JevError } from './types';
export type { Jev } from './types';

/** The Jev the extension talks to: the real one, unless it was built with `WXT_STAND_IN` set. */
export const jev: Jev = import.meta.env.WXT_STAND_IN ? standIn : createJev();
