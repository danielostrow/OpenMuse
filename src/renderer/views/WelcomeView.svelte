<script lang="ts">
  import { currentView } from '$stores/ui';

  function handleNewProject() {
    currentView.set('setup');
  }

  async function handleOpenProject() {
    // TODO: Open file dialog and load project
    console.log('Open project');
  }
</script>

<div class="welcome">
  <div class="welcome-content">
    <div class="logo">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="38" stroke="currentColor" stroke-width="2" fill="none" />
        <path d="M25 55 L25 25 L45 25 L45 55 M35 40 L55 40" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        <circle cx="25" cy="58" r="5" fill="currentColor" />
        <circle cx="45" cy="58" r="5" fill="currentColor" />
      </svg>
    </div>

    <h1>OpenMuse</h1>
    <p class="tagline">AI-Powered Music Notation</p>

    <div class="actions">
      <button class="btn btn-primary" onclick={handleNewProject}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Project
      </button>

      <button class="btn btn-secondary" onclick={handleOpenProject}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5Z" />
        </svg>
        Open Project
      </button>
    </div>

    <div class="recent">
      <h3>Recent Projects</h3>
      <p class="empty">No recent projects</p>
    </div>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <h4>Compose</h4>
        <p>Create music notation with AI assistance</p>
      </div>

      <div class="feature">
        <div class="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h4>Chat</h4>
        <p>Describe changes in natural language</p>
      </div>

      <div class="feature">
        <div class="feature-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <h4>Transcribe</h4>
        <p>Convert audio to notation</p>
      </div>
    </div>
  </div>
</div>

<style>
  .welcome {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-secondary) 100%);
  }

  .welcome-content {
    text-align: center;
    max-width: 600px;
    padding: var(--spacing-xl);
  }

  .logo {
    color: var(--color-primary);
    margin-bottom: var(--spacing-lg);
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 var(--spacing-sm) 0;
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    margin-bottom: var(--spacing-xl);
  }

  .actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    margin-bottom: var(--spacing-xl);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 1rem;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-surface-hover);
  }

  .recent {
    margin-bottom: var(--spacing-xl);
  }

  .recent h3 {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-md);
  }

  .recent .empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .features {
    display: flex;
    gap: var(--spacing-lg);
    justify-content: center;
  }

  .feature {
    flex: 1;
    max-width: 150px;
    text-align: center;
  }

  .feature-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    border-radius: var(--radius-md);
    color: var(--color-primary);
  }

  .feature h4 {
    font-size: 0.95rem;
    margin: 0 0 var(--spacing-xs) 0;
  }

  .feature p {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin: 0;
  }
</style>
