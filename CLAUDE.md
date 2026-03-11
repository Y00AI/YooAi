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

### 前端结构 (`public/`)
```
public/
├── index.html           # 主 HTML，左-中-右面板布局
├── css/
│   ├── main.css         # 核心样式，玻璃态效果，动画
│   └── chat.css         # 聊天面板专用样式
└── js/
    ├── app.js           # 主应用逻辑，事件路由，情绪状态，时间线
    ├── gateway.js       # WebSocket 连接管理
    ├── chat.js          # 聊天面板（消息、流式输出、输入）
    ├── chat-status.js   # 智能体状态显示（空闲/思考/输出中）
    ├── chat-message-utils.js  # 日期分割线、输入指示器、消息分组
    ├── chat-tool-cards.js     # 工具调用可视化
    ├── chat-normalizer.js     # 消息规范化为 ChatItem 格式
    ├── canvas-bg.js     # 背景浮游球动画
    ├── canvas-brain.js  # 神经网络记忆可视化
    └── canvas-cyborg.js # 智能体灵魂粒子动画（7种情绪状态）
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
- **canvas-cyborg.js** - 粒子系统，7种情绪状态：`sleeping`、`thinking`、`focused`、`excited`、`frustrated`、`vibing`、`exhausted`。通过 `window._setCyborgMood(mood)` 和 `window._soulEnergy` 控制
- **canvas-brain.js** - 神经网络可视化。通过 `window._brainFire(nodeId, intensity)` 触发节点。颜色：蓝色=回忆，黄色=活跃，粉色=新建

## 关键文件

- `electron/main.js:103-183` - WebSocket 代理与 OpenClaw 认证握手
- `public/js/app.js:527-629` - 智能体事件处理（生命周期 + assistant 流）
- `public/js/app.js:631-695` - Chat 事件处理，含 runId 去重
- `public/js/app.js:88-234` - `loadChatHistory()` 连接时加载聊天历史
- `public/js/chat.js:199-240` - `appendToStream()` 流式消息处理
- `public/js/chat.js:265-333` - 工具调用/结果卡片处理
- `public/js/gateway.js:93-128` - `request()` 方法用于异步网关请求
- `public/js/gateway.js:133-155` - 消息处理与分发

## 开发备注

- 使用 Bun 作为 JavaScript 运行时（非 Node.js）
- Canvas 动画使用 requestAnimationFrame 循环
- 情绪条通过 app.js 中的 `onEvent()` 回调响应智能体事件
- 大脑记忆可视化从 `~/.openclaw/workspace/memory/` 读取
- 聊天支持 Markdown（通过 marked.js）和消毒（通过 DOMPurify）
- 消息去重使用 `processedRunIds` 和 `streamedRunIds` Set 防止重复显示
- UI 为中文 (zh-CN)
