/**
 * @file event-router.js
 * @description 事件路由模块 - 处理Gateway消息分发、智能体事件、聊天事件、工具事件等
 * @module YooAI/Core/EventRouter
 * @version 2.0.0
 * @author 张工
 *
 * @dependencies
 * - Gateway (gateway.js) - WebSocket连接管理
 * - Chat (chat.js) - 聊天面板管理
 * - ChatStatus (chat-status.js) - 状态显示
 * - ChatToolCards (chat-tool-cards.js) - 工具卡片组件
 * - MoodSystem (mood-system.js) - 情绪系统
 * - SessionManager (session-manager.js) - 会话管理
 *
 * @exports
 * - window.EventRouter.init() - 初始化事件路由
 * - window.EventRouter.handleMessage(msg) - 处理单个消息
 * - window.EventRouter.updateStats(d) - 更新统计信息
 *
 * @example
 * // 初始化事件路由
 * EventRouter.init();
 *
 * // 手动处理消息
 * EventRouter.handleMessage({ type: 'tick', payload: { ... } });
 *
 * @architecture
 * 消息处理流程:
 * Gateway → EventRouter.handleMessage() → 分发到对应处理器
 *
 * 支持的事件类型:
 * - tick: 心跳统计
 * - health: 健康状态
 * - agent: 智能体事件（lifecycle, assistant, tool_call, tool_result）
 * - chat/chat.message: 聊天消息
 * - tool.start/tool.end: 工具事件
 * - error: 错误事件
 */

(function() {
  'use strict';

  // === MESSAGE DEDUPLICATION ===
  const streamedRunIds = new Set(); // 已经通过 agent 流式显示的 runId
  const PROCESSED_RUNID_MAX = 100;  // 保留最近100个runId

  // === TIMELINE STATS (exposed for external access) ===
  let tlTasks = 0, tlMsgs = 0, tlTools = 0, tlErrors = 0;
  let tlTotalTokens = 0, tlSessionTokens = 0;
  let tlSessionStart = null;
  let tlCurrentTask = null;
  let tlTimerInterval = null;
  const TASK_DEBOUNCE = 5000;

  // === TASK PROGRESS ===
  let taskProgressStart = 0;
  let taskProgressDone = false;
  const TASK_DURATION_MS = 120000;

  // === LOGGING ===

  /**
   * 添加日志（生产环境不打印）
   * @param {string} type - 日志类型
   * @param {string} tag - 日志标签
   * @param {string} msg - 日志消息
   */
  function addLog(type, tag, msg) {
    // 生产环境不打印日志
  }

  // === STATS UPDATE ===

  /**
   * 更新统计信息
   * @param {Object} d - 统计数据
   */
  function updateStats(d) {
    const s = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null && v !== '' && v !== '—') el.textContent = v;
    };

    if (d.sessions && d.sessions.length > 0) {
      const active = d.sessions.find(sess => sess.active) || d.sessions[d.sessions.length - 1];
      if (active) {
        if (active.model) s('sModel', active.model.includes('/') ? active.model.split('/').pop() : active.model);
        const sid = active.key || active.id || '';
        if (sid) s('sSession', sid.length > 16 ? sid.slice(0, 16) + '…' : sid);
        if (active.totalTokens != null && active.contextTokens != null) {
          s('sContext', Math.round(active.totalTokens / active.contextTokens * 100) + '%');
        }
        if (active.messageCount != null) s('sMessages', active.messageCount);
        if (active.cost != null) {
          const sMessages = document.getElementById('sMessages');
          if (sMessages) sMessages.title = '$' + active.cost.toFixed(4);
        }
      }
    }

    const model = d.model || d.modelId || d.modelName || '';
    if (model) s('sModel', model.includes('/') ? model.split('/').pop() : model);
    s('sVersion', d.version || d.openclaw_version || d.gatewayVersion);
    const sid = d.sessionId || d.session || d.sessionKey || d.runId || d.key || '';
    if (sid) s('sSession', sid.length > 16 ? sid.slice(0, 16) + '…' : sid);
    if (d.reasoning != null) s('sReasoning', d.reasoning ? 'ON ✓' : 'OFF');
    if (d.extendedThinking != null) s('sReasoning', d.extendedThinking ? 'ON ✓' : 'OFF');
  }

  // === TIMELINE FUNCTIONS ===

  /**
   * 开始会话计时
   */
  function tlStartSession() {
    if (tlSessionStart) return;
    tlSessionStart = Date.now();
    tlTimerInterval = setInterval(() => {
      if (!tlSessionStart) return;
      const sec = Math.floor((Date.now() - tlSessionStart) / 1000);
      const m = Math.floor(sec / 60), secRemain = sec % 60;
      const timerEl = document.getElementById('sessionTimer');
      if (timerEl) {
        timerEl.textContent = String(m).padStart(2, '0') + ':' + String(secRemain).padStart(2, '0');
      }
    }, 1000);
  }

  /**
   * 开始任务
   * @param {string} label - 任务标签
   */
  function tlStartTask(label) {
    const now = Date.now();
    if (tlCurrentTask && (now - tlCurrentTask.lastMs) < TASK_DEBOUNCE) {
      tlCurrentTask.lastMs = now;
      return;
    }
    if (tlCurrentTask) tlCommitTask();

    tlCurrentTask = {
      label: label || '处理中...',
      startMs: now,
      lastMs: now,
      tools: 0,
      errors: 0,
      tokens: 0,
      tags: new Set(),
      el: null
    };

    taskProgressStart = now;
    taskProgressDone = false;
    renderTaskProgress();
    tlStartSession();

    const el = tlAddEntry(tlCurrentTask, true);
    tlCurrentTask.el = el;
  }

  /**
   * 添加时间线标签
   * @param {string} tag - 标签名
   */
  function tlAddTag(tag) {
    if (tlCurrentTask) {
      tlCurrentTask.tags.add(tag);
      tlCurrentTask.lastMs = Date.now();
    }
  }

  /**
   * 添加工具调用计数
   */
  function tlAddTool() {
    tlTools++;
    const tlToolsEl = document.getElementById('tlTools');
    if (tlToolsEl) tlToolsEl.textContent = tlTools;
    if (tlCurrentTask) {
      tlCurrentTask.tools++;
      tlCurrentTask.lastMs = Date.now();
    }
  }

  /**
   * 添加错误计数
   */
  function tlAddError() {
    tlErrors++;
    const tlErrorsEl = document.getElementById('tlErrors');
    if (tlErrorsEl) tlErrorsEl.textContent = tlErrors;
    if (tlCurrentTask) {
      tlCurrentTask.errors++;
      tlCurrentTask.lastMs = Date.now();
    }
  }

  /**
   * 添加Token计数
   * @param {number} n - Token数量
   */
  function tlAddTokens(n) {
    tlTotalTokens += n;
    tlSessionTokens += n;
    if (tlCurrentTask) tlCurrentTask.tokens += n;

    const el = document.getElementById('tokenCount');
    if (el) {
      if (tlTotalTokens >= 1000) {
        const k = tlTotalTokens / 1000;
        el.textContent = (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
      } else {
        el.textContent = tlTotalTokens;
      }
      el.classList.remove('token-flash');
      void el.offsetWidth;
      el.classList.add('token-flash');
    }

    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      tlTokenRateEl.textContent = tlTasks > 0 ? Math.round(tlTotalTokens / tlTasks) : 0;
    }
  }

  /**
   * 提交任务
   */
  function tlCommitTask() {
    if (!tlCurrentTask) return;
    const t = tlCurrentTask;
    tlCurrentTask = null;
    tlTasks++;
    taskProgressDone = true;
    renderTaskProgress();

    setTimeout(() => {
      taskProgressDone = false;
      taskProgressStart = 0;
      renderTaskProgress();
    }, 2500);

    const tlTasksEl = document.getElementById('tlTasks');
    if (tlTasksEl) tlTasksEl.textContent = tlTasks;

    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) tlTokenRateEl.textContent = Math.round(tlTotalTokens / tlTasks);

    if (t.el) {
      t.el.classList.remove('tl-active');
      tlRenderEntry(t.el, t, false);
    }
  }

  /**
   * 添加时间线条目
   * @param {Object} task - 任务对象
   * @param {boolean} active - 是否活跃
   * @returns {HTMLElement|null} 创建的元素
   */
  function tlAddEntry(task, active) {
    const empty = document.getElementById('tlEmpty');
    if (empty) empty.remove();

    const list = document.getElementById('timelineList');
    if (!list) return null;

    const el = document.createElement('div');
    el.className = 'tl-entry' + (active ? ' tl-active' : '');
    tlRenderEntry(el, task, active);
    list.insertBefore(el, list.firstChild);

    while (list.children.length > 50) list.removeChild(list.lastChild);

    return el;
  }

  /**
   * 渲染时间线条目
   * @param {HTMLElement} el - DOM元素
   * @param {Object} task - 任务对象
   * @param {boolean} active - 是否活跃
   */
  function tlRenderEntry(el, task, active) {
    const dur = active ? '●' : tlFmtDur((task.lastMs || task.startMs) - task.startMs);
    const icon = task.errors > 0 ? '⚠️' : task.tags.has('agent') ? '🤖' : task.tags.has('chat') ? '💬' : '✨';
    const time = new Date(task.startMs).toTimeString().slice(0, 8);

    el.textContent = '';

    const iconEl = document.createElement('div');
    iconEl.className = 'tl-icon';
    iconEl.textContent = icon;
    el.appendChild(iconEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'tl-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = task.label;
    bodyEl.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'tl-meta';

    // 判断是否是 Agent 类型（有工具调用或有 agent 标签）
    const isAgent = task.tools > 0 || task.tags.has('agent');

    if (isAgent) {
      // Agent 类型：显示 AGENT + CHAT 标签
      const agentTag = document.createElement('span');
      agentTag.className = 'tl-tag agent';
      agentTag.textContent = 'AGENT';
      metaEl.appendChild(agentTag);

      const chatTag = document.createElement('span');
      chatTag.className = 'tl-tag chat';
      chatTag.textContent = 'CHAT';
      metaEl.appendChild(chatTag);

      // 显示工具数量
      if (task.tools > 0) {
        const toolTag = document.createElement('span');
        toolTag.className = 'tl-tag tool';
        toolTag.textContent = task.tools + ' TOOL' + (task.tools > 1 ? 'S' : '');
        metaEl.appendChild(toolTag);
      }
    } else {
      // Chat 类型：只显示 CHAT 标签
      const chatTag = document.createElement('span');
      chatTag.className = 'tl-tag chat';
      chatTag.textContent = 'CHAT';
      metaEl.appendChild(chatTag);
    }

    if (task.errors > 0) {
      const errEl = document.createElement('span');
      errEl.className = 'tl-tag error';
      errEl.textContent = task.errors + ' ERR';
      metaEl.appendChild(errEl);
    }

    bodyEl.appendChild(metaEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'tl-time';
    timeEl.textContent = time;
    bodyEl.appendChild(timeEl);

    el.appendChild(bodyEl);

    const rightEl = document.createElement('div');
    rightEl.className = 'tl-right';

    const durEl = document.createElement('div');
    durEl.className = 'tl-dur';
    durEl.textContent = dur;
    rightEl.appendChild(durEl);

    if (task.tokens > 0) {
      const tokEl = document.createElement('span');
      tokEl.className = 'tl-tokens';
      tokEl.textContent = '+' + (task.tokens >= 1000 ? (task.tokens / 1000).toFixed(1) + 'k' : task.tokens) + ' tok';
      rightEl.appendChild(tokEl);
    }

    el.appendChild(rightEl);
  }

  /**
   * 格式化持续时间
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化的时间字符串
   */
  function tlFmtDur(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
  }

  /**
   * 渲染任务进度条
   */
  function renderTaskProgress() {
    const bar = document.getElementById('brainBar');
    if (!bar) return;

    if (taskProgressDone) {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#a0ffc8)';
      return;
    }
    if (!taskProgressStart) {
      bar.style.width = '0%';
      bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#7de8e8)';
      return;
    }

    const elapsed = Date.now() - taskProgressStart;
    const pct = Math.min(95, (elapsed / TASK_DURATION_MS) * 100);
    bar.style.width = pct + '%';
    bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#7de8e8)';
  }

  // === MESSAGE HANDLERS ===

  /**
   * 处理单个消息
   * @param {Object} msg - 消息对象
   */
  function handleMessage(msg) {
    const ev = msg.type;
    const p = msg.payload;

    // 心跳事件
    if (ev === 'tick') {
      updateStats(p.snapshot || p);
      return;
    }

    // 日志事件
    if (ev === 'log') {
      const lvl = p.level || 'info';
      addLog(lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'info', 'LOG', p.message || JSON.stringify(p).slice(0, 100));
      return;
    }

    // 健康状态
    if (ev === 'health') {
      updateStats(p);
      addLog('success', 'WS', '网关健康 ✓');
      return;
    }

    // 会话状态
    if (ev === 'session.status' || ev === 'status') {
      updateStats(p);
      return;
    }

    // 通知
    if (ev === 'notification') {
      addLog('info', 'NOTIF', p.title || p.message || '通知');
      return;
    }

    // 智能体状态
    if (ev === 'agent.status') {
      updateStats(p);
      addLog('info', 'AGENT', '状态: ' + (p.status || '?'));
      return;
    }

    // Telegram消息
    if (ev === 'telegram.message') {
      addLog('info', 'TG', '来自 ' + (p.from || '用户') + ' 的消息');
      return;
    }

    // Agent流式事件
    if (ev === 'agent' || ev === 'agent.stream' || ev === 'agent.message') {
      handleAgentEvent(ev, p);
      return;
    }

    // 聊天消息事件
    if (ev === 'chat' || ev === 'chat.message') {
      handleChatEvent(ev, p);
      return;
    }

    // 工具开始
    if (ev === 'tool.start' || ev === 'tool_start') {
      tlAddTool();
      tlAddTag('tool');
      if (!tlCurrentTask) tlStartTask('工具: ' + (p.tool || p.name || '?'));
      if (window.MoodSystem) MoodSystem.onEvent({ vibe: -2, brain: -1, chaos: +8 });
      if (window._brainFire) window._brainFire(null, 6);
      return;
    }

    // 工具结束
    if (ev === 'tool.end' || ev === 'tool.result' || ev === 'tool_end') {
      const ok = !p.error;
      addLog(ok ? 'success' : 'error', 'TOOL', ok ? '✓ 完成' : '✗ ' + (p.error || '失败'));
      if (window.MoodSystem) MoodSystem.onEvent({ vibe: ok ? +4 : -8, brain: -1, chaos: ok ? -6 : +15 });
      if (window._brainFire) window._brainFire(null, ok ? 5 : 3);
      return;
    }

    // 错误事件
    if (ev === 'error' || (p && p.error)) {
      tlAddError();
      if (window.MoodSystem) MoodSystem.onEvent({ vibe: -10, brain: -1, chaos: +18 });
      return;
    }

    // 未知事件
    addLog('info', (ev + '     ').slice(0, 5).toUpperCase(), JSON.stringify(p || {}).slice(0, 100));
  }

  /**
   * 处理Agent事件
   * @param {string} ev - 事件类型
   * @param {Object} p - 事件载荷
   */
  function handleAgentEvent(ev, p) {
    updateStats(p);
    tlAddTokens(1);
    tlAddTag('agent');

    const payload = p.payload || p;
    const stream = payload.stream;
    const data = payload.data || p.data || p;

    // 生命周期: 开始 → 显示思考指示器
    if (stream === 'lifecycle' && data && data.phase === 'start') {
      if (typeof Chat !== 'undefined') Chat.showTyping();
      if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('thinking');
      tlStartTask('Agent 处理中 · ' + new Date().toTimeString().slice(0, 5));
      if (window.MoodSystem) MoodSystem.onEvent({ brain: +0.5, chaos: -2 });
      return;
    }

    // 生命周期: 结束 → 隐藏思考指示器
    if (stream === 'lifecycle' && data.phase === 'end') {
      if (typeof Chat !== 'undefined') Chat.hideTyping();
      if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('idle');
      if (window.MoodSystem) MoodSystem.onEvent({ brain: -0.3, vibe: +3 });

      // 对话结束后更新 token 使用情况
      if (typeof SessionManager !== 'undefined') {
        setTimeout(() => SessionManager.fetchSessionStatus(), 500);
      }
      return;
    }

    // Assistant流: 增量文本
    if (stream === 'assistant') {
      const runId = payload.runId || p.runId || '';

      if (typeof Chat !== 'undefined') Chat.hideTyping();
      if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('streaming');

      // 检查是否是工具调用/结果
      const dataType = data.type;
      if (dataType === 'tool_call') {
        if (typeof Chat !== 'undefined') {
          Chat.appendToolCall({
            name: data.name,
            args: data.args,
            status: 'running'
          });
        }
        if (window.MoodSystem) MoodSystem.onEvent({ vibe: -2, brain: -1, chaos: +8 });
        return;
      }

      if (dataType === 'tool_result') {
        if (typeof Chat !== 'undefined') {
          Chat.appendToolResult({
            name: data.name,
            text: data.text,
            success: !data.is_error
          });
        }
        if (window.MoodSystem) MoodSystem.onEvent({ vibe: data.is_error ? -8 : +4, brain: -1, chaos: data.is_error ? +15 : -6 });
        return;
      }

      // 使用增量文本
      let raw = data.delta || '';
      if (!raw) {
        raw = data.text || data.content || '';
      }
      if (typeof raw !== 'string') raw = JSON.stringify(raw);

      if (raw && typeof Chat !== 'undefined') {
        Chat.appendToStream(raw);

        // 记录这个 runId 已经通过流式显示
        if (runId) {
          streamedRunIds.add(runId);
          if (streamedRunIds.size > PROCESSED_RUNID_MAX) {
            const arr = Array.from(streamedRunIds);
            arr.slice(0, arr.length - PROCESSED_RUNID_MAX).forEach(id => streamedRunIds.delete(id));
          }
        }
      }

      // 累积时间线标签
      if (tlCurrentTask) {
        tlCurrentTask._buf = (tlCurrentTask._buf || '') + raw;
        const snippet = tlCurrentTask._buf.replace(/[^\w\s.,!?'-]/g, '').trim();
        if (snippet.length > 5) {
          tlCurrentTask.label = '💬 ' + snippet.slice(0, 45) + (snippet.length > 45 ? '…' : '');
          if (tlCurrentTask.el) tlRenderEntry(tlCurrentTask.el, tlCurrentTask, true);
        }
      }

      if (window.MoodSystem) MoodSystem.onEvent({ brain: -0.3, chaos: +1 });
      return;
    }
  }

  /**
   * 处理聊天事件
   * @param {string} ev - 事件类型
   * @param {Object} p - 事件载荷
   */
  function handleChatEvent(ev, p) {
    updateStats(p);
    const sessionId = p.sessionKey || p.runId || p.key || '';
    const runId = p.runId || '';
    const state = p.state || '';

    // 更新会话信息
    if (p.sessionKey && typeof SessionManager !== 'undefined') {
      SessionManager.updateSessionFromKey(p.sessionKey);
    }

    // 更新统计
    const parts = sessionId.split(':');
    const agentName = parts[1] || parts[0] || 'agent';
    if (state === 'final') {
      tlStartTask('会话: ' + agentName + ' · ' + new Date().toTimeString().slice(0, 5));
      tlAddTag('chat');
      tlMsgs++;
      const tlMsgsEl = document.getElementById('tlMsgs');
      if (tlMsgsEl) tlMsgsEl.textContent = tlMsgs;
    }
    if (window.MoodSystem) MoodSystem.onEvent({ vibe: +5, chaos: +8 });
    if (window._brainFire) window._brainFire(null, 5);

    if (typeof Chat !== 'undefined') Chat.hideTyping();

    // 检查是否已经通过 agent 事件流式显示
    const alreadyStreamed = runId && streamedRunIds.has(runId);

    if (state === 'final') {
      if (alreadyStreamed) {
        // 已通过 agent 流式显示，只结束流
        if (typeof Chat !== 'undefined') Chat.endStream();
        // 清除标记，避免影响后续消息
        streamedRunIds.delete(runId);
      } else {
        // 没有流式显示，添加完整消息
        const msg = p.message;
        if (msg && (msg.content || msg.text) && typeof Chat !== 'undefined') {
          let content = msg.content;
          if (Array.isArray(content)) {
            content = content.map(c => c.text || '').join('');
          } else if (typeof content !== 'string') {
            content = msg.text || JSON.stringify(content);
          }

          if (content) {
            Chat.addMessage({
              role: msg.role || 'assistant',
              content: content,
              timestamp: msg.timestamp || Date.now()
            });
          }
        }
      }
    }
  }

  // === INITIALIZATION ===

  /**
   * 初始化事件路由
   */
  function init() {
    // 注册 Gateway 消息处理器
    if (typeof Gateway !== 'undefined') {
      Gateway.onMessage(handleMessage);
    }

    // 注册情绪系统空闲回调（用于提交任务）
    if (typeof MoodSystem !== 'undefined') {
      MoodSystem.onIdle(tlCommitTask);
      console.log('[EventRouter] Registered idle callback with MoodSystem');
    } else {
      console.warn('[EventRouter] MoodSystem not found, idle callback not registered');
    }

    // 启动任务进度更新
    setInterval(() => {
      if (taskProgressStart && !taskProgressDone) renderTaskProgress();
    }, 500);

    console.log('[EventRouter] Initialized');
  }

  // 暴露到全局命名空间
  window.EventRouter = {
    init,
    handleMessage,
    updateStats,
    // 暴露时间线功能供外部使用
    tlStartTask,
    tlAddTag,
    tlAddTool,
    tlAddError,
    tlAddTokens,
    tlCommitTask,
    // 暴露状态供外部访问
    getStats: () => ({ tlTasks, tlMsgs, tlTools, tlErrors, tlTotalTokens, tlSessionTokens }),
    resetStats: () => {
      tlTasks = 0; tlMsgs = 0; tlTools = 0; tlErrors = 0;
      tlTotalTokens = 0; tlSessionTokens = 0;
      tlSessionStart = null; tlCurrentTask = null;
      taskProgressStart = 0; taskProgressDone = false;
    }
  };

})();
