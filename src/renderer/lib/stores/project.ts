import { writable, derived } from 'svelte/store';
import type { Instrument, KeySignature, TimeSignature, ProjectData } from '$lib/types';

export interface ProjectState {
  id: string | null;
  title: string;
  composer: string;
  filePath: string | null;
  isDirty: boolean;
  instruments: Instrument[];
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  tempo: number;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

const defaultState: ProjectState = {
  id: null,
  title: 'Untitled',
  composer: '',
  filePath: null,
  isDirty: false,
  instruments: [],
  keySignature: { fifths: 0, mode: 'major' },
  timeSignature: { beats: 4, beatType: 4 },
  tempo: 120,
  createdAt: null,
  modifiedAt: null
};

function createProjectStore() {
  const { subscribe, set, update } = writable<ProjectState>(defaultState);

  return {
    subscribe,

    new: (config: Partial<ProjectState>) => {
      const now = new Date();
      set({
        ...defaultState,
        ...config,
        id: crypto.randomUUID(),
        createdAt: now,
        modifiedAt: now,
        isDirty: false
      });
    },

    updateMetadata: (title: string, composer: string) => {
      update(state => ({
        ...state,
        title,
        composer,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    setInstruments: (instruments: Instrument[]) => {
      update(state => ({
        ...state,
        instruments,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    setKeySignature: (keySignature: KeySignature) => {
      update(state => ({
        ...state,
        keySignature,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    setTimeSignature: (timeSignature: TimeSignature) => {
      update(state => ({
        ...state,
        timeSignature,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    setTempo: (tempo: number) => {
      update(state => ({
        ...state,
        tempo,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    markSaved: (filePath: string) => {
      update(state => ({
        ...state,
        filePath,
        isDirty: false
      }));
    },

    markDirty: () => {
      update(state => ({
        ...state,
        isDirty: true,
        modifiedAt: new Date()
      }));
    },

    load: (data: ProjectData) => {
      set({
        id: data.id,
        title: data.metadata.title,
        composer: data.metadata.composer,
        filePath: null, // Will be set by caller
        isDirty: false,
        instruments: data.settings.instruments,
        keySignature: data.settings.keySignature,
        timeSignature: data.settings.timeSignature,
        tempo: data.settings.tempo,
        createdAt: new Date(data.metadata.createdAt),
        modifiedAt: new Date(data.metadata.modifiedAt)
      });
    },

    reset: () => set(defaultState)
  };
}

export const project = createProjectStore();

export const projectTitle = derived(project, $project =>
  $project.title + ($project.isDirty ? ' *' : '')
);
