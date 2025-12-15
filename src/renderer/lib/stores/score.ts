import { writable, derived } from 'svelte/store';

export interface ScoreInfo {
  title: string | null;
  composer: string | null;
  parts: { id: string; name: string }[];
  measureCount: number;
  keySignature: string | null;
  timeSignature: string | null;
}

export interface ScoreState {
  musicXML: string | null;
  pendingMusicXML: string | null; // Preview changes before accepting
  parsedInfo: ScoreInfo | null;
  isLoading: boolean;
  validationError: string | null;
  renderKey: number; // Used to force OSMD re-render
  composingMeasures: number; // Live composing progress
}

const defaultState: ScoreState = {
  musicXML: null,
  pendingMusicXML: null,
  parsedInfo: null,
  isLoading: false,
  validationError: null,
  renderKey: 0,
  composingMeasures: 0
};

function createScoreStore() {
  const { subscribe, set, update } = writable<ScoreState>(defaultState);

  return {
    subscribe,

    setMusicXML: (xml: string, info?: ScoreInfo) => {
      update(state => ({
        ...state,
        musicXML: xml,
        parsedInfo: info || null,
        validationError: null,
        renderKey: state.renderKey + 1
      }));
    },

    setLoading: (loading: boolean) => {
      update(state => ({ ...state, isLoading: loading }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, validationError: error }));
    },

    updateInfo: (info: Partial<ScoreInfo>) => {
      update(state => ({
        ...state,
        parsedInfo: state.parsedInfo ? { ...state.parsedInfo, ...info } : null
      }));
    },

    forceRerender: () => {
      update(state => ({ ...state, renderKey: state.renderKey + 1 }));
    },

    // Set pending changes for preview (not applied yet)
    setPendingMusicXML: (xml: string, measures?: number) => {
      update(state => ({
        ...state,
        pendingMusicXML: xml,
        composingMeasures: measures ?? state.composingMeasures,
        renderKey: state.renderKey + 1
      }));
    },

    // Update composing progress
    setComposingMeasures: (count: number) => {
      update(state => ({ ...state, composingMeasures: count }));
    },

    // Accept pending changes - make them the current score
    acceptPending: () => {
      update(state => {
        if (state.pendingMusicXML) {
          return {
            ...state,
            musicXML: state.pendingMusicXML,
            pendingMusicXML: null,
            composingMeasures: 0,
            renderKey: state.renderKey + 1
          };
        }
        return state;
      });
    },

    // Decline pending changes - discard them
    declinePending: () => {
      update(state => ({
        ...state,
        pendingMusicXML: null,
        composingMeasures: 0,
        renderKey: state.renderKey + 1
      }));
    },

    // Check if there are pending changes
    hasPending: () => {
      let result = false;
      update(state => {
        result = state.pendingMusicXML !== null;
        return state;
      });
      return result;
    },

    reset: () => set(defaultState)
  };
}

export const score = createScoreStore();

export const hasMusicXML = derived(score, $score => $score.musicXML !== null);
export const hasPendingChanges = derived(score, $score => $score.pendingMusicXML !== null);
export const isComposing = derived(score, $score => $score.composingMeasures !== 0); // -1 = engraving, >0 = composing
export const composingMeasures = derived(score, $score => $score.composingMeasures);
export const displayMusicXML = derived(score, $score => $score.pendingMusicXML || $score.musicXML);
export const measureCount = derived(score, $score => $score.parsedInfo?.measureCount || 0);
