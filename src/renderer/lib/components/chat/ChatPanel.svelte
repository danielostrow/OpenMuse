<script lang="ts">
  import { tick } from 'svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import { chat } from '$stores/chat';
  import { score } from '$stores/score';
  import { selection, selectionLabel } from '$stores/selection';
  import { isLoading } from '$stores/ui';

  let messagesContainer: HTMLDivElement;

  async function apiRequest(endpoint: string, method: string, body: unknown) {
    // Try IPC first, fall back to direct fetch
    if (window.electronAPI?.apiRequest) {
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

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async function handleSend(message: string) {
    if (!message.trim()) return;

    // Add user command
    const userMsg = chat.addUserMessage(message);
    await scrollToBottom();

    // Send to backend with streaming
    isLoading.set(true);
    chat.setStreaming(true);
    score.setComposingMeasures(0);

    try {
      const payload: {
        message: string;
        current_score?: string;
        selected_measures?: string;
        selection_info?: {
          start_measure: number;
          end_measure: number;
          part_id?: string;
        };
      } = {
        message
      };

      // Add score context
      const currentScore = $score.musicXML;
      if (currentScore) {
        payload.current_score = currentScore;
      }

      // Add selection context if available
      const currentSelection = $selection;
      if (currentSelection.type !== 'none' && currentSelection.startMeasure !== null) {
        payload.selection_info = {
          start_measure: currentSelection.startMeasure,
          end_measure: currentSelection.endMeasure || currentSelection.startMeasure
        };

        if (currentSelection.extractedXML) {
          payload.selected_measures = currentSelection.extractedXML;
        }
      }

      // Use streaming endpoint for live updates
      const response = await fetch('http://127.0.0.1:8765/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Stream request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let finalMusicXML: string | null = null;
      let buffer = ''; // Buffer for incomplete SSE lines

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append to buffer and split by double newline (SSE message separator)
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');

        // Keep the last potentially incomplete message in buffer
        buffer = messages.pop() || '';

        for (const message of messages) {
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'partial' && parsed.measures) {
                  // Update composing progress (don't render partial - OSMD is too strict)
                  console.log(`Composing: ${parsed.measures} measures...`);
                  score.setComposingMeasures(parsed.measures);
                } else if (parsed.type === 'engraving') {
                  // Show engraving status
                  console.log('Engraving: polishing notation...');
                  score.setComposingMeasures(-1); // Special value for engraving phase
                } else if (parsed.type === 'complete') {
                  console.log('Got complete message, musicxml length:', parsed.musicxml?.length);
                  finalMusicXML = parsed.musicxml;
                  if (parsed.improvements) {
                    console.log('Engraving improvements:', parsed.improvements);
                  }
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                console.warn('SSE parse error:', e, 'data length:', data.length);
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'complete') {
                console.log('Got complete message from buffer, musicxml length:', parsed.musicxml?.length);
                finalMusicXML = parsed.musicxml;
              }
            } catch (e) {
              console.warn('Final buffer parse error:', e);
            }
          }
        }
      }

      if (finalMusicXML) {
        console.log('Composition complete!');
        score.setPendingMusicXML(finalMusicXML, 0);
        chat.markCommandSuccess(userMsg.id);
      } else {
        chat.markCommandError(userMsg.id, 'No score changes generated');
      }

      score.setComposingMeasures(0);
      await scrollToBottom();
    } catch (error) {
      console.error('Edit error:', error);
      chat.markCommandError(userMsg.id, 'Failed to process command');
      score.setComposingMeasures(0);
    } finally {
      isLoading.set(false);
      chat.setStreaming(false);
    }
  }

  function handleClearChat() {
    chat.reset();
    // Also reset on backend
    apiRequest('/reset', 'POST', {});
  }

  // Scroll to bottom when messages change
  $effect(() => {
    if ($chat.messages.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="chat-panel">
  <header class="chat-header">
    <h2>Edit Score</h2>
    <button class="clear-btn" onclick={handleClearChat} title="Clear history">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  </header>

  <div class="messages" bind:this={messagesContainer}>
    {#if $chat.messages.length === 0}
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <p>Type a command to edit your score</p>
        <ul>
          <li>Write a fugue for these instruments</li>
          <li>Add a crescendo to measure 4</li>
          <li>Transpose up a fifth</li>
          <li>Add dynamics throughout</li>
        </ul>
      </div>
    {:else}
      {#each $chat.messages as message (message.id)}
        <ChatMessage {message} />
      {/each}
    {/if}
  </div>

  <footer class="chat-footer">
    {#if $selectionLabel}
      <div class="selection-context">
        <span class="label">Context:</span>
        <span class="value">{$selectionLabel}</span>
        <button onclick={() => selection.clear()} title="Clear selection">&times;</button>
      </div>
    {/if}
    <ChatInput onSend={handleSend} disabled={$chat.isStreaming} />
  </footer>
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  .chat-header h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .clear-btn {
    color: var(--color-text-muted);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .clear-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--color-text-muted);
  }

  .empty-state svg {
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1rem;
  }

  .empty-state ul {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
  }

  .empty-state li {
    padding: var(--spacing-xs) 0;
    color: var(--color-text-secondary);
  }

  .chat-footer {
    border-top: 1px solid var(--color-border);
    padding: var(--spacing-md);
  }

  .selection-context {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
  }

  .selection-context .label {
    color: var(--color-text-muted);
  }

  .selection-context .value {
    color: var(--color-primary);
    font-weight: 500;
  }

  .selection-context button {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 1.2rem;
    line-height: 1;
  }

  .selection-context button:hover {
    color: var(--color-text);
  }
</style>
