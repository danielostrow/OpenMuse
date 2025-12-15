<script lang="ts">
  import { chat } from '$stores/chat';

  interface Props {
    onSend: (message: string) => void;
    disabled?: boolean;
  }

  let { onSend, disabled = false }: Props = $props();

  let inputValue = $state('');

  function handleSubmit() {
    if (inputValue.trim() && !disabled) {
      onSend(inputValue.trim());
      inputValue = '';
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="chat-input">
  <textarea
    bind:value={inputValue}
    onkeydown={handleKeydown}
    placeholder="Type a message..."
    rows="2"
    {disabled}
  ></textarea>
  <button
    class="send-btn"
    onclick={handleSubmit}
    disabled={disabled || !inputValue.trim()}
    title="Send message (Enter)"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  </button>
</div>

<style>
  .chat-input {
    display: flex;
    gap: var(--spacing-sm);
    align-items: flex-end;
  }

  textarea {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    resize: none;
    font-family: inherit;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  textarea::placeholder {
    color: var(--color-text-muted);
  }

  .send-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
