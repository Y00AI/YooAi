# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

YooAI 是一个 Electron 桌面应用，作为 OpenClaw AI 智能体的实时可视化仪表盘。它显示智能体情绪、灵魂动画、大脑记忆可视化、活动时间线，以及聊天界面。

> **分支自**: [Y00AI/YooAI](https://github.com/Y00AI/YooAI) - 本版本新增聊天面板 v2、工具可视化、中文界面等功能。

## 命令
```bash
bun install          # 安装依赖
bun run dev          # 开发模式启动（自动打开 DevTools）
bun run start        # 生产模式启动
bun run build        # 构建当前平台
bun run build:mac    # 构建 macOS DMG
bun run build:win    # 构建 Windows NSIS 安装包
bun run build:linux  # 构建 Linux AppImage
```

## 架构

### Electron 主进程 (`electron/main.js`)
- 在端口 8765 运行 HTTP + WebSocket 服务器（如被占用则自动递增）
- 代理 WebSocket 连接到 OpenClaw 网关 (127.0.0.1:18789)
- 处理网关认证令牌存储于 `~/.openclaw/openclaw.json`
- 从 `public/` 目录提供静态文件服务
- 提供 HTTP API 端点：
  - `GET /api/config` - 获取网关 host/port/hasToken
  - `POST /api/set-token` - 保存认证令牌
  - `GET /api/memory` - 列出工作区记忆文件
  - `GET /api/timeline/:sessionKey` - 获取时间线历史数据（从 JSONL 解析）

### 前端结构 (`public/`)
```
public/
├── index.html           # 主 HTML，左-中-右面板布局
├── css/
│   ├── main.css         # 核心样式，玻璃态效果，动画
│   └── chat.css         # 聊天面板专用样式
└── js/
    ├── app.js                    # 主应用入口，历史加载，协调模块
    ├── gateway.js              # WebSocket 连接管理，消息分发
    ├── chat.js                  # 聊天面板控制器
    ├── chat-status.js          # 智能体状态显示（空闲/思考/输出中）
    ├── chat-message-utils.js   # 日期分割线、输入指示器
    ├── chat-tool-cards.js      # 工具调用可视化
    ├── chat-normalizer.js      # 消息规范化
    ├── canvas-bg.js            # 背景浮游球动画
    ├── canvas-brain.js         # 神经网络记忆可视化
    │
    ├── canvas/cyborg/          # 智能体灵魂动画模块
    │   ├── cyborg-core.js      # 主控制器
    │   ├── cyborg-moods.js     # 7种情绪状态定义
    │   ├── cyborg-effects.js   # 特效渲染
    │   └── cyborg-particles.js # 粒子系统
    │
    ├── core/                   # 核心模块
    │   ├── event-router.js     # 事件路由，消息处理
    │   ├── mood-system.js      # 情绪系统
    │   └── session-manager.js  # 会话管理
    │
    ├── timeline/              # 时间线模块
    │   ├── timeline-store.js   # 状态存储
    │   ├── timeline-renderer.js # UI 渲染
    │   └── timeline-utils.js   # 工具函数
    │
    ├── chat/                   # 聊天模块
    │   ├── chat-core.js        # 主控制器
    │   ├── chat-renderer.js    # 消息渲染
    │   └── chat-stream.js      # 流式输出
    │
    └── ui/                    # UI 组件
        ├── floating-bits.js    # 浮游粒子
        └── task-progress.js    # 任务进度条
```

### 聊天模块架构

聊天系统使用管道模式：**Gateway → App.js → Chat.js → ChatNormalizer → DOM**

1. **ChatNormalizer** (`chat-normalizer.js`) - 将原始消息转换为统一的 `ChatItem` 格式：
   - 类型：`message`、`divider`、`stream`、`reading-indicator`
   - 处理内容规范化（string/array/object → `Array<MessageContentItem>`）
   - 与 `ChatToolCards` 集成实现工具可视化

2. **ChatMessageUtils** (`chat-message-utils.js`) - UI 工具：
   - 日期分割线，显示"今天"/"昨天"/"M/D" 标签
   - 输入指示器（带动画圆点）
   - 按发送者和时间间隔分组消息

3. **Chat** (`chat.js`) - 主聊天控制器：
   - `addMessage()` - 添加完整消息
   - `appendToStream()` - 流式追加文本块
   - `endStream()` - 结束流式消息
   - `appendToolCall()` / `appendToolResult()` - 工具卡片处理
   - 使用 marked.js 解析 Markdown，DOMPurify 进行消毒

4. **ChatToolCards** (`chat-tool-cards.js`) - 工具调用可视化：
   - 不同工具类型显示不同颜色
   - 状态指示器（运行中/已完成/失败）

### OpenClaw 网关协议

通过 WebSocket 接收的事件格式为 `{ type: "event", event: string, payload: object }`：

- **`agent`** 事件包含 `stream` 类型：
  - `lifecycle` + `phase: "start"` → 智能体开始处理（显示输入指示器）
  - `lifecycle` + `phase: "end"` → 智能体完成（隐藏输入指示器，结束流）
  - `assistant` + `delta` → 流式文本块
  - `assistant` + `type: "tool_call"` → 工具调用开始
  - `assistant` + `type: "tool_result"` → 工具执行结果
- **`chat`** / **`chat.message`** - 最终消息状态（使用 `runId` 去重）
- **`tick`** - 心跳，包含统计快照
- **`health`** - 系统健康状态

**请求/响应模式**：使用 `Gateway.request(method, params)` 进行异步调用：
```javascript
const result = await Gateway.request('chat.history', { sessionKey: 'main', limit: 100 });
const status = await Gateway.request('status', {});
```

### 消息流程

1. 用户发送消息 → 通过 WebSocket 调用 `chat.send` 方法 (`public/js/chat.js:141-157`)
2. 网关响应 `agent` lifecycle `start` → 显示输入指示器
3. 智能体流式发送 `assistant` 事件带 `delta` 文本 → `appendToStream()`
4. 网关发送 `agent` lifecycle `end` → 隐藏输入指示器，结束流
5. `chat` 事件提供最终消息状态（通过 `runId` 去重）

### Canvas 动画

- **canvas-bg.js** - 浮游球背景，使用 CSS 关键帧动画
- **canvas-brain.js** - 神经网络可视化。通过 `window._brainFire(nodeId, intensity)` 触发节点。颜色：蓝色=回忆，黄色=活跃，粉色=新建
- **canvas/cyborg/** - 智能体灵魂粒子动画（IIFE 模式）：
  - `cyborg-core.js` - 主控制器，通过 `window._setCyborgMood(mood)` 和 `window._soulEnergy` 控制
  - `cyborg-moods.js` - 7种情绪状态定义：`sleeping`、`thinking`、`focused`、`excited`、`frustrated`、`vibing`、`exhausted`
  - `cyborg-effects.js` - 特效渲染器（辉光点、星形、光线）
  - `cyborg-particles.js` - 粒子池管理

### 时间线模块

- **timeline-store.js** - 状态管理：任务计数、消息计数、工具计数、错误计数、Token 统计
- **timeline-renderer.js** - UI 渲染：时间线条目、标签（AGENT/CHAT/TOOL/ERR）
- **timeline-utils.js** - 工具函数：时间格式化、持续时间计算

时间线统计通过 `EventRouter.getStats()` 获取，历史数据从 `/api/timeline/:sessionKey` API 加载。

## 关键文件

- `electron/main.js` - 主进程：WebSocket 代理、认证握手、Timeline API
- `public/js/app.js` - 主入口：初始化、历史加载、协调模块
- `public/js/gateway.js` - WebSocket 连接、消息分发、异步请求
- `public/js/core/event-router.js` - 事件路由、智能体事件处理、时间线统计
- `public/js/core/mood-system.js` - 情绪系统、空闲检测、情绪回调
- `public/js/chat/chat-core.js` - 聊天主控制器
- `public/js/chat/chat-stream.js` - 流式消息处理
- `public/js/canvas/cyborg/cyborg-core.js` - 智能体灵魂动画主控制器

## 开发备注

- 使用 Bun 作为 JavaScript 运行时（非 Node.js）
- Canvas 动画使用 requestAnimationFrame 循环
- 情绪条通过 MoodSystem.onEvent() 响应智能体事件
- 大脑记忆可视化从 `~/.openclaw/workspace/memory/` 读取
- 聊天支持 Markdown（通过 marked.js）和消毒（通过 DOMPurify）
- 消息去重使用 `processedRunIds` 和 `streamedRunIds` Set 防止重复显示
- UI 为中文 (zh-CN)

### 模块模式

前端 JS 模块使用 **IIFE (Immediately Invoked Function Expression)** 模式，通过全局命名空间暴露 API：

```javascript
// 模块定义
(function(global) {
  'use strict';
  // 私有变量和函数...

  // 暴露到全局
  window.ModuleName = {
    init,
    publicMethod,
    // ...
  };
})(typeof window !== 'undefined' ? window : this);
```

主要模块的全局命名空间：
- `window.Gateway` - WebSocket 连接管理
- `window.Chat` - 聊天面板控制器
- `window.ChatStatus` - 智能体状态显示
- `window.MoodSystem` - 情绪系统
- `window.EventRouter` - 事件路由
- `window.SessionManager` - 会话管理
- `window.CyborgMoods` / `CyborgEffects` / `CyborgParticles` - 灵魂动画模块
- `window.YooAI.TimelineStore` / `TimelineRenderer` / `TaskProgress` - 时间线模块
