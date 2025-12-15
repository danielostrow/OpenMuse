<script lang="ts">
  import { scoreZoom, showChatPanel } from '$stores/ui';
  import { selection } from '$stores/selection';

  function zoomIn() {
    scoreZoom.update(z => Math.min(200, z + 10));
  }

  function zoomOut() {
    scoreZoom.update(z => Math.max(50, z - 10));
  }

  function resetZoom() {
    scoreZoom.set(100);
  }

  function toggleChat() {
    showChatPanel.update(v => !v);
  }

  function clearSelection() {
    selection.clear();
  }
</script>

<div class="toolbar" role="toolbar" aria-label="Score toolbar">
  <div class="toolbar-group">
    <button class="tool-btn" onclick={zoomOut} title="Zoom Out (Cmd/Ctrl -)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35M8 11h6" />
      </svg>
    </button>

    <button class="zoom-display" onclick={resetZoom} title="Reset Zoom">
      {$scoreZoom}%
    </button>

    <button class="tool-btn" onclick={zoomIn} title="Zoom In (Cmd/Ctrl +)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
      </svg>
    </button>
  </div>

  <div class="toolbar-group">
    {#if $selection.type !== 'none'}
      <button class="tool-btn text" onclick={clearSelection} title="Clear Selection">
        Clear Selection
      </button>
    {/if}
  </div>

  <div class="toolbar-group">
    <button
      class="tool-btn"
      class:active={$showChatPanel}
      onclick={toggleChat}
      title="Toggle Chat Panel"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    -webkit-app-region: no-drag;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .tool-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .tool-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .tool-btn.text {
    width: auto;
    padding: 0 var(--spacing-sm);
    font-size: 0.85rem;
  }

  .zoom-display {
    padding: 0 var(--spacing-sm);
    height: 32px;
    min-width: 50px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .zoom-display:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
</style>
