import { storage } from 'wxt/utils/storage';
import type { Counters, Settings } from './types';

// Local storage stays in this browser and survives closing it. The key is in it, so the background
// closes it to the X.com page's content script, which must not so much as load this file:
// an item looks itself up as soon as it is defined.

export const defaultSettings: Settings = { paused: false, sensitivity: 'medium', tuning: false };
export const noCounters: Counters = { posts: 0, tokensIn: 0, tokensOut: 0 };

export const apiKey = storage.defineItem<string | null>('local:key', {
	fallback: null,
	version: 1
});

export const settings = storage.defineItem<Settings>('local:settings', {
	fallback: defaultSettings,
	version: 1
});

export const totalCounters = storage.defineItem<Counters>('local:totalCounters', {
	fallback: noCounters,
	version: 1
});
