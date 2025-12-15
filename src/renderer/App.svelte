<script lang="ts">
  import WelcomeView from './views/WelcomeView.svelte';
  import ProjectSetupView from './views/ProjectSetupView.svelte';
  import ScoreEditorView from './views/ScoreEditorView.svelte';
  import { currentView } from '$stores/ui';
</script>

<main class="app">
  {#if $currentView === 'welcome'}
    <WelcomeView />
  {:else if $currentView === 'setup'}
    <ProjectSetupView />
  {:else if $currentView === 'editor'}
    <ScoreEditorView />
  {/if}
</main>

<style>
  .app {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

</style>
