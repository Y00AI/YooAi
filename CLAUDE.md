# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Project Overview

YooAI is an Electron desktop app that serves as a real-time visual dashboard for OpenClaw AI agents. It displays agent mood, soul animation, brain memory visualization, activity timeline, and a chat interface.

> **Fork of**: [Y00AI/YooAI](https://github.com/Y00AI/YooAI) - This version adds chat panel v2, tool visualization, Chinese UI, and more.

## Commands
```bash
bun install          # Install dependencies
bun run dev          # Start in development mode (opens DevTools)
bun run start        # Start in production mode
bun run build        # Build for current platform
bun run build:mac    # Build macOS DMG
bun run build:win    # Build Windows NSIS installer
bun run build:linux  # Build Linux AppImage
```

## Architecture

### Electron Main Process (`electron/main.js`)
- Runs HTTP + WebSocket server on port 8765 (auto-increments if in use)
- Proxies WebSocket connections to OpenClaw gateway (127.0.0.1:18789)
- Handles gateway authentication token storage in `~/.openclaw/openclaw.json`
- Serves static files from `public/` directory
- Provides HTTP API endpoints:
  - `GET /api/config` - gateway host/port/hasToken
  - `POST /api/set-token` - save auth token
  - `GET /api/memory` - list memory files from workspace

### Frontend Structure (`public/`)
```
public/
├── index.html           # Main HTML with left-center-right panel layout
├── css/
│   ├── main.css         # Core styles, glass morphism, animations
│   └── chat.css         # Chat panel specific styles
└── js/
    ├── app.js           # Main app logic, event routing, mood state, timeline
    ├── gateway.js       # WebSocket connection management
    ├── chat.js          # Chat panel (messages, streaming, input)
    ├── chat-status.js   # Agent status display (idle/thinking/streaming)
    ├── chat-message-utils.js  # Date dividers, typing indicator, grouping
    ├── chat-tool-cards.js     # Tool call visualization
    ├── chat-normalizer.js     # Message normalization to ChatItem format
    ├── canvas-bg.js     # Background blob animation
    ├── canvas-brain.js  # Neural network memory visualization
    └── canvas-cyborg.js # Agent soul particle animation (7 mood states)
```

### Chat Module Architecture

The chat system uses a pipeline: **Gateway → App.js → Chat.js → ChatNormalizer → DOM**

1. **ChatNormalizer** (`chat-normalizer.js`) - Converts raw messages to unified `ChatItem` format:
   - Types: `message`, `divider`, `stream`, `reading-indicator`
   - Handles content normalization (string/array/object → `Array<MessageContentItem>`)
   - Integrates with `ChatToolCards` for tool visualization

2. **ChatMessageUtils** (`chat-message-utils.js`) - UI utilities:
   - Date dividers with "今天"/"昨天"/"M/D" labels (Chinese)
   - Typing indicator with animated dots
   - Message grouping by sender and time gap

3. **Chat** (`chat.js`) - Main chat controller:
   - `addMessage()` - add complete message
   - `appendToStream()` - stream text chunks
   - `endStream()` - finalize streaming message
   - `appendToolCall()` / `appendToolResult()` - tool card handling
   - Uses marked.js for Markdown, DOMPurify for sanitization

4. **ChatToolCards** (`chat-tool-cards.js`) - Tool call visualization:
   - Different colors for different tool types
   - Status indicators (running/completed/failed)

### OpenClaw Gateway Protocol

Events received via WebSocket have format `{ type: "event", event: string, payload: object }`:

- **`agent`** events with `stream` types:
  - `lifecycle` + `phase: "start"` → agent started processing (show typing indicator)
  - `lifecycle` + `phase: "end"` → agent finished (hide typing, end stream)
  - `assistant` + `delta` → streaming text chunks
  - `assistant` + `type: "tool_call"` → tool call started
  - `assistant` + `type: "tool_result"` → tool execution result
- **`chat`** / **`chat.message`** - final message state (uses `runId` for deduplication)
- **`tick`** - heartbeat with stats snapshot
- **`health`** - system health status

**Request/Response Pattern**: Use `Gateway.request(method, params)` for async calls:
```javascript
const result = await Gateway.request('chat.history', { sessionKey: 'main', limit: 100 });
const status = await Gateway.request('status', {});
```

### Message Flow

1. User sends message → `chat.send` method via WebSocket (`public/js/chat.js:141-157`)
2. Gateway responds with `agent` lifecycle `start` → show typing indicator
3. Agent streams `assistant` events with `delta` text → `appendToStream()`
4. Gateway sends `agent` lifecycle `end` → hide typing, end stream
5. `chat` events provide final message state (deduplicated via `runId`)

### Canvas Animations

- **canvas-bg.js** - Floating blob background with CSS keyframe animations
- **canvas-cyborg.js** - Particle system with 7 mood states: `sleeping`, `thinking`, `focused`, `excited`, `frustrated`, `vibing`, `exhausted`. Controlled via `window._setCyborgMood(mood)` and `window._soulEnergy`
- **canvas-brain.js** - Neural network visualization. Fires nodes via `window._brainFire(nodeId, intensity)`. Colors: blue=recall, yellow=active, pink=new

## Key Files

- `electron/main.js:103-183` - WebSocket proxy with OpenClaw auth handshake
- `public/js/app.js:527-629` - Agent event handling (lifecycle + assistant streams)
- `public/js/app.js:631-695` - Chat event handling with runId deduplication
- `public/js/app.js:88-234` - `loadChatHistory()` for loading chat history on connect
- `public/js/chat.js:199-240` - `appendToStream()` for streaming messages
- `public/js/chat.js:265-333` - Tool call/result card handling
- `public/js/gateway.js:93-128` - `request()` method for async gateway requests
- `public/js/gateway.js:133-155` - Message processing and dispatch

## Development Notes

- Uses Bun as JavaScript runtime (not Node.js directly)
- Canvas animations use requestAnimationFrame loops
- Mood bars respond to agent events via `onEvent()` callback in app.js
- Brain memory visualization reads from `~/.openclaw/workspace/memory/`
- Chat supports Markdown via marked.js and sanitization via DOMPurify
- Message deduplication uses `processedRunIds` and `streamedRunIds` Sets to prevent duplicate display
- UI is in Chinese (zh-CN)
