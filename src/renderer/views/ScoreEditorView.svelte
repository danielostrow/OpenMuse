<script lang="ts">
  import { onMount } from 'svelte';
  import ChatPanel from '$components/chat/ChatPanel.svelte';
  import { project, projectTitle } from '$stores/project';
  import { score, hasPendingChanges, isComposing, composingMeasures, displayMusicXML } from '$stores/score';
  import { selection } from '$stores/selection';
  import { audioPlayer, type PlaybackState } from '../lib/services/audio-player';

  let scoreContainer: HTMLDivElement;
  let osmdInstance: any = null;
  let loading = $state(true);
  let error = $state<string | null>(null);
  let zoom = $state(100);
  let showChat = $state(true);
  let chatWidth = $state(350);
  let isResizing = $state(false);
  let osmdReady = $state(false);
  let lastRenderedKey = $state(0);

  // Playback state
  let playbackState = $state<PlaybackState>('stopped');
  let playbackTime = $state(0);
  let playbackDuration = $state(0);

  // Watch for score changes (including pending) and re-render OSMD
  $effect(() => {
    const xmlToRender = $displayMusicXML; // Shows pending if exists, otherwise current
    const renderKey = $score.renderKey;
    const composing = $isComposing;

    // Re-render if OSMD is ready and renderKey changed
    // Don't set loading=true during re-renders - OSMD can't render to a hidden container
    if (osmdReady && osmdInstance && xmlToRender && renderKey > lastRenderedKey) {
      console.log('Score changed (renderKey:', renderKey, ', pending:', $hasPendingChanges, ', composing:', composing, '), reloading OSMD...');
      lastRenderedKey = renderKey;

      osmdInstance.load(xmlToRender).then(() => {
        osmdInstance.zoom = zoom / 100;
        osmdInstance.render();
        console.log('OSMD re-rendered');

        // Update measure count
        const measureCount = osmdInstance.GraphicSheet?.MeasureList?.length || 0;
        score.updateInfo({ measureCount });
      }).catch((e: Error) => {
        console.error('OSMD reload error:', e);
        // Don't show error during composing - partial XML may fail but that's expected
        // Just log it and wait for the next update
        if (!composing) {
          error = e.message;
        }
      });
    }
  });

  function handleAccept() {
    score.acceptPending();
  }

  function handleDecline() {
    score.declinePending();
  }

  function handleZoom(direction: 'in' | 'out' | 'reset') {
    if (direction === 'in') zoom = Math.min(200, zoom + 10);
    else if (direction === 'out') zoom = Math.max(50, zoom - 10);
    else zoom = 100;

    if (osmdInstance) {
      osmdInstance.zoom = zoom / 100;
      osmdInstance.render();
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isResizing) {
      chatWidth = Math.max(280, Math.min(600, window.innerWidth - e.clientX));
    }
  }

  function handleMouseUp() {
    isResizing = false;
  }

  function handlePlayPause() {
    const xml = $displayMusicXML;
    if (!xml) return;

    if (playbackState === 'stopped') {
      audioPlayer.play(xml);
      playbackDuration = audioPlayer.duration;
    } else if (playbackState === 'playing') {
      audioPlayer.pause();
    } else if (playbackState === 'paused') {
      audioPlayer.resume(xml);
    }
  }

  function handleStop() {
    audioPlayer.stop();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onMount(() => {
    console.log('ScoreEditorView mounted');

    // Set up audio player callbacks
    audioPlayer.setCallbacks(
      (state) => { playbackState = state; },
      (time) => { playbackTime = time; }
    );

    // Load OSMD asynchronously after paint
    const timeoutId = setTimeout(async () => {
      try {
        console.log('Loading OSMD...');
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

        osmdInstance = new OpenSheetMusicDisplay(scoreContainer, {
          autoResize: true,
          backend: 'svg',
          drawTitle: true,
          drawComposer: true,
          drawPartNames: true,
          drawMeasureNumbers: true
        });

        const musicXML = $displayMusicXML;
        if (musicXML) {
          console.log('Loading MusicXML into OSMD...');
          await osmdInstance.load(musicXML);
          console.log('Rendering...');
          osmdInstance.render();
          console.log('OSMD render complete');

          // Update score info
          const measureCount = osmdInstance.GraphicSheet?.MeasureList?.length || 0;
          score.updateInfo({ measureCount });
        }

        loading = false;
        lastRenderedKey = $score.renderKey; // Track initial render key
        osmdReady = true;
      } catch (e) {
        console.error('OSMD error:', e);
        error = e instanceof Error ? e.message : 'Failed to load score';
        loading = false;
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      osmdInstance = null;
    };
  });
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="editor">
  <header class="editor-header">
    <div class="title-section">
      <h1>{$projectTitle}</h1>
      {#if $project.composer}
        <span class="composer">by {$project.composer}</span>
      {/if}
    </div>

    <div class="toolbar">
      <!-- Playback controls -->
      <div class="toolbar-group playback-controls">
        <button class="tool-btn" onclick={handleStop} title="Stop" disabled={playbackState === 'stopped'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
        <button class="tool-btn play-btn" onclick={handlePlayPause} title={playbackState === 'playing' ? 'Pause' : 'Play'}>
          {#if playbackState === 'playing'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          {/if}
        </button>
        <span class="playback-time">{formatTime(playbackTime)}</span>
      </div>

      <div class="toolbar-group">
        <button class="tool-btn" onclick={() => handleZoom('out')} title="Zoom Out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </button>
        <button class="zoom-display" onclick={() => handleZoom('reset')}>{zoom}%</button>
        <button class="tool-btn" onclick={() => handleZoom('in')} title="Zoom In">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>
      </div>

      <button class="tool-btn" class:active={showChat} onclick={() => showChat = !showChat} title="Toggle Chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  </header>

  <div class="editor-body">
    <main class="score-area" class:has-pending={$hasPendingChanges}>
      {#if loading}
        <div class="placeholder">
          <div class="spinner"></div>
          <p>Loading score...</p>
        </div>
      {:else if error}
        <div class="placeholder error">
          <p>Error: {error}</p>
        </div>
      {/if}
      <div class="osmd-container" bind:this={scoreContainer} class:hidden={loading || error}></div>

      {#if $isComposing || $hasPendingChanges}
        <div class="pending-overlay" class:composing={$isComposing}>
          <div class="pending-banner" class:composing={$isComposing}>
            {#if $isComposing}
              <div class="composing-indicator">
                <div class="music-notes">
                  <span class="note">♪</span>
                  <span class="note">♫</span>
                  <span class="note">♬</span>
                </div>
                {#if $composingMeasures === -1}
                  <span class="composing-text">✨ Polishing notation...</span>
                {:else}
                  <span class="composing-text">Composing measure {$composingMeasures}...</span>
                {/if}
              </div>
            {:else}
              <span class="pending-label">Preview Changes</span>
              <div class="pending-actions">
                <button class="decline-btn" onclick={handleDecline}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Decline
                </button>
                <button class="accept-btn" onclick={handleAccept}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Accept
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </main>

    {#if showChat}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="resize-handle" role="separator" aria-orientation="vertical" onmousedown={() => isResizing = true}></div>
      <aside class="chat-area" style="width: {chatWidth}px;">
        <ChatPanel />
      </aside>
    {/if}
  </div>

  <footer class="editor-footer">
    <div class="status-left">
      {#if $selection.type !== 'none'}
        <span class="selection-indicator">
          Selection: m.{$selection.startMeasure}{$selection.endMeasure !== $selection.startMeasure ? `-${$selection.endMeasure}` : ''}
        </span>
      {/if}
    </div>
    <div class="status-right">
      <span>{$project.instruments.length} instrument{$project.instruments.length !== 1 ? 's' : ''}</span>
      {#if $score.parsedInfo?.measureCount}
        <span>{$score.parsedInfo.measureCount} measures</span>
      {/if}
    </div>
  </footer>
</div>

<style>
  .editor {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg, #1a1a2e);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid var(--color-border, #333);
    background: var(--color-bg-secondary, #16213e);
  }

  .title-section {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .title-section h1 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text, #fff);
  }

  .composer {
    font-size: 0.9rem;
    color: var(--color-text-secondary, #888);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .playback-controls {
    background: rgba(255,255,255,0.05);
    padding: 4px 8px;
    border-radius: 8px;
    gap: 8px;
  }

  .play-btn {
    background: var(--color-primary, #4a90d9) !important;
    color: white !important;
  }

  .play-btn:hover {
    background: var(--color-primary-hover, #5a9fe9) !important;
  }

  .playback-time {
    font-size: 0.8rem;
    font-family: monospace;
    color: var(--color-text-secondary, #888);
    min-width: 45px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: var(--color-text-secondary, #888);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--color-text, #fff);
  }

  .tool-btn.active {
    background: var(--color-primary, #4a90d9);
    color: white;
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .zoom-display {
    padding: 4px 8px;
    min-width: 50px;
    text-align: center;
    font-size: 0.85rem;
    color: var(--color-text-secondary, #888);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .zoom-display:hover {
    color: var(--color-text, #fff);
  }

  .editor-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .score-area {
    flex: 1;
    overflow: auto;
    background: #fff;
    position: relative;
  }

  .score-area.has-pending {
    box-shadow: inset 0 0 0 3px var(--color-success, #27ae60);
  }

  .score-area:has(.composing) {
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: inset 0 0 0 3px rgba(74, 144, 217, 0.5); }
    50% { box-shadow: inset 0 0 0 4px rgba(74, 144, 217, 0.8), inset 0 0 30px rgba(74, 144, 217, 0.1); }
  }

  .pending-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    pointer-events: none;
  }

  .pending-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: linear-gradient(to bottom, rgba(39, 174, 96, 0.95), rgba(39, 174, 96, 0.85));
    color: white;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .pending-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .pending-actions {
    display: flex;
    gap: 12px;
  }

  .accept-btn, .decline-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .accept-btn {
    background: white;
    color: var(--color-success, #27ae60);
    border: none;
  }

  .accept-btn:hover {
    background: #f0f0f0;
  }

  .decline-btn {
    background: transparent;
    color: white;
    border: 2px solid rgba(255,255,255,0.5);
  }

  .decline-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: white;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
    color: #666;
    padding: 40px;
  }

  .placeholder p {
    margin: 4px 0;
  }

  .placeholder.error {
    color: #c0392b;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e0e0e0;
    border-top-color: #4a90d9;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .osmd-container {
    width: 100%;
    padding: 20px;
  }

  .osmd-container.hidden {
    display: none;
  }

  .resize-handle {
    width: 4px;
    background: var(--color-border, #333);
    cursor: col-resize;
    transition: background 0.15s;
  }

  .resize-handle:hover {
    background: var(--color-primary, #4a90d9);
  }

  .chat-area {
    flex-shrink: 0;
    border-left: 1px solid var(--color-border, #333);
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary, #16213e);
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    border-top: 1px solid var(--color-border, #333);
    background: var(--color-bg-secondary, #16213e);
    font-size: 0.85rem;
    color: var(--color-text-secondary, #888);
  }

  .status-left, .status-right {
    display: flex;
    gap: 16px;
  }

  .selection-indicator {
    color: var(--color-primary, #4a90d9);
    font-weight: 500;
  }

  /* Composing animation styles */
  .pending-banner.composing {
    background: linear-gradient(135deg, rgba(74, 144, 217, 0.95), rgba(106, 90, 205, 0.95));
    justify-content: center;
  }

  .composing-indicator {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .music-notes {
    display: flex;
    gap: 4px;
    font-size: 1.5rem;
  }

  .note {
    animation: bounce 0.6s ease-in-out infinite;
    display: inline-block;
  }

  .note:nth-child(1) {
    animation-delay: 0s;
  }

  .note:nth-child(2) {
    animation-delay: 0.15s;
  }

  .note:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  .composing-text {
    font-weight: 600;
    font-size: 1rem;
    letter-spacing: 0.5px;
  }
</style>
