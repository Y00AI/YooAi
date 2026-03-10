#!/bin/bash
cd /Users/baijunjie/Documents/infra/YooAI

# 启动 Claude Code
claude --dangerously-skip-permissions "你是一个前端开发工程师。
当前任务是为 YooAI 添加聊天窗口功能。

## ⚠️ 重要：先阅读设计稿
docs/chat-panel-design.md

## 核心要求

### 1. 布局（重要！）
- **左侧面板完全不动**（心情、灵魂、Token、日志等保持原样）
- **右侧新增聊天窗口**（全新区域，不是TAB）
- 使用 CSS Flexbox 实现左右分栏
- 左侧固定宽度，右侧自适应

### 2. 代码拆分（重要！）
必须拆分代码，不能全部放在 index.html：

\`\`\`
public/
├── index.html      # 精简的 HTML
├── css/
│   ├── main.css    # 原有样式
│   └── chat.css    # 聊天样式
└── js/
    ├── app.js      # 主逻辑
    ├── chat.js     # 聊天功能
    └── gateway.js  # WebSocket
\`\`\`

### 3. 功能
- 消息列表（用户右对齐，AI左对齐）
- Markdown 渲染（marked.js）
- 输入框 + 发送按钮
- Cmd+Enter 发送

### 4. 风格
保持 YooAI 风格：
- 深色背景 #0a0a0d
- 霓虹橙 #FF5A36
- 噪点纹理
- 圆角 12px

## 开发步骤
1. 拆分现有代码（CSS/JS 分离）
2. 修改 HTML 结构（左右分栏）
3. 实现聊天 UI
4. 实现消息收发

## 完成后
运行: openclaw system event --text 'Done: 聊天窗口 v2 完成' --mode now"
