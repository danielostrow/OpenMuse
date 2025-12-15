# OpenMuse

AI-powered music notation editor. Claude composes/edits MusicXML, rendered with OpenSheetMusicDisplay.

## Quick Start

```bash
# Install
npm install
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Configure
echo "ANTHROPIC_API_KEY=your-key-here" > backend/.env

# Run
npm run dev:electron
```

## Architecture

```
Electron App
├── Renderer (Svelte 5 + TypeScript)
│   ├── ScoreEditorView    → OSMD renders MusicXML
│   ├── ChatPanel          → User commands, streams to backend
│   └── Stores             → score.ts, chat.ts, project.ts
│
├── Main Process
│   └── Spawns Python backend as subprocess
│
└── Python Backend (FastAPI :8765)
    ├── claude_service     → Streams composition from Claude
    ├── engraving_service  → Post-processes for proper notation
    └── musicxml_utils     → Validation, parsing
```

## File Map

### Frontend (`src/renderer/`)

| File | What it does |
|------|--------------|
| `views/ScoreEditorView.svelte` | Main editor - OSMD rendering, playback, zoom, chat toggle |
| `views/ProjectSetupView.svelte` | New project wizard - instruments, key, tempo |
| `lib/stores/score.ts` | MusicXML state, pending changes, accept/decline |
| `lib/stores/chat.ts` | Message history, streaming state |
| `lib/components/chat/ChatPanel.svelte` | SSE streaming, parses responses |
| `lib/services/audio-player.ts` | Web Audio playback from MusicXML |

### Backend (`backend/`)

| File | What it does |
|------|--------------|
| `server.py` | FastAPI routes, `/chat/stream` is the main one |
| `claude_service.py` | Claude API, extracts MusicXML from responses |
| `engraving_service.py` | Adds dynamics, slurs, articulations, barlines |
| `musicxml_utils.py` | Validation, score templates, measure extraction |
| `config.py` | Loads ANTHROPIC_API_KEY from .env |

## Data Flow

```
User types "write a fugue"
    ↓
ChatPanel.svelte POSTs to /chat/stream
    ↓
claude_service.chat_stream() yields partial updates
    ↓
Frontend shows "Composing measure N..."
    ↓
Complete → engraving_service.engrave() adds expression
    ↓
Frontend receives final XML
    ↓
User sees preview, clicks Accept/Decline
    ↓
Accept → score.acceptPending() → OSMD re-renders
```

## Svelte 5 Syntax

We use runes, not the old reactive syntax:

```svelte
<script lang="ts">
  // State (replaces let x; $: reactive)
  let count = $state(0);

  // Derived (replaces $: derived = ...)
  let doubled = $derived(count * 2);

  // Effects (replaces $: { sideEffect })
  $effect(() => {
    console.log('count changed:', count);
  });

  // Props (replaces export let)
  let { onSend, disabled = false } = $props();
</script>
```

## Key Concepts

### Pending Changes Pattern

Score edits go through a preview state:

```typescript
// User gets AI response
score.setPendingMusicXML(newXML);  // Shows preview

// User decides
score.acceptPending();  // Apply changes
score.declinePending(); // Discard

// Derived stores
$hasPendingChanges  // true when previewing
$displayMusicXML    // pending || current
```

### SSE Streaming

Backend sends Server-Sent Events:

```
data: {"type": "partial", "measures": 4}

data: {"type": "engraving", "status": "Polishing..."}

data: {"type": "complete", "musicxml": "<?xml..."}

data: [DONE]
```

Frontend buffers by `\n\n` (SSE message separator).

### Engraving Agent

`engraving_service.py` runs after composition. It:
- Adds stem directions
- Adds final barline (light-heavy)
- Adds dynamics (p, mf, f, crescendo)
- Adds slurs following phrase structure
- Adds articulations (staccato, accent) based on musical context

Never changes pitches, durations, or note count.

## Common Tasks

### Add a new API endpoint

```python
# backend/server.py
class MyRequest(BaseModel):
    data: str

@app.post("/my-endpoint")
async def my_endpoint(request: MyRequest):
    result = do_something(request.data)
    return {"result": result}
```

### Add a new store

```typescript
// src/renderer/lib/stores/mystore.ts
import { writable, derived } from 'svelte/store';

interface MyState { value: string; }

function createMyStore() {
  const { subscribe, set, update } = writable<MyState>({ value: '' });
  return {
    subscribe,
    setValue: (v: string) => update(s => ({ ...s, value: v })),
    reset: () => set({ value: '' })
  };
}

export const myStore = createMyStore();
```

### Modify Claude's composition behavior

Edit `backend/claude_service.py` → `SYSTEM_PROMPT`

### Modify notation formatting

Edit `backend/engraving_service.py` → `ENGRAVING_SYSTEM_PROMPT`

## Debugging

### OSMD won't render

```
Error: given music sheet was incomplete or could not be loaded
```

- MusicXML has invalid structure (durations don't sum to measure, missing elements)
- Check backend logs for validation errors
- The engraving agent might have broken something - check `Engraved validation: valid=False`

### Streaming not receiving complete message

- Large JSON payloads split across TCP chunks
- SSE parser must buffer by `\n\n`, not `\n`
- Check console for "SSE parse error"

### No sound

- Web Audio needs user gesture first
- Check `audioPlayer.play()` is called after click

## Ports

- Vite dev: `http://localhost:5173`
- Backend: `http://127.0.0.1:8765`
- Electron DevTools: Cmd+Opt+I

## Scripts

```bash
npm run dev:electron  # Full dev mode with hot reload
npm run dev           # Vite only (no Electron)
npm run build         # Production build
```

## License

MIT with Attribution - free to use and modify, but you must credit "OpenMuse by Daniel Ostrow" in any derivative work. See [LICENSE](LICENSE) for details.
