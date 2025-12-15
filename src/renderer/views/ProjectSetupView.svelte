<script lang="ts">
  import { currentView, isLoading } from '$stores/ui';
  import { project } from '$stores/project';
  import { score } from '$stores/score';
  import { INSTRUMENTS, KEY_SIGNATURES, getKeyName, type Instrument, type InstrumentCategory } from '$lib/types';

  let step = $state(1);
  let title = $state('Untitled');
  let composer = $state('');
  let selectedInstruments = $state<Instrument[]>([]);
  let keyFifths = $state(0);
  let keyMode = $state<'major' | 'minor'>('major');
  let timeBeats = $state(4);
  let timeBeatType = $state(4);
  let tempo = $state(120);
  let initialMeasures = $state(16);

  const categories: { id: InstrumentCategory; label: string }[] = [
    { id: 'keyboards', label: 'Keyboards' },
    { id: 'strings', label: 'Strings' },
    { id: 'woodwinds', label: 'Woodwinds' },
    { id: 'brass', label: 'Brass' },
    { id: 'percussion', label: 'Percussion' },
    { id: 'voices', label: 'Voices' }
  ];

  let activeCategory = $state<InstrumentCategory>('keyboards');

  function toggleInstrument(instrument: Instrument) {
    const index = selectedInstruments.findIndex(i => i.id === instrument.id);
    if (index >= 0) {
      selectedInstruments = selectedInstruments.filter(i => i.id !== instrument.id);
    } else {
      selectedInstruments = [...selectedInstruments, instrument];
    }
  }

  function isSelected(instrument: Instrument): boolean {
    return selectedInstruments.some(i => i.id === instrument.id);
  }

  function handleBack() {
    if (step > 1) {
      step--;
    } else {
      currentView.set('welcome');
    }
  }

  function handleNext() {
    if (step < 4) {
      step++;
    } else {
      createProject();
    }
  }

  async function apiRequest(endpoint: string, method: string, body: unknown) {
    // Try IPC first, fall back to direct fetch
    if (window.electronAPI) {
      return await window.electronAPI.apiRequest(endpoint, method, body);
    }
    // Direct fetch fallback for dev
    const response = await fetch(`http://127.0.0.1:8765${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  }

  async function createProject() {
    isLoading.set(true);

    try {
      // Create the project in the store
      project.new({
        title,
        composer,
        instruments: selectedInstruments,
        keySignature: { fifths: keyFifths, mode: keyMode },
        timeSignature: { beats: timeBeats, beatType: timeBeatType },
        tempo
      });

      // Generate initial MusicXML via backend
      const response = await apiRequest('/score/new', 'POST', {
        title,
        composer,
        instruments: selectedInstruments.map(i => ({
          id: i.id,
          name: i.name,
          abbreviation: i.abbreviation,
          midi_program: i.midiProgram,
          clef: i.clef
        })),
        key_fifths: keyFifths,
        key_mode: keyMode,
        time_beats: timeBeats,
        time_beat_type: timeBeatType,
        tempo,
        measures: initialMeasures
      });

      console.log('Create project response:', response);

      if (response && typeof response === 'object' && 'musicxml' in response) {
        console.log('Setting MusicXML...');
        score.setMusicXML(response.musicxml as string);
        console.log('MusicXML set successfully');
      }

      console.log('Changing view to editor...');
      currentView.set('editor');
      console.log('View changed to editor');
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      isLoading.set(false);
    }
  }

  function getKeyDisplayName(): string {
    return `${getKeyName(keyFifths, keyMode)} ${keyMode}`;
  }
</script>

<div class="setup">
  <div class="setup-header">
    <button class="back-btn" onclick={handleBack}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="steps">
      {#each [1, 2, 3, 4] as s}
        <div class="step" class:active={step >= s}>
          {s}
        </div>
      {/each}
    </div>
  </div>

  <div class="setup-content">
    {#if step === 1}
      <div class="step-content">
        <h2>Project Details</h2>
        <p>Enter basic information about your composition</p>

        <div class="form-group">
          <label for="title">Title</label>
          <input type="text" id="title" bind:value={title} placeholder="Enter title..." />
        </div>

        <div class="form-group">
          <label for="composer">Composer</label>
          <input type="text" id="composer" bind:value={composer} placeholder="Enter composer name..." />
        </div>
      </div>
    {:else if step === 2}
      <div class="step-content">
        <h2>Select Instruments</h2>
        <p>Choose the instruments for your composition</p>

        <div class="instrument-picker">
          <div class="categories">
            {#each categories as category}
              <button
                class="category-btn"
                class:active={activeCategory === category.id}
                onclick={() => activeCategory = category.id}
              >
                {category.label}
              </button>
            {/each}
          </div>

          <div class="instruments-grid">
            {#each INSTRUMENTS[activeCategory] as instrument}
              <button
                class="instrument-btn"
                class:selected={isSelected(instrument)}
                onclick={() => toggleInstrument(instrument)}
              >
                <span class="name">{instrument.name}</span>
                <span class="abbrev">{instrument.abbreviation}</span>
              </button>
            {/each}
          </div>

          <div class="selected-instruments">
            <h4>Selected ({selectedInstruments.length})</h4>
            <div class="selected-list">
              {#each selectedInstruments as instrument}
                <span class="selected-tag">
                  {instrument.name}
                  <button onclick={() => toggleInstrument(instrument)}>&times;</button>
                </span>
              {/each}
              {#if selectedInstruments.length === 0}
                <span class="empty">No instruments selected</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {:else if step === 3}
      <div class="step-content">
        <h2>Key & Time Signature</h2>
        <p>Set the musical parameters for your composition</p>

        <div class="signature-picker">
          <div class="form-group">
            <label>Key Signature: <strong>{getKeyDisplayName()}</strong></label>
            <div class="key-picker">
              <input type="range" min="-7" max="7" bind:value={keyFifths} />
              <div class="mode-toggle">
                <button class:active={keyMode === 'major'} onclick={() => keyMode = 'major'}>Major</button>
                <button class:active={keyMode === 'minor'} onclick={() => keyMode = 'minor'}>Minor</button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Time Signature</label>
            <div class="time-picker">
              <select bind:value={timeBeats}>
                {#each [2, 3, 4, 5, 6, 7, 9, 12] as beats}
                  <option value={beats}>{beats}</option>
                {/each}
              </select>
              <span class="divider">/</span>
              <select bind:value={timeBeatType}>
                {#each [2, 4, 8, 16] as beatType}
                  <option value={beatType}>{beatType}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Tempo: <strong>{tempo} BPM</strong></label>
            <input type="range" min="40" max="240" bind:value={tempo} />
          </div>
        </div>
      </div>
    {:else if step === 4}
      <div class="step-content">
        <h2>Create Score</h2>
        <p>Review your settings and create the initial score</p>

        <div class="summary">
          <div class="summary-item">
            <span class="label">Title</span>
            <span class="value">{title || 'Untitled'}</span>
          </div>
          <div class="summary-item">
            <span class="label">Composer</span>
            <span class="value">{composer || '-'}</span>
          </div>
          <div class="summary-item">
            <span class="label">Instruments</span>
            <span class="value">{selectedInstruments.map(i => i.name).join(', ') || 'None'}</span>
          </div>
          <div class="summary-item">
            <span class="label">Key</span>
            <span class="value">{getKeyDisplayName()}</span>
          </div>
          <div class="summary-item">
            <span class="label">Time</span>
            <span class="value">{timeBeats}/{timeBeatType}</span>
          </div>
          <div class="summary-item">
            <span class="label">Tempo</span>
            <span class="value">{tempo} BPM</span>
          </div>
        </div>

        <div class="form-group">
          <label>Initial Measures: <strong>{initialMeasures}</strong></label>
          <input type="range" min="4" max="64" step="4" bind:value={initialMeasures} />
        </div>
      </div>
    {/if}
  </div>

  <div class="setup-footer">
    <button class="btn btn-secondary" onclick={handleBack}>
      {step === 1 ? 'Cancel' : 'Back'}
    </button>
    <button class="btn btn-primary" onclick={handleNext} disabled={step === 2 && selectedInstruments.length === 0}>
      {step === 4 ? 'Create Project' : 'Next'}
    </button>
  </div>
</div>

<style>
  .setup {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }

  .setup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--color-text-secondary);
  }

  .back-btn:hover {
    color: var(--color-text);
  }

  .steps {
    display: flex;
    gap: var(--spacing-sm);
  }

  .step {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .step.active {
    background: var(--color-primary);
    color: white;
  }

  .setup-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
    display: flex;
    justify-content: center;
  }

  .step-content {
    max-width: 600px;
    width: 100%;
  }

  .step-content h2 {
    margin: 0 0 var(--spacing-xs) 0;
  }

  .step-content > p {
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-lg) 0;
  }

  .form-group {
    margin-bottom: var(--spacing-lg);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .form-group input[type="text"]:focus {
    border-color: var(--color-primary);
  }

  .form-group input[type="range"] {
    width: 100%;
    cursor: pointer;
  }

  /* Instrument picker */
  .categories {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
  }

  .category-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .category-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .instruments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .instrument-btn {
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: left;
    display: flex;
    flex-direction: column;
    border: 2px solid transparent;
  }

  .instrument-btn.selected {
    border-color: var(--color-primary);
    background: var(--color-bg-tertiary);
  }

  .instrument-btn .name {
    font-weight: 500;
  }

  .instrument-btn .abbrev {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .selected-instruments h4 {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-sm) 0;
  }

  .selected-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .selected-tag {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
  }

  .selected-tag button {
    color: white;
    opacity: 0.7;
  }

  .selected-tag button:hover {
    opacity: 1;
  }

  .selected-list .empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Key/Time picker */
  .key-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .mode-toggle {
    display: flex;
    gap: var(--spacing-xs);
  }

  .mode-toggle button {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-secondary);
  }

  .mode-toggle button.active {
    background: var(--color-primary);
    color: white;
  }

  .time-picker {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .time-picker select {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: 1.2rem;
    min-width: 60px;
  }

  .time-picker .divider {
    font-size: 1.5rem;
    color: var(--color-text-muted);
  }

  /* Summary */
  .summary {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .summary-item:last-child {
    border-bottom: none;
  }

  .summary-item .label {
    color: var(--color-text-secondary);
  }

  .summary-item .value {
    font-weight: 500;
  }

  /* Footer */
  .setup-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--radius-md);
    font-weight: 500;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-surface-hover);
  }
</style>
