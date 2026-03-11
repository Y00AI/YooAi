/**
 * @file app.js
 * @description YooAI 主应用逻辑模块 - 负责整体应用初始化、UI组件、全局功能
 * @module YooAI/App
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - Gateway (gateway.js) - WebSocket 连接管理
 * - Chat (chat.js) - 聊天面板管理
 * - ChatStatus (chat-status.js) - 状态显示
 * - ChatToolCards (chat-tool-cards.js) - 工具卡片组件
 * - MoodSystem (core/mood-system.js) - 情绪系统
 * - EventRouter (core/event-router.js) - 事件路由
 * - SessionManager (core/session-manager.js) - 会话管理
 *
 * @exports
 * - window.YooAI.init() - 初始化应用
 * - window.YooAI.onEvent() - 触发情绪事件（代理到MoodSystem）
 * - window.openModal() - 打开设置模态框
 * - window.closeModal() - 关闭设置模态框
 * - window.saveAndConnect() - 保存令牌并连接
 * - window.clearTimeline() - 清空时间线
 * - window.loadMemory() - 加载记忆文件
 *
 * @example
 * // 初始化应用
 * YooAI.init();
 *
 * // 触发情绪变化
 * YooAI.onEvent({ vibe: +5, brain: -0.5 });
 *
 * @architecture
 * 数据流: Gateway → EventRouter → Chat.js → DOM
 *
 * 模块职责划分:
 * - app.js: 应用初始化、UI组件、全局功能
 * - MoodSystem: 情绪状态管理和渲染
 * - EventRouter: 网关事件分发和处理
 * - SessionManager: 会话状态管理
 */

(function() {
  'use strict';

  // === STATE ===
  let autoScroll = true;
  let logs = [];
  let msgCount = 0;

  // === INIT ===
  function init() {
    initTitlebar();
    initFloatingBits();
    initDevTools();

    // 初始化 Core 模块
    if (typeof MoodSystem !== 'undefined') MoodSystem.init();
    if (typeof EventRouter !== 'undefined') EventRouter.init();
    if (typeof SessionManager !== 'undefined') SessionManager.init();

    initChatHandlers();

    // Initialize background canvas (cyborg and brain auto-init)
    if (typeof initBg === 'function') initBg('bgCanvas');

    // Auto-connect after short delay
    setTimeout(() => {
      if (typeof Gateway !== 'undefined') Gateway.connect();
    }, 700);
  }

  // === CHAT HANDLERS ===
  function initChatHandlers() {
    // Chat will be initialized when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof Chat !== 'undefined') Chat.init();
      });
    } else {
      if (typeof Chat !== 'undefined') Chat.init();
    }
  }

  /**
   * Load chat history from gateway
   */
  async function loadChatHistory() {
    try {
      const sessionKey = typeof SessionManager !== 'undefined'
        ? SessionManager.getCurrentSessionKey()
        : 'agent:main:main';

      const result = await Gateway.request('chat.history', {
        sessionKey: sessionKey,
        limit: 100
      });

      if (result && Array.isArray(result.messages)) {
        // Clear existing messages first
        if (typeof Chat !== 'undefined') {
          Chat.clear();
        }

        let loadedCount = 0;

        // Add each message
        for (const msg of result.messages) {
          if (!msg || (!msg.content && !msg.text)) continue;

          const content = msg.content;
          const role = msg.role || 'user';
          const timestamp = msg.timestamp || Date.now();

          // 跳过 assistant 的中间过程（只显示最终结果）
          if (role === 'assistant' && msg.stopReason && msg.stopReason !== 'stop') {
            continue;
          }

          // 处理 toolResult 消息（role === 'toolResult'）
          if (role === 'toolResult') {
            if (typeof ChatToolCards !== 'undefined') {
              const resultText = Array.isArray(content)
                ? content.map(c => c.text || '').join('')
                : (typeof content === 'string' ? content : JSON.stringify(content));

              const card = ChatToolCards.createToolResultCard({
                name: msg.toolName || msg.tool_name || 'Tool',
                text: resultText,
                success: !msg.isError && !msg.is_error
              });

              if (card && typeof Chat !== 'undefined') {
                Chat.appendElement(card);
                loadedCount++;
              }
            }
            continue;
          }

          // 字符串内容：直接添加
          if (typeof content === 'string') {
            if (content) {
              Chat.addMessage({ role, content, timestamp });
              loadedCount++;
            }
            continue;
          }

          // 非数组内容
          if (!Array.isArray(content)) {
            const text = msg.text || JSON.stringify(content);
            if (text) {
              Chat.addMessage({ role, content: text, timestamp });
              loadedCount++;
            }
            continue;
          }

          // 数组内容：分类处理
          const textParts = [];
          const specialItems = [];

          for (const item of content) {
            if (!item) continue;

            const itemType = item.type;

            if (itemType === 'text') {
              textParts.push(item.text || '');
            } else if (itemType === 'toolCall' || itemType === 'tool_use') {
              specialItems.push({
                type: 'toolCall',
                name: item.name || item.tool_name || 'Tool',
                args: item.input || item.arguments || item.args
              });
            } else if (itemType === 'thinking') {
              specialItems.push({
                type: 'thinking',
                content: item.thinking || item.text || ''
              });
            }
          }

          // 添加文本消息（如果有）
          const textContent = textParts.join('');
          if (textContent) {
            Chat.addMessage({ role, content: textContent, timestamp });
            loadedCount++;
          }

          // 添加特殊类型卡片（toolCall、thinking）
          for (const item of specialItems) {
            if (typeof ChatToolCards === 'undefined') {
              continue;
            }

            let card = null;
            if (item.type === 'toolCall') {
              card = ChatToolCards.createToolCallCard({
                name: item.name,
                args: item.args,
                status: 'completed'
              });
            } else if (item.type === 'thinking') {
              card = ChatToolCards.createThinkingCard({
                content: item.content,
                summary: 'Thinking'
              });
            }

            if (card && typeof Chat !== 'undefined') {
              Chat.appendElement(card);
              loadedCount++;
            }
          }
        }

        // 从后端 API 加载时间线历史
        loadTimelineHistory();
      }
    } catch (err) {
      // 静默处理加载历史失败
    }
  }

  /**
   * Load timeline history from backend API
   * 从 /api/timeline/:sessionKey 获取完整的时间线数据
   */
  async function loadTimelineHistory() {
    try {
      const sessionKey = typeof SessionManager !== 'undefined'
        ? SessionManager.getCurrentSessionKey()
        : 'agent:main:main';

      // 调用后端 API 获取时间线数据
      const response = await fetch(`/api/timeline/${encodeURIComponent(sessionKey)}`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.error) {
        console.error('[Timeline] API error:', data.error);
        return;
      }

      // 清空现有时间线
      const list = document.getElementById('timelineList');
      if (!list) {
        return;
      }
      list.textContent = '';

      // 重置统计变量（通过 EventRouter）
      if (typeof EventRouter !== 'undefined') {
        EventRouter.resetStats();
      }

      // 移除空状态提示
      const empty = document.getElementById('tlEmpty');
      if (empty) empty.remove();

      const timeline = data.timeline || [];
      const conversations = data.conversations || [];
      const stats = data.stats || {};

      // 按对话分组时间线项目
      // 每个用户消息开始一个新的分组
      const groups = [];
      let currentGroup = null;

      for (const item of timeline) {
        if (!item || typeof item !== 'object') continue;

        // 用户消息开始新分组
        if (item.type === 'message' && item.subtype === 'user') {
          if (currentGroup && currentGroup.items.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = {
            startMs: item.timestamp || Date.now(),
            endMs: item.timestamp || Date.now(),
            items: [item],
            hasUser: true,
            hasAssistant: false,
            tools: 0,
            errors: 0,
            tokens: { input: 0, output: 0, total: 0 }
          };
        } else if (currentGroup) {
          // 添加到当前分组
          currentGroup.items.push(item);
          currentGroup.endMs = item.timestamp || currentGroup.endMs;

          if (item.type === 'message' && item.subtype === 'assistant') {
            currentGroup.hasAssistant = true;
          } else if (item.type === 'tool') {
            currentGroup.tools++;
          } else if (item.type === 'error') {
            currentGroup.errors++;
          }

          // 累加 tokens
          if (item.tokens) {
            currentGroup.tokens.input += item.tokens.input || 0;
            currentGroup.tokens.output += item.tokens.output || 0;
            currentGroup.tokens.total += item.tokens.total || 0;
          }
        }
      }

      // 添加最后一个分组
      if (currentGroup && currentGroup.items.length > 0) {
        groups.push(currentGroup);
      }

      // 只显示最近 20 个分组
      const recentGroups = groups.slice(-20);

      // 渲染每个分组
      for (const group of recentGroups) {
        try {
          renderTimelineGroup(list, group);
        } catch (renderErr) {
          console.error('[Timeline] Error rendering group:', renderErr);
        }
      }

      // 更新统计显示（从 API 返回的 stats 更新）
      const tlTasksEl = document.getElementById('tlTasks');
      const tlMsgsEl = document.getElementById('tlMsgs');
      const tlToolsEl = document.getElementById('tlTools');
      const tlErrorsEl = document.getElementById('tlErrors');
      const tlTokenRateEl = document.getElementById('tlTokenRate');
      const tokenCountEl = document.getElementById('tokenCount');

      // 使用 API 返回的统计数据
      if (tlTasksEl) tlTasksEl.textContent = stats.totalConversations || 0;
      if (tlMsgsEl) tlMsgsEl.textContent = stats.totalMessages || 0;
      if (tlToolsEl) tlToolsEl.textContent = stats.totalTools || 0;
      if (tlErrorsEl) tlErrorsEl.textContent = stats.totalErrors || 0;

      // 更新 Token 计数
      const totalTokens = stats.totalTokens?.sum || 0;
      if (tokenCountEl) {
        if (totalTokens >= 1000) {
          const k = totalTokens / 1000;
          tokenCountEl.textContent = (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
        } else {
          tokenCountEl.textContent = totalTokens;
        }
      }

      // 更新令牌率（每任务平均 Token）
      if (tlTokenRateEl) {
        tlTokenRateEl.textContent = stats.totalConversations > 0
          ? Math.round(totalTokens / stats.totalConversations)
          : 0;
      }

    } catch (err) {
      console.error('[Timeline] Failed to load timeline history:', err.message, err.stack);
    }
  }

  /**
   * 渲染单个时间线分组
   */
  function renderTimelineGroup(list, group) {
    // 从用户消息提取标签
    const userItem = group.items.find(i => i.type === 'message' && i.subtype === 'user');
    let label = '';

    if (userItem && userItem.text) {
      let displayText = String(userItem.text);

      // 检查是否是心跳消息（以 "Read HEARTBEAT.md" 开头）
      if (displayText.startsWith('Read HEARTBEAT.md')) {
        displayText = '心跳检查';
      } else {
        // 尝试提取用户实际输入的内容
        // 格式：[Wed 2026-03-11 14:26 GMT+8] 用户输入内容
        // 匹配 [星期 年-月-日 时:分 GMT+时区] 后面的内容
        const userInputMatch = displayText.match(/\[[A-Za-z]+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} GMT[+-]?\d+\]\s*(.+)$/s);
        if (userInputMatch && userInputMatch[1]) {
          // 提取到用户输入，去掉 JSON metadata 部分
          displayText = userInputMatch[1].trim();
        } else if (displayText.startsWith('Sender (untrusted metadata)')) {
          // 如果有 Sender 但没有找到用户输入格式，可能是纯心跳
          displayText = '心跳检查';
        }
      }

      // 截取显示文本
      const snippet = displayText.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().slice(0, 40);
      label = snippet ? '💬 ' + snippet + (displayText.length > 40 ? '…' : '') : '💬 用户消息';
    } else if (group.hasAssistant) {
      label = '✨ Agent 响应';
    } else {
      label = '✨ 活动';
    }

    const dur = formatDuration(group.endMs - group.startMs);
    const time = new Date(group.startMs).toTimeString().slice(0, 8);

    // Create entry element
    const el = document.createElement('div');
    el.className = 'tl-entry';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'tl-icon';
    iconEl.textContent = group.errors > 0 ? '⚠️' : group.tools > 0 ? '🤖' : '💬';
    el.appendChild(iconEl);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'tl-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = label;
    bodyEl.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'tl-meta';

    // 根据是否有工具调用显示不同的标签
    if (group.tools > 0) {
      // 有工具调用 → Agent 类型：显示 AGENT + CHAT + TOOL 标签
      const agentTag = document.createElement('span');
      agentTag.className = 'tl-tag agent';
      agentTag.textContent = 'AGENT';
      metaEl.appendChild(agentTag);

      const chatTag = document.createElement('span');
      chatTag.className = 'tl-tag chat';
      chatTag.textContent = 'CHAT';
      metaEl.appendChild(chatTag);

      const toolTag = document.createElement('span');
      toolTag.className = 'tl-tag tool';
      toolTag.textContent = group.tools + ' TOOL' + (group.tools > 1 ? 'S' : '');
      metaEl.appendChild(toolTag);
    } else {
      // 无工具调用 → Chat 类型：只显示 CHAT 标签
      const chatTag = document.createElement('span');
      chatTag.className = 'tl-tag chat';
      chatTag.textContent = 'CHAT';
      metaEl.appendChild(chatTag);
    }

    // Add error count
    if (group.errors > 0) {
      const errEl = document.createElement('span');
      errEl.className = 'tl-tag error';
      errEl.textContent = group.errors + ' ERR';
      metaEl.appendChild(errEl);
    }

    bodyEl.appendChild(metaEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'tl-time';
    timeEl.textContent = time;
    bodyEl.appendChild(timeEl);

    el.appendChild(bodyEl);

    // Right side
    const rightEl = document.createElement('div');
    rightEl.className = 'tl-right';

    const durEl = document.createElement('div');
    durEl.className = 'tl-dur';
    durEl.textContent = dur;
    rightEl.appendChild(durEl);

    if (group.tokens.total > 0) {
      const tokEl = document.createElement('span');
      tokEl.className = 'tl-tokens';
      tokEl.textContent = '+' + (group.tokens.total >= 1000 ? (group.tokens.total / 1000).toFixed(1) + 'k' : group.tokens.total) + ' tok';
      rightEl.appendChild(tokEl);
    }

    el.appendChild(rightEl);

    list.insertBefore(el, list.firstChild);
  }

  /**
   * 格式化持续时间
   */
  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
  }

  /**
   * 更新时间线统计显示
   */
  function updateTimelineStats() {
    // 从 EventRouter 获取统计并更新 UI
    if (typeof EventRouter !== 'undefined') {
      const stats = EventRouter.getStats();
      const tlTasksEl = document.getElementById('tlTasks');
      const tlMsgsEl = document.getElementById('tlMsgs');
      const tlToolsEl = document.getElementById('tlTools');
      const tlErrorsEl = document.getElementById('tlErrors');
      const tlTokenRateEl = document.getElementById('tlTokenRate');

      if (tlTasksEl) tlTasksEl.textContent = stats.tlTasks;
      if (tlMsgsEl) tlMsgsEl.textContent = stats.tlMsgs;
      if (tlToolsEl) tlToolsEl.textContent = stats.tlTools;
      if (tlErrorsEl) tlErrorsEl.textContent = stats.tlErrors;
      if (tlTokenRateEl) tlTokenRateEl.textContent = stats.tlTasks > 0 ? Math.round(stats.tlTotalTokens / stats.tlTasks) : 0;
    }
  }

  // === DEVTOOLS ===
  function initDevTools() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (window.yooai && window.yooai.openDevTools) {
          window.yooai.openDevTools();
        }
      }
    });
  }

  // === TITLEBAR ===
  function initTitlebar() {
    if (window.yooai && window.yooai.platform === 'win32') {
      const titlebar = document.getElementById('titlebar');
      if (titlebar) {
        titlebar.classList.add('win');
        document.body.classList.add('has-titlebar');
      }
    }
  }

  // === FLOATING BITS ===
  function initFloatingBits() {
    const bEl = document.getElementById('bits');
    if (!bEl) return;

    ['◆','◇','✦','△','✧','⟡'].forEach((c, i) => {
      for (let j = 0; j < 3; j++) {
        const b = document.createElement('div');
        b.className = 'bit';
        b.textContent = c;
        b.style.cssText = `
          left: ${Math.random() * 100}vw;
          animation-duration: ${18 + Math.random() * 22}s;
          animation-delay: ${Math.random() * 30}s;
          font-size: ${8 + Math.random() * 10}px;
          color: ${['rgba(100,220,220,.4)', 'rgba(245,130,105,.4)', 'rgba(247,195,155,.4)', 'rgba(242,165,195,.4)', 'rgba(249,228,140,.4)'][Math.floor(Math.random() * 5)]}
        `;
        bEl.appendChild(b);
      }
    });
  }

  // === GLOBAL FUNCTIONS ===
  window.openModal = function() {
    fetch('/api/config').then(r => r.json()).then(c => {
      const modalGwInfo = document.getElementById('modalGwInfo');
      if (modalGwInfo) modalGwInfo.textContent = c.gatewayHost + ':' + c.gatewayPort;

      const statusEl = document.getElementById('tokenStatus');
      if (statusEl) {
        if (c.hasToken) {
          statusEl.textContent = '✓ 在 ~/.openclaw/openclaw.json 中找到令牌';
          statusEl.style.color = '#a0ffc8';
          const cfgToken = document.getElementById('cfgToken');
          if (cfgToken) cfgToken.placeholder = '•••••••••••• (令牌已设置 — 粘贴以替换)';
        } else {
          statusEl.textContent = '⚠ 未找到令牌 — 请在下方粘贴您的网关令牌';
          statusEl.style.color = '#f9a98e';
        }
      }
    }).catch(() => {});

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('open');
  };

  window.closeModal = function() {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('open');
  };

  window.toggleTokenVis = function() {
    const inp = document.getElementById('cfgToken');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  window.saveAndConnect = async function() {
    const tokenEl = document.getElementById('cfgToken');
    const token = tokenEl ? tokenEl.value.trim() : '';
    const saveMsg = document.getElementById('saveMsg');
    const saveBtn = document.getElementById('saveBtn');

    if (token) {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      try {
        const r = await fetch('/api/set-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (!r.ok) throw new Error('Save failed');

        if (saveMsg) {
          saveMsg.textContent = '✓ Token saved!';
          saveMsg.style.color = '#a0ffc8';
        }
        if (tokenEl) {
          tokenEl.value = '';
          tokenEl.placeholder = '•••••••••••• (token saved — paste to replace)';
        }
        const tokenStatus = document.getElementById('tokenStatus');
        if (tokenStatus) {
          tokenStatus.textContent = '✓ Saved to ~/.openclaw/openclaw.json';
          tokenStatus.style.color = '#a0ffc8';
        }
        closeModal();
        if (typeof Gateway !== 'undefined') Gateway.connect();
      } catch (e) {
        if (saveMsg) {
          saveMsg.textContent = '✗ ' + e.message;
          saveMsg.style.color = '#f9a98e';
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 保存并连接';
        }
      }
    } else {
      closeModal();
      if (typeof Gateway !== 'undefined') Gateway.connect();
    }
  };

  window.clearTimeline = function() {
    const list = document.getElementById('timelineList');
    if (list) {
      // Clear using DOM methods
      list.textContent = '';

      const emptyEl = document.createElement('div');
      emptyEl.className = 'tl-empty';
      emptyEl.id = 'tlEmpty';

      const iconEl = document.createElement('span');
      iconEl.style.fontSize = '28px';
      iconEl.textContent = '✨';

      const textEl = document.createElement('div');
      textEl.style.fontSize = '11px';
      textEl.style.fontWeight = '700';
      textEl.style.color = 'rgba(255,255,255,0.3)';
      textEl.style.marginTop = '6px';
      textEl.textContent = '等待活动...';

      emptyEl.appendChild(iconEl);
      emptyEl.appendChild(textEl);
      list.appendChild(emptyEl);
    }

    // 重置 EventRouter 统计
    if (typeof EventRouter !== 'undefined') {
      EventRouter.resetStats();
    }

    ['tlTasks', 'tlMsgs', 'tlTools', 'tlErrors', 'tlTokenRate', 'tokenCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });

    const sessionTimer = document.getElementById('sessionTimer');
    if (sessionTimer) sessionTimer.textContent = '--:--';
  };

  window.loadMemory = async function() {
    const g = document.getElementById('memGrid');
    if (!g) return;

    // Clear and show loading
    g.textContent = '';

    const loadingEl = document.createElement('div');
    loadingEl.className = 'mem-empty';

    const loadingIcon = document.createElement('span');
    loadingIcon.textContent = '⏳';

    const loadingText = document.createTextNode('Loading...');

    loadingEl.appendChild(loadingIcon);
    loadingEl.appendChild(loadingText);
    g.appendChild(loadingEl);

    try {
      const r = await fetch('/api/memory');
      if (!r.ok) throw 0;
      const d = await r.json();
      const files = d.files || d.memories || d || [];

      g.textContent = '';

      if (!files.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'mem-empty';

        const emptyIcon = document.createElement('span');
        emptyIcon.textContent = '🧠';

        const emptyText = document.createTextNode('未找到记忆文件');

        emptyEl.appendChild(emptyIcon);
        emptyEl.appendChild(emptyText);
        g.appendChild(emptyEl);
        return;
      }

      files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'mem-item';

        const headEl = document.createElement('div');
        headEl.className = 'mem-head';

        const iconEl = document.createElement('span');
        iconEl.className = 'mem-icon';
        iconEl.textContent = '📝';

        const titleEl = document.createElement('span');
        titleEl.className = 'mem-title';
        titleEl.textContent = f.name || f.filename || 'Memory';

        const dateEl = document.createElement('span');
        dateEl.className = 'mem-date';
        dateEl.textContent = f.date || '';

        headEl.appendChild(iconEl);
        headEl.appendChild(titleEl);
        headEl.appendChild(dateEl);

        const previewEl = document.createElement('div');
        previewEl.className = 'mem-preview';
        previewEl.textContent = f.preview || f.content?.slice(0, 120) || '...';

        el.appendChild(headEl);
        el.appendChild(previewEl);
        g.appendChild(el);
      });
    } catch {
      g.textContent = '';

      // Add placeholder items
      const items = [
        { icon: '📝', title: 'MEMORY.md', date: 'today', preview: 'Connect Mission Control on port 3000 to view live memory files here' },
        { icon: '🌐', title: 'browser-tool-notes', date: '2026-03-03', preview: 'Browser tool syntax, Chrome relay setup, aria refs, troubleshooting tips saved from session' }
      ];

      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'mem-item';

        const headEl = document.createElement('div');
        headEl.className = 'mem-head';

        const iconEl = document.createElement('span');
        iconEl.className = 'mem-icon';
        iconEl.textContent = item.icon;

        const titleEl = document.createElement('span');
        titleEl.className = 'mem-title';
        titleEl.textContent = item.title;

        const dateEl = document.createElement('span');
        dateEl.className = 'mem-date';
        dateEl.textContent = item.date;

        headEl.appendChild(iconEl);
        headEl.appendChild(titleEl);
        headEl.appendChild(dateEl);

        const previewEl = document.createElement('div');
        previewEl.className = 'mem-preview';
        previewEl.textContent = item.preview;

        el.appendChild(headEl);
        el.appendChild(previewEl);
        g.appendChild(el);
      });
    }
  };

  // 代理 onEvent 到 MoodSystem
  window.onEvent = function(deltas) {
    if (typeof MoodSystem !== 'undefined') {
      MoodSystem.onEvent(deltas);
    }
  };

  // 暴露 YooAI 命名空间
  window.YooAI = {
    init,
    onEvent: window.onEvent,
    loadChatHistory,
    loadTimelineHistory
  };

  // === GATEWAY CONNECT HANDLER ===
  // 监听网关连接事件，加载聊天历史
  if (typeof Gateway !== 'undefined') {
    Gateway.onMessage((msg) => {
      if (msg.type === 'gateway.connected') {
        // Wait a bit for auth to complete
        setTimeout(() => loadChatHistory(), 1500);
      }
    });
  }

  // === INIT ON DOM READY ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
