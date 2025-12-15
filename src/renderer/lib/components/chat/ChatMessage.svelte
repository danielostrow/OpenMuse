<script lang="ts">
  import type { ChatMessage } from '$stores/chat';

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();
</script>

<div class="command" class:pending={message.status === 'pending'} class:success={message.status === 'success'} class:error={message.status === 'error'}>
  <div class="command-content">
    <span class="command-text">{message.content}</span>
    {#if message.selectionContext}
      <span class="context-badge">m.{message.selectionContext.startMeasure}{message.selectionContext.endMeasure !== message.selectionContext.startMeasure ? `-${message.selectionContext.endMeasure}` : ''}</span>
    {/if}
  </div>

  <div class="status-indicator">
    {#if message.status === 'pending'}
      <div class="spinner"></div>
    {:else if message.status === 'success'}
      <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    {:else if message.status === 'error'}
      <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
      {#if message.errorMessage}
        <span class="error-text">{message.errorMessage}</span>
      {/if}
    {/if}
  </div>
</div>

<style>
  .command {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border-left: 3px solid var(--color-border);
    transition: all 0.2s ease;
  }

  .command.pending {
    border-left-color: var(--color-primary, #4a90d9);
    opacity: 0.8;
  }

  .command.success {
    border-left-color: var(--color-success, #27ae60);
  }

  .command.error {
    border-left-color: var(--color-error, #e74c3c);
  }

  .command-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
  }

  .command-text {
    font-size: 0.9rem;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .context-badge {
    padding: 2px 6px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary, #4a90d9);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .check-icon {
    color: var(--color-success, #27ae60);
  }

  .error-icon {
    color: var(--color-error, #e74c3c);
  }

  .error-text {
    font-size: 0.75rem;
    color: var(--color-error, #e74c3c);
  }
</style>
