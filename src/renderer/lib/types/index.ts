// Instrument types
export interface Instrument {
  id: string;
  name: string;
  abbreviation: string;
  midiProgram: number;
  category: InstrumentCategory;
  clef: 'treble' | 'bass' | 'alto' | 'tenor';
  transposition?: number; // semitones from concert pitch
}

export type InstrumentCategory =
  | 'keyboards'
  | 'strings'
  | 'woodwinds'
  | 'brass'
  | 'percussion'
  | 'voices';

// Musical notation types
export interface KeySignature {
  fifths: number; // -7 to 7 (Cb to C#)
  mode: 'major' | 'minor';
}

export interface TimeSignature {
  beats: number;
  beatType: number; // 1, 2, 4, 8, 16
}

// Project file format
export interface ProjectData {
  version: string;
  id: string;
  metadata: {
    title: string;
    composer: string;
    createdAt: string;
    modifiedAt: string;
  };
  settings: {
    keySignature: KeySignature;
    timeSignature: TimeSignature;
    tempo: number;
    instruments: Instrument[];
  };
  score: {
    musicXML: string;
  };
  chatHistory: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
  audioFiles: {
    id: string;
    filename: string;
    transcription?: string;
  }[];
}

// API types
export interface ChatRequest {
  message: string;
  currentScore?: string;
  selectedMeasures?: string;
  selectionInfo?: {
    startMeasure: number;
    endMeasure: number;
    partId?: string;
  };
}

export interface ChatResponse {
  text: string;
  musicxml?: string;
  valid?: boolean;
  validationError?: string;
}

export interface GenerateRequest {
  description: string;
  instruments: Instrument[];
  key: string;
  timeSignature: { beats: number; beatType: number };
  tempo: number;
  measures: number;
}

// Predefined instruments
export const INSTRUMENTS: Record<InstrumentCategory, Instrument[]> = {
  keyboards: [
    { id: 'piano', name: 'Piano', abbreviation: 'Pno.', midiProgram: 0, category: 'keyboards', clef: 'treble' },
    { id: 'organ', name: 'Organ', abbreviation: 'Org.', midiProgram: 19, category: 'keyboards', clef: 'treble' },
    { id: 'harpsichord', name: 'Harpsichord', abbreviation: 'Hpsd.', midiProgram: 6, category: 'keyboards', clef: 'treble' }
  ],
  strings: [
    { id: 'violin', name: 'Violin', abbreviation: 'Vln.', midiProgram: 40, category: 'strings', clef: 'treble' },
    { id: 'viola', name: 'Viola', abbreviation: 'Vla.', midiProgram: 41, category: 'strings', clef: 'alto' },
    { id: 'cello', name: 'Cello', abbreviation: 'Vc.', midiProgram: 42, category: 'strings', clef: 'bass' },
    { id: 'double-bass', name: 'Double Bass', abbreviation: 'Cb.', midiProgram: 43, category: 'strings', clef: 'bass' },
    { id: 'guitar', name: 'Guitar', abbreviation: 'Gtr.', midiProgram: 24, category: 'strings', clef: 'treble' },
    { id: 'harp', name: 'Harp', abbreviation: 'Hp.', midiProgram: 46, category: 'strings', clef: 'treble' }
  ],
  woodwinds: [
    { id: 'flute', name: 'Flute', abbreviation: 'Fl.', midiProgram: 73, category: 'woodwinds', clef: 'treble' },
    { id: 'oboe', name: 'Oboe', abbreviation: 'Ob.', midiProgram: 68, category: 'woodwinds', clef: 'treble' },
    { id: 'clarinet', name: 'Clarinet in Bb', abbreviation: 'Cl.', midiProgram: 71, category: 'woodwinds', clef: 'treble', transposition: -2 },
    { id: 'bassoon', name: 'Bassoon', abbreviation: 'Bsn.', midiProgram: 70, category: 'woodwinds', clef: 'bass' },
    { id: 'saxophone-alto', name: 'Alto Saxophone', abbreviation: 'A.Sax', midiProgram: 65, category: 'woodwinds', clef: 'treble', transposition: -9 }
  ],
  brass: [
    { id: 'trumpet', name: 'Trumpet in Bb', abbreviation: 'Tpt.', midiProgram: 56, category: 'brass', clef: 'treble', transposition: -2 },
    { id: 'horn', name: 'Horn in F', abbreviation: 'Hn.', midiProgram: 60, category: 'brass', clef: 'treble', transposition: -7 },
    { id: 'trombone', name: 'Trombone', abbreviation: 'Tbn.', midiProgram: 57, category: 'brass', clef: 'bass' },
    { id: 'tuba', name: 'Tuba', abbreviation: 'Tba.', midiProgram: 58, category: 'brass', clef: 'bass' }
  ],
  percussion: [
    { id: 'timpani', name: 'Timpani', abbreviation: 'Timp.', midiProgram: 47, category: 'percussion', clef: 'bass' },
    { id: 'snare', name: 'Snare Drum', abbreviation: 'S.D.', midiProgram: 0, category: 'percussion', clef: 'treble' },
    { id: 'cymbals', name: 'Cymbals', abbreviation: 'Cym.', midiProgram: 0, category: 'percussion', clef: 'treble' },
    { id: 'xylophone', name: 'Xylophone', abbreviation: 'Xyl.', midiProgram: 13, category: 'percussion', clef: 'treble' }
  ],
  voices: [
    { id: 'soprano', name: 'Soprano', abbreviation: 'S.', midiProgram: 52, category: 'voices', clef: 'treble' },
    { id: 'alto', name: 'Alto', abbreviation: 'A.', midiProgram: 52, category: 'voices', clef: 'treble' },
    { id: 'tenor', name: 'Tenor', abbreviation: 'T.', midiProgram: 52, category: 'voices', clef: 'treble' },
    { id: 'bass-voice', name: 'Bass', abbreviation: 'B.', midiProgram: 52, category: 'voices', clef: 'bass' }
  ]
};

// Key signature helpers
export const KEY_SIGNATURES: { fifths: number; major: string; minor: string }[] = [
  { fifths: -7, major: 'Cb', minor: 'Ab' },
  { fifths: -6, major: 'Gb', minor: 'Eb' },
  { fifths: -5, major: 'Db', minor: 'Bb' },
  { fifths: -4, major: 'Ab', minor: 'F' },
  { fifths: -3, major: 'Eb', minor: 'C' },
  { fifths: -2, major: 'Bb', minor: 'G' },
  { fifths: -1, major: 'F', minor: 'D' },
  { fifths: 0, major: 'C', minor: 'A' },
  { fifths: 1, major: 'G', minor: 'E' },
  { fifths: 2, major: 'D', minor: 'B' },
  { fifths: 3, major: 'A', minor: 'F#' },
  { fifths: 4, major: 'E', minor: 'C#' },
  { fifths: 5, major: 'B', minor: 'G#' },
  { fifths: 6, major: 'F#', minor: 'D#' },
  { fifths: 7, major: 'C#', minor: 'A#' }
];

export function getKeyName(fifths: number, mode: 'major' | 'minor'): string {
  const key = KEY_SIGNATURES.find(k => k.fifths === fifths);
  if (!key) return 'C';
  return mode === 'major' ? key.major : key.minor;
}
