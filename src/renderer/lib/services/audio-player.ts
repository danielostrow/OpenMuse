/**
 * Simple MusicXML audio player using Web Audio API
 */

interface NoteEvent {
  pitch: number; // MIDI pitch
  startTime: number; // in seconds
  duration: number; // in seconds
  velocity: number;
}

type PlaybackState = 'stopped' | 'playing' | 'paused';

class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private scheduledEvents: number[] = []; // setTimeout IDs
  private _state: PlaybackState = 'stopped';
  private _currentTime = 0;
  private _duration = 0;
  private startTimestamp = 0;
  private pausedAt = 0;
  private onStateChange: ((state: PlaybackState) => void) | null = null;
  private onTimeUpdate: ((time: number) => void) | null = null;

  get state(): PlaybackState {
    return this._state;
  }

  get currentTime(): number {
    if (this._state === 'playing' && this.audioContext) {
      return (this.audioContext.currentTime - this.startTimestamp) + this.pausedAt;
    }
    return this._currentTime;
  }

  get duration(): number {
    return this._duration;
  }

  setCallbacks(onStateChange: (state: PlaybackState) => void, onTimeUpdate: (time: number) => void) {
    this.onStateChange = onStateChange;
    this.onTimeUpdate = onTimeUpdate;
  }

  private setState(state: PlaybackState) {
    this._state = state;
    this.onStateChange?.(state);
  }

  private initAudio() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.3;
      this.gainNode.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Parse MusicXML and extract note events
   */
  parseMusicXML(xml: string): NoteEvent[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const events: NoteEvent[] = [];

    // Get divisions (ticks per quarter note)
    const divisionsEl = doc.querySelector('attributes divisions');
    const divisions = divisionsEl ? parseInt(divisionsEl.textContent || '1') : 1;

    // Get tempo (default 120 BPM)
    const tempoEl = doc.querySelector('sound[tempo]');
    const tempo = tempoEl ? parseFloat(tempoEl.getAttribute('tempo') || '120') : 120;
    const secondsPerBeat = 60 / tempo;

    // Process each part
    const parts = doc.querySelectorAll('part');
    parts.forEach(part => {
      let currentTime = 0; // in divisions

      const measures = part.querySelectorAll('measure');
      measures.forEach(measure => {
        const elements = measure.children;

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];

          if (el.tagName === 'note') {
            const isChord = el.querySelector('chord') !== null;
            const isRest = el.querySelector('rest') !== null;
            const durationEl = el.querySelector('duration');
            const duration = durationEl ? parseInt(durationEl.textContent || '0') : 0;

            if (!isRest) {
              const pitch = this.parsePitch(el);
              if (pitch > 0) {
                const startTimeSec = (isChord ? currentTime - duration : currentTime) / divisions * secondsPerBeat;
                const durationSec = duration / divisions * secondsPerBeat;

                events.push({
                  pitch,
                  startTime: startTimeSec,
                  duration: durationSec,
                  velocity: 80
                });
              }
            }

            // Only advance time if not a chord note
            if (!isChord) {
              currentTime += duration;
            }
          } else if (el.tagName === 'forward') {
            const durationEl = el.querySelector('duration');
            currentTime += durationEl ? parseInt(durationEl.textContent || '0') : 0;
          } else if (el.tagName === 'backup') {
            const durationEl = el.querySelector('duration');
            currentTime -= durationEl ? parseInt(durationEl.textContent || '0') : 0;
          }
        }
      });
    });

    // Calculate total duration
    if (events.length > 0) {
      this._duration = Math.max(...events.map(e => e.startTime + e.duration));
    }

    return events;
  }

  private parsePitch(noteEl: Element): number {
    const pitchEl = noteEl.querySelector('pitch');
    if (!pitchEl) return 0;

    const step = pitchEl.querySelector('step')?.textContent || 'C';
    const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4');
    const alter = parseInt(pitchEl.querySelector('alter')?.textContent || '0');

    // Convert to MIDI pitch
    const stepMap: Record<string, number> = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    return (octave + 1) * 12 + stepMap[step] + alter;
  }

  /**
   * Play a note using Web Audio oscillator
   */
  private playNote(pitch: number, startTime: number, duration: number, velocity: number) {
    if (!this.audioContext || !this.gainNode) return;

    const frequency = 440 * Math.pow(2, (pitch - 69) / 12);

    // Create oscillator for a simple synth sound
    const osc = this.audioContext.createOscillator();
    const noteGain = this.audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.value = frequency;

    // ADSR envelope
    const attackTime = 0.02;
    const decayTime = 0.1;
    const sustainLevel = 0.7;
    const releaseTime = 0.1;

    const now = this.audioContext.currentTime;
    const noteStart = now + startTime;
    const noteEnd = noteStart + duration;

    noteGain.gain.setValueAtTime(0, noteStart);
    noteGain.gain.linearRampToValueAtTime(velocity / 127, noteStart + attackTime);
    noteGain.gain.linearRampToValueAtTime(sustainLevel * velocity / 127, noteStart + attackTime + decayTime);
    noteGain.gain.setValueAtTime(sustainLevel * velocity / 127, noteEnd - releaseTime);
    noteGain.gain.linearRampToValueAtTime(0, noteEnd);

    osc.connect(noteGain);
    noteGain.connect(this.gainNode);

    osc.start(noteStart);
    osc.stop(noteEnd + 0.1);

    this.activeOscillators.push(osc);

    osc.onended = () => {
      const idx = this.activeOscillators.indexOf(osc);
      if (idx > -1) this.activeOscillators.splice(idx, 1);
    };
  }

  /**
   * Play MusicXML content
   */
  play(xml: string, fromTime = 0) {
    this.stop();
    this.initAudio();

    const events = this.parseMusicXML(xml);
    if (events.length === 0) return;

    this.setState('playing');
    this.startTimestamp = this.audioContext!.currentTime;
    this.pausedAt = fromTime;

    // Schedule notes
    events.forEach(event => {
      const adjustedStart = event.startTime - fromTime;
      if (adjustedStart >= 0) {
        this.playNote(event.pitch, adjustedStart, event.duration, event.velocity);
      }
    });

    // Update time periodically
    const updateInterval = setInterval(() => {
      if (this._state === 'playing') {
        this._currentTime = this.currentTime;
        this.onTimeUpdate?.(this._currentTime);

        if (this._currentTime >= this._duration) {
          this.stop();
        }
      } else {
        clearInterval(updateInterval);
      }
    }, 100);

    this.scheduledEvents.push(updateInterval as unknown as number);
  }

  pause() {
    if (this._state !== 'playing') return;

    this._currentTime = this.currentTime;
    this.pausedAt = this._currentTime;
    this.stopAllSounds();
    this.setState('paused');
  }

  resume(xml: string) {
    if (this._state !== 'paused') return;
    this.play(xml, this.pausedAt);
  }

  stop() {
    this.stopAllSounds();
    this._currentTime = 0;
    this.pausedAt = 0;
    this.setState('stopped');
    this.onTimeUpdate?.(0);
  }

  private stopAllSounds() {
    // Stop all oscillators
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeOscillators = [];

    // Clear scheduled events
    this.scheduledEvents.forEach(id => clearTimeout(id));
    this.scheduledEvents = [];
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
}

export const audioPlayer = new AudioPlayer();
export type { PlaybackState };
