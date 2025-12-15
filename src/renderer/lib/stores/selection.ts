import { writable, derived } from 'svelte/store';

export type SelectionType = 'none' | 'measure' | 'range' | 'note';

export interface SelectionState {
  type: SelectionType;
  startMeasure: number | null;
  endMeasure: number | null;
  partId: string | null;
  noteIds: string[];
  extractedXML: string | null;
}

const defaultState: SelectionState = {
  type: 'none',
  startMeasure: null,
  endMeasure: null,
  partId: null,
  noteIds: [],
  extractedXML: null
};

function createSelectionStore() {
  const { subscribe, set, update } = writable<SelectionState>(defaultState);

  return {
    subscribe,

    selectMeasure: (measure: number, partId?: string) => {
      set({
        type: 'measure',
        startMeasure: measure,
        endMeasure: measure,
        partId: partId || null,
        noteIds: [],
        extractedXML: null
      });
    },

    selectRange: (start: number, end: number, partId?: string) => {
      set({
        type: 'range',
        startMeasure: Math.min(start, end),
        endMeasure: Math.max(start, end),
        partId: partId || null,
        noteIds: [],
        extractedXML: null
      });
    },

    extendSelection: (measure: number) => {
      update(state => {
        if (state.type === 'none' || state.startMeasure === null) {
          return {
            ...state,
            type: 'measure',
            startMeasure: measure,
            endMeasure: measure
          };
        }
        return {
          ...state,
          type: 'range',
          endMeasure: measure
        };
      });
    },

    setExtractedXML: (xml: string) => {
      update(state => ({ ...state, extractedXML: xml }));
    },

    clear: () => set(defaultState)
  };
}

export const selection = createSelectionStore();

export const hasSelection = derived(selection, $selection => $selection.type !== 'none');

export const selectionLabel = derived(selection, $selection => {
  if ($selection.type === 'none') return null;
  if ($selection.type === 'measure' && $selection.startMeasure !== null) {
    return `m.${$selection.startMeasure}`;
  }
  if ($selection.type === 'range' && $selection.startMeasure !== null && $selection.endMeasure !== null) {
    return `m.${$selection.startMeasure}-${$selection.endMeasure}`;
  }
  return null;
});
