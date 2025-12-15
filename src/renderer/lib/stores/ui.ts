import { writable } from 'svelte/store';

export type ViewType = 'welcome' | 'setup' | 'editor';

export const currentView = writable<ViewType>('welcome');
export const backendStatus = writable<boolean>(false);
export const isLoading = writable<boolean>(false);
export const errorMessage = writable<string | null>(null);

// Panel visibility
export const showChatPanel = writable<boolean>(true);
export const chatPanelWidth = writable<number>(350);

// Score zoom level (percentage)
export const scoreZoom = writable<number>(100);

// Modal state
export const activeModal = writable<string | null>(null);
