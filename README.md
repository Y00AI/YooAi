# 🦀 YooAI — OpenClaw Agent Dashboard

OpenClaw AI Agent 的实时可视化仪表盘。监控 Agent 的情绪、灵魂动画、大脑记忆和活动时间线。

> **原项目**: [Y00AI/YooAI](https://github.com/Y00AI/YooAI)
>
> 本项目 Fork 自原项目，并在此基础上进行了功能扩展和优化。

---

## ✨ 功能特性

### 原版功能

- 🧠 **Agent 情绪** — 实时情绪条，响应 Agent 活动
- 🌀 **Agent 灵魂** — 7 种情绪状态的粒子动画（休眠、思考、专注、兴奋、沮丧、沉浸、疲惫）
- ⚡ **活动时间线** — 任务、消息、工具调用和 Token 的滚动日志
- 🔮 **大脑记忆** — 实时神经网络动画（蓝色=回忆、黄色=活跃、粉色=新建）
- 🪙 **Token 计数器**
- 📊 **进度条**

### 🆕 v2 新增功能

- 💬 **聊天面板 v2** — 全新设计的聊天界面，支持左右分栏布局
  - 实时消息流显示
  - 代码拆分，模块化架构
  - 流式消息渲染
  - 日期分隔符
  - 消息分组

- 🛠️ **工具调用可视化** — 展示 Agent 调用的工具及执行状态
  - 不同工具类型显示不同颜色
  - 实时状态获取

- 📜 **聊天历史加载** — 自动加载并展示历史对话记录

- 🌐 **中文界面支持** — 完整的中文本地化

- 🔧 **Gateway 协议优化** — 修复并完善与 OpenClaw Gateway 的通信协议

---

## 🚀 安装与运行

### 环境要求
- [Bun](https://bun.sh) 或 Node.js (v18+)
- 本地运行的 [OpenClaw](https://github.com/your-openclaw-link)

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/chinabaijunjie/YooAi.git
cd YooAi

# 安装依赖
bun install
# 或
npm install

# 开发模式（带 DevTools）
bun run dev

# 生产模式
bun run start

# 构建应用
bun run build        # 当前平台
bun run build:mac    # macOS DMG
bun run build:win    # Windows NSIS
bun run build:linux  # Linux AppImage
```

### 连接配置

1. 启动应用后点击 **配置**
2. 粘贴你的 OpenClaw Gateway Token
3. 点击 **连接**

Token 可在 OpenClaw 的 `config.json` 文件中找到。

---

## 📁 项目结构

```
├── electron/
│   └── main.js          # Electron 主进程，HTTP + WebSocket 服务
├── public/
│   ├── index.html       # 主页面，三栏布局
│   ├── css/
│   │   ├── main.css     # 核心样式，玻璃态效果
│   │   └── chat.css     # 聊天面板样式
│   └── js/
│       ├── app.js       # 主逻辑，事件路由
│       ├── gateway.js   # WebSocket 连接管理
│       ├── chat.js      # 聊天面板控制
│       ├── chat-normalizer.js  # 消息标准化
│       ├── chat-tool-cards.js  # 工具卡片组件
│       ├── canvas-bg.js       # 背景动画
│       ├── canvas-brain.js    # 神经网络可视化
│       └── canvas-cyborg.js   # 灵魂粒子动画
└── package.json
```

---

## 📄 许可证

原项目基于 **CC BY-ND 4.0** 许可证。

---

## 🙏 致谢

- 感谢 [Y00AI](https://github.com/Y00AI) 创建的原项目
- 感谢 OpenClaw 团队

---

## ☕ 支持原作者

如果你觉得原项目有用，可以考虑请原作者喝杯咖啡！

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/yooai)
