import { writable, derived, get } from 'svelte/store';
import { selection } from './selection';
import { score } from './score';

export interface MeasureReference {
  type: 'single' | 'range';
  start: number;
  end?: number;
  partId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Command status (for user commands)
  status?: 'pending' | 'success' | 'error';
  errorMessage?: string;
  // Selection context when command was issued
  selectionContext?: {
    startMeasure: number;
    endMeasure: number;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId: string;
  inputValue: string;
}

const defaultState: ChatState = {
  messages: [],
  isStreaming: false,
  conversationId: crypto.randomUUID(),
  inputValue: ''
};

// Command-based model: No AI responses shown, just user commands with status

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>(defaultState);

  return {
    subscribe,

    addUserMessage: (content: string) => {
      const currentSelection = get(selection);
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
        status: 'pending',
        selectionContext: currentSelection.startMeasure !== null ? {
          startMeasure: currentSelection.startMeasure,
          endMeasure: currentSelection.endMeasure || currentSelection.startMeasure
        } : undefined
      };

      update(state => ({
        ...state,
        messages: [...state.messages, message],
        inputValue: ''
      }));

      return message;
    },

    markCommandSuccess: (messageId: string) => {
      update(state => ({
        ...state,
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'success' as const } : msg
        ),
        isStreaming: false
      }));
    },

    markCommandError: (messageId: string, errorMessage: string) => {
      update(state => ({
        ...state,
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'error' as const, errorMessage } : msg
        ),
        isStreaming: false
      }));
    },

    setStreaming: (streaming: boolean) => {
      update(state => ({ ...state, isStreaming: streaming }));
    },

    setInputValue: (value: string) => {
      update(state => ({ ...state, inputValue: value }));
    },

    reset: () => {
      set({
        ...defaultState,
        conversationId: crypto.randomUUID()
      });
    },

    loadHistory: (messages: ChatMessage[]) => {
      update(state => ({
        ...state,
        messages
      }));
    }
  };
}

export const chat = createChatStore();

export const commandCount = derived(chat, $chat => $chat.messages.length);
export const hasPendingCommand = derived(chat, $chat =>
  $chat.messages.some(m => m.status === 'pending')
);
