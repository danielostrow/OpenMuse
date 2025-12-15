<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
  import { score } from '$stores/score';
  import { selection } from '$stores/selection';
  import { scoreZoom } from '$stores/ui';

  let container: HTMLDivElement;
  let osmd: OpenSheetMusicDisplay | null = null;
  let isLoaded = $state(false);
  let error = $state<string | null>(null);

  function handleClick(event: MouseEvent) {
    if (!osmd || !isLoaded) return;

    // Get click position relative to container
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Try to find which measure was clicked
    // This is a simplified approach - real implementation would use OSMD's graphic sheet
    try {
      const graphicSheet = osmd.GraphicSheet;
      if (graphicSheet && graphicSheet.MeasureList) {
        const measureCount = graphicSheet.MeasureList.length;

        // Simple heuristic: divide container width by measure count
        // This is a placeholder - proper implementation would use bounding boxes
        const measureWidth = container.scrollWidth / measureCount;
        const clickedMeasure = Math.floor((x + container.scrollLeft) / measureWidth) + 1;

        if (clickedMeasure >= 1 && clickedMeasure <= measureCount) {
          if (event.shiftKey) {
            selection.extendSelection(clickedMeasure);
          } else {
            selection.selectMeasure(clickedMeasure);
          }
        }
      }
    } catch (e) {
      console.error('Error handling click:', e);
    }
  }

  async function loadScore(xml: string) {
    if (!osmd || !xml) return;

    try {
      error = null;
      isLoaded = false;

      await osmd.load(xml);
      osmd.render();

      // Update score info
      const measureCount = osmd.GraphicSheet?.MeasureList?.length || 0;
      score.updateInfo({ measureCount });

      isLoaded = true;
    } catch (e) {
      console.error('Failed to load score:', e);
      error = e instanceof Error ? e.message : 'Failed to load score';
    }
  }

  function updateZoom(zoom: number) {
    if (!osmd) return;
    osmd.zoom = zoom / 100;
    if (isLoaded) {
      osmd.render();
    }
  }

  onMount(() => {
    osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawComposer: true,
      drawingParameters: 'default',
      drawPartNames: true,
      drawMeasureNumbers: true,
      drawTimeSignatures: true,
      drawKeySignatures: true
    });

    // Subscribe to score changes
    const unsubScore = score.subscribe(s => {
      if (s.musicXML && osmd) {
        loadScore(s.musicXML);
      }
    });

    // Subscribe to zoom changes
    const unsubZoom = scoreZoom.subscribe(updateZoom);

    return () => {
      unsubScore();
      unsubZoom();
    };
  });

  onDestroy(() => {
    osmd = null;
  });
</script>

<div
  class="score-renderer"
  bind:this={container}
  onclick={handleClick}
  role="img"
  aria-label="Musical score"
>
  {#if !$score.musicXML}
    <div class="placeholder">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <p>No score loaded</p>
      <p class="hint">Create a new project or open an existing one</p>
    </div>
  {:else if error}
    <div class="error">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p>Error loading score</p>
      <p class="detail">{error}</p>
    </div>
  {:else if !isLoaded}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading score...</p>
    </div>
  {/if}
</div>

<style>
  .score-renderer {
    width: 100%;
    min-height: 100%;
    padding: var(--spacing-lg);
    cursor: default;
  }

  .placeholder, .error, .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 400px;
    color: #666;
    text-align: center;
  }

  .placeholder svg, .error svg {
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .placeholder p, .error p, .loading p {
    margin: 0;
    font-size: 1.1rem;
  }

  .placeholder .hint, .error .detail {
    font-size: 0.9rem;
    color: #999;
    margin-top: var(--spacing-xs);
  }

  .error {
    color: #c0392b;
  }

  .error svg {
    stroke: #c0392b;
  }

  .loading {
    color: #666;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e0e0e0;
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* OSMD container styling */
  :global(.score-renderer > div) {
    width: 100%;
  }

  :global(.score-renderer svg) {
    max-width: 100%;
    height: auto;
  }
</style>
