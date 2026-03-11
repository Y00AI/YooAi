/**
 * YooAI App - Main Application Logic
 */

(function() {
  'use strict';

  // === STATE ===
  let autoScroll = true;
  let logs = [];
  let msgCount = 0;

  // Mood state (all 0-100)
  let moodAct = 10;
  let moodVibe = 50;
  let moodBrain = 50;
  let moodFocus = 80;
  let moodEnergy = 100;

  // Task progress
  let taskProgressStart = 0;
  let taskProgressDone = false;
  const TASK_DURATION_MS = 120000;

  // Event tracking
  let eventBurst = 0;
  let lastEventTime = 0;
  let agentBusy = false;

  // Timeline stats
  let tlTasks = 0, tlMsgs = 0, tlTools = 0, tlErrors = 0;
  let tlTotalTokens = 0, tlSessionTokens = 0;
  let tlSessionStart = null;
  let tlCurrentTask = null;
  let tlTimerInterval = null;

  // Message deduplication - track runIds that have been streamed
  const streamedRunIds = new Set(); // 已经通过 agent 流式显示的 runId
  const PROCESSED_RUNID_MAX = 100; // Keep last 100 runIds

  const TASK_DEBOUNCE = 5000;

  // Session state
  let currentSessionKey = 'agent:main:main'; // 当前活跃的 session key
  let lastStatusResult = null; // 缓存最后的 status 结果
  let statusPollInterval = null;

  // === INIT ===
  function init() {
    initTitlebar();
    initFloatingBits();
    initMoodTick();
    initGatewayHandlers();
    initChatHandlers();
    initDevTools();
    initStatusPolling();

    // Initialize background canvas (cyborg and brain auto-init)
    if (typeof initBg === 'function') initBg('bgCanvas');

    // Auto-connect after short delay
    setTimeout(() => Gateway.connect(), 700);
  }

  // === STATUS POLLING ===
  function initStatusPolling() {
    // Poll session status every 30 seconds
    statusPollInterval = setInterval(() => {
      if (Gateway.isConnected()) {
        fetchSessionStatus();
      }
    }, 30000);

    // Also poll on gateway connect
    Gateway.onMessage((msg) => {
      if (msg.type === 'gateway.connected') {
        // Wait a bit for auth to complete
        setTimeout(() => fetchSessionStatus(), 2000);
        // Load chat history (will also load timeline history)
        setTimeout(() => loadChatHistory(), 1500);
      }
    });
  }

  /**
   * Load chat history from gateway
   */
  async function loadChatHistory() {
    try {
      console.log('[App] Loading chat history for session:', currentSessionKey);
      const result = await Gateway.request('chat.history', {
        sessionKey: currentSessionKey,
        limit: 100
      });

      console.log('[App] Chat history result:', result);

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

          console.log('[App] Processing message:', { role, stopReason: msg.stopReason, contentType: Array.isArray(content) ? 'array' : typeof content });

          // 跳过 assistant 的中间过程（只显示最终结果）
          if (role === 'assistant' && msg.stopReason && msg.stopReason !== 'stop') {
            console.log('[App] Skipping intermediate assistant message');
            continue;
          }

          // 处理 toolResult 消息（role === 'toolResult'）
          if (role === 'toolResult') {
            console.log('[App] Processing toolResult message:', msg);
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
                console.log('[App] Appending toolResult card');
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

          console.log('[App] Processing message content array:', content);

          for (const item of content) {
            if (!item) continue;

            const itemType = item.type;
            console.log('[App] Content item type:', itemType, 'item:', item);

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

          console.log('[App] specialItems:', specialItems);

          // 添加文本消息（如果有）
          const textContent = textParts.join('');
          if (textContent) {
            Chat.addMessage({ role, content: textContent, timestamp });
            loadedCount++;
          }

          // 添加特殊类型卡片（toolCall、thinking）
          for (const item of specialItems) {
            if (typeof ChatToolCards === 'undefined') {
              console.warn('[App] ChatToolCards not available');
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
              console.log('[App] Appending card:', item.type);
              Chat.appendElement(card);
              loadedCount++;
            }
          }
        }

        console.log('[App] Loaded', loadedCount, 'messages from history (total', result.messages.length, ')');

        // 从后端 API 加载时间线历史
        loadTimelineHistory();
      }
    } catch (err) {
      console.log('[App] Failed to load chat history:', err.message);
    }
  }

  /**
   * Load timeline history from backend API
   * 从 /api/timeline/:sessionKey 获取完整的时间线数据
   */
  async function loadTimelineHistory() {
    try {
      console.log('[Timeline] Loading timeline from API...');

      // 调用后端 API 获取时间线数据
      const response = await fetch(`/api/timeline/${encodeURIComponent(currentSessionKey)}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('[Timeline] API response:', data.summary, data.stats);

      if (data.error) {
        console.error('[Timeline] API error:', data.error);
        return;
      }

      // 清空现有时间线
      const list = document.getElementById('timelineList');
      if (!list) return;
      list.textContent = '';

      // 重置统计变量
      tlTasks = 0;
      tlMsgs = 0;
      tlTools = 0;
      tlErrors = 0;
      tlTotalTokens = 0;
      tlCurrentTask = null;

      // 移除空状态提示
      const empty = document.getElementById('tlEmpty');
      if (empty) empty.remove();

      const timeline = data.timeline || [];
      const conversations = data.conversations || [];
      const stats = data.stats || {};

      console.log('[Timeline] Timeline items:', timeline.length, '| Conversations:', conversations.length);

      // 按对话分组时间线项目
      // 每个用户消息开始一个新的分组
      const groups = [];
      let currentGroup = null;

      for (const item of timeline) {
        // 用户消息开始新分组
        if (item.type === 'message' && item.subtype === 'user') {
          if (currentGroup && currentGroup.items.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = {
            startMs: item.timestamp,
            endMs: item.timestamp,
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
          currentGroup.endMs = item.timestamp;

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

      console.log('[Timeline] Created', groups.length, 'groups, showing', recentGroups.length);

      // 渲染每个分组
      for (const group of recentGroups) {
        // 从用户消息提取标签
        const userItem = group.items.find(i => i.type === 'message' && i.subtype === 'user');
        let label = '';

        if (userItem && userItem.text) {
          // 保留中文、英文、数字和基本标点
          const snippet = userItem.text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().slice(0, 40);
          label = snippet ? '💬 ' + snippet + (userItem.text.length > 40 ? '…' : '') : '💬 用户消息';
        } else if (group.hasAssistant) {
          label = '✨ Agent 响应';
        } else {
          label = '✨ 活动';
        }

        // 构建标签集合
        const tags = new Set();
        if (group.tools > 0) {
          tags.add('agent'); // 有工具调用，标记为 AGENT
        }
        if (group.hasUser) {
          tags.add('chat'); // 有用户消息，标记为 CHAT
        }

        // 创建任务对象
        const task = {
          label: label,
          startMs: group.startMs,
          lastMs: group.endMs,
          tools: group.tools,
          errors: group.errors,
          tokens: group.tokens.total,
          tags: tags,
          el: null
        };

        // 渲染条目
        const el = document.createElement('div');
        el.className = 'tl-entry';
        tlRenderEntry(el, task, false);
        list.insertBefore(el, list.firstChild);

        // 更新统计
        tlTasks++;
        tlMsgs += group.items.filter(i => i.type === 'message').length;
        tlTools += group.tools;
        tlErrors += group.errors;
        tlTotalTokens += group.tokens.total;
      }

      // 更新统计显示
      const tlTasksEl = document.getElementById('tlTasks');
      if (tlTasksEl) tlTasksEl.textContent = tlTasks;

      const tlMsgsEl = document.getElementById('tlMsgs');
      if (tlMsgsEl) tlMsgsEl.textContent = tlMsgs;

      const tlToolsEl = document.getElementById('tlTools');
      if (tlToolsEl) tlToolsEl.textContent = tlTools;

      const tlErrorsEl = document.getElementById('tlErrors');
      if (tlErrorsEl) tlErrorsEl.textContent = tlErrors;

      const tokenCountEl = document.getElementById('tokenCount');
      if (tokenCountEl) {
        tokenCountEl.textContent = tlTotalTokens >= 1000
          ? (tlTotalTokens / 1000).toFixed(1) + 'k'
          : tlTotalTokens;
      }

      console.log('[Timeline] Loaded', recentGroups.length, 'timeline entries | Stats:', {
        tasks: tlTasks,
        msgs: tlMsgs,
        tools: tlTools,
        errors: tlErrors,
        tokens: tlTotalTokens
      });

    } catch (err) {
      console.log('[Timeline] Failed to load timeline history:', err.message);
    }
  }

  /**
   * 从消息内容中提取文本
   */
  function extractTextFromContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item && (item.type === 'text' || typeof item === 'string'))
        .map(item => item.text || item || '')
        .join('');
    }
    return '';
  }

  async function fetchSessionStatus() {
    try {
      const result = await Gateway.request('status', {});
      console.log('[App] Status:', result);
      updateSessionUI(result);
    } catch (err) {
      console.log('[App] Failed to fetch status:', err.message);
    }
  }

  function updateSessionUI(result) {
    if (!result) return;

    // 缓存结果
    lastStatusResult = result;

    // 从 result.sessions.recent 数组获取当前会话的 token 信息
    const sessions = result.sessions?.recent || [];
    // 找到匹配当前 sessionKey 的会话，或者取第一个
    const current = sessions.find(s => s.key === currentSessionKey) || sessions[0];

    console.log('[App] Updating session UI, current session:', current?.key);

    if (current && typeof ChatStatus !== 'undefined') {
      // 字段名是 totalTokens，不是 used
      const used = current.totalTokens || 0;
      const max = current.contextTokens || 204800;
      const percent = current.percentUsed || 0;

      console.log('[App] Token info:', { used, max, percent });

      ChatStatus.updateTokens({
        used: used,
        total: max,
        percentUsed: percent
      });

      // 更新模型信息
      if (current.model) {
        ChatStatus.updateModel(current.model);
      }
    }
  }

  function updateSessionFromKey(sessionKey) {
    if (!sessionKey) return;

    currentSessionKey = sessionKey;

    // Parse sessionKey format: "agent:main:main" or "agent:main:cron:news"
    const parts = sessionKey.split(':');
    const agentId = parts[1] || 'main';
    const sessionId = parts.slice(2).join(':') || 'main';

    if (typeof ChatStatus !== 'undefined') {
      ChatStatus.updateSession(sessionId);
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

  // === TASK PROGRESS ===
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

  setInterval(() => {
    if (taskProgressStart && !taskProgressDone) renderTaskProgress();
  }, 500);

  // === MOOD RENDERING ===
  function clamp(v, mn, mx) {
    return Math.max(mn, Math.min(mx, v));
  }

  function renderMood() {
    const actBar = document.getElementById('actBar');
    const vibeBar = document.getElementById('vibeBar');
    const chaosBar = document.getElementById('chaosBar');
    const energyBar = document.getElementById('energyBar');

    if (actBar) actBar.style.width = moodAct + '%';
    if (vibeBar) vibeBar.style.width = moodVibe + '%';
    if (chaosBar) chaosBar.style.width = moodFocus + '%';
    if (energyBar) energyBar.style.width = moodEnergy + '%';

    let emoji, name, sub;
    if (!agentBusy && moodAct < 20) {
      emoji = '😴'; name = '休眠中'; sub = '等待任务中~';
    } else if (!agentBusy) {
      emoji = '😌'; name = '休息中'; sub = '任务完成~';
    } else if (moodEnergy < 5) {
      emoji = '🪫'; name = '精疲力竭'; sub = '能量耗尽...';
    } else if (moodFocus < 12) {
      emoji = '🤯'; name = '不知所措'; sub = '任务太重了...';
    } else if (moodVibe < 25) {
      emoji = '😤'; name = '艰难中'; sub = '情况有点棘手...';
    } else if (moodBrain > 80) {
      emoji = '🤔'; name = '深思中'; sub = '深度推理模式...';
    } else if (moodAct > 80) {
      emoji = '🎯'; name = '专注中'; sub = '全神贯注！';
    } else if (moodVibe > 75) {
      emoji = '✨'; name = '状态极佳'; sub = '感觉很好！';
    } else {
      emoji = '🤔'; name = '思考中...'; sub = '正在处理...';
    }

    const moodEmoji = document.getElementById('moodEmoji');
    const moodName = document.getElementById('moodName');
    const moodSub = document.getElementById('moodSub');

    if (moodEmoji) moodEmoji.textContent = emoji;
    if (moodName) moodName.textContent = name;
    if (moodSub) moodSub.textContent = sub;

    // Update cyborg mood
    if (window._setCyborgMood) {
      window._soulEnergy = moodEnergy;
      if (!agentBusy && moodEnergy < 5) window._setCyborgMood('exhausted');
      else if (!agentBusy) window._setCyborgMood('sleeping');
      else if (moodFocus < 12) window._setCyborgMood('frustrated');
      else if (moodVibe > 75) window._setCyborgMood('vibing');
      else if (moodBrain > 75) window._setCyborgMood('thinking');
      else if (moodAct > 75) window._setCyborgMood('focused');
      else if (moodVibe > 55) window._setCyborgMood('excited');
      else window._setCyborgMood('thinking');
    }
  }

  function onEvent(deltas = {}) {
    const now = Date.now();
    const wasIdle = !agentBusy;
    lastEventTime = now;
    eventBurst++;
    agentBusy = true;

    moodAct = clamp(moodAct + 18, 10, 100);

    if (wasIdle) { moodBrain = 100; moodFocus = 80; }
    if (deltas.brain != null) moodBrain = clamp(moodBrain + deltas.brain, 0, 100);
    if (deltas.vibe != null) moodVibe = clamp(moodVibe + deltas.vibe, 0, 100);
    if (deltas.chaos != null) moodFocus = clamp(moodFocus - deltas.chaos, 0, 100);

    moodEnergy = clamp(moodEnergy - 0.3, 0, 100);
    renderMood();
  }

  function initMoodTick() {
    setInterval(() => {
      if (!Gateway.isConnected()) return;

      const now = Date.now();
      const idleMs = now - lastEventTime;
      const IDLE_THRESHOLD = 8000;

      if (idleMs > IDLE_THRESHOLD && agentBusy) {
        tlCommitTask();
        agentBusy = false;
        moodAct = clamp(moodAct - 40, 10, 100);
        moodFocus = clamp(moodFocus + 20, 0, 100);
        moodBrain = clamp(moodBrain - 20, 20, 100);
        moodVibe = clamp(moodVibe - 10, 40, 100);
        renderMood();
        return;
      }

      if (agentBusy) {
        moodVibe = clamp(moodVibe + 1, 0, 100);
        moodBrain = clamp(moodBrain - 0.4, 0, 100);
        moodEnergy = clamp(moodEnergy - 0.4, 0, 100);
        moodFocus = clamp(moodFocus - 0.2, 0, 100);
        renderMood();
        return;
      }

      if (!agentBusy) {
        moodAct = clamp(moodAct - 3, 10, 100);
        moodVibe = clamp(moodVibe + (moodVibe < 50 ? 1 : -1), 40, 60);
        moodBrain = clamp(moodBrain + 1, 20, 100);
        moodFocus = clamp(moodFocus + 1, 0, 100);
        if (moodAct < 20) moodEnergy = clamp(moodEnergy + 3, 0, 100);
        renderMood();
      }
    }, 500);
  }

  // === GATEWAY HANDLERS ===
  function initGatewayHandlers() {
    Gateway.onMessage((msg) => {
      const ev = msg.type;
      const p = msg.payload;

      if (ev === 'tick') {
        updateStats(p.snapshot || p);
        return;
      }

      if (ev === 'log') {
        const lvl = p.level || 'info';
        addLog(lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'info', 'LOG', p.message || JSON.stringify(p).slice(0, 100));
        return;
      }

      if (ev === 'health') {
        updateStats(p);
        addLog('success', 'WS', '网关健康 ✓');
        return;
      }

      if (ev === 'session.status' || ev === 'status') {
        updateStats(p);
        return;
      }

      if (ev === 'notification') {
        addLog('info', 'NOTIF', p.title || p.message || '通知');
        return;
      }

      if (ev === 'agent.status') {
        updateStats(p);
        addLog('info', 'AGENT', '状态: ' + (p.status || '?'));
        return;
      }

      if (ev === 'telegram.message') {
        addLog('info', 'TG', '来自 ' + (p.from || '用户') + ' 的消息');
        return;
      }

      if (ev === 'agent' || ev === 'agent.stream' || ev === 'agent.message') {
        updateStats(p);
        tlAddTokens(1);
        tlAddTag('agent');

        // Handle Agent event with lifecycle + assistant streams
        const payload = p.payload || p;
        const stream = payload.stream;
        const data = payload.data || p.data || p;

        console.log('[App] Agent event:', { stream, phase: data.phase, hasDelta: !!data.delta });

        // Lifecycle: start → show thinking indicator
        if (stream === 'lifecycle' && data.phase === 'start') {
          Chat.showTyping();
          if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('thinking');
          tlStartTask('Agent 处理中 · ' + new Date().toTimeString().slice(0, 5));
          onEvent({ brain: +0.5, chaos: -2 });
          return;
        }

        // Lifecycle: end → hide thinking (don't end stream, let chat:final handle it)
        if (stream === 'lifecycle' && data.phase === 'end') {
          Chat.hideTyping();
          // 不在这里结束流，让 chat: final 来处理
          if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('idle');
          onEvent({ brain: -0.3, vibe: +3 });

          // 对话结束后更新 token 使用情况
          setTimeout(() => fetchSessionStatus(), 500);
          return;
        }

        // Assistant stream: delta for streaming text
        // 只有明确是 assistant stream 且有 delta 内容时才处理
        if (stream === 'assistant') {
          const runId = payload.runId || p.runId || '';

          Chat.hideTyping();
          if (typeof ChatStatus !== 'undefined') ChatStatus.updateStatus('streaming');

          // 检查是否是工具调用/结果
          const dataType = data.type;
          if (dataType === 'tool_call') {
            console.log('[App] Tool call:', data.name, data.args);
            Chat.appendToolCall({
              name: data.name,
              args: data.args,
              status: 'running'
            });
            onEvent({ vibe: -2, brain: -1, chaos: +8 });
            return;
          }

          if (dataType === 'tool_result') {
            console.log('[App] Tool result:', data.name, data.text?.substring(0, 50));
            Chat.appendToolResult({
              name: data.name,
              text: data.text,
              success: !data.is_error
            });
            onEvent({ vibe: data.is_error ? -8 : +4, brain: -1, chaos: data.is_error ? +15 : -6 });
            return;
          }

          // 使用 delta（增量）而不是 text（累积）
          let raw = data.delta || '';
          if (!raw) {
            raw = data.text || data.content || '';
          }
          if (typeof raw !== 'string') raw = JSON.stringify(raw);

          console.log('[App] Assistant stream, runId:', runId, 'delta:', raw?.substring(0, 30));

          if (raw) {
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

          // Accumulate for timeline label
          if (tlCurrentTask) {
            tlCurrentTask._buf = (tlCurrentTask._buf || '') + raw;
            const snippet = tlCurrentTask._buf.replace(/[^\w\s.,!?'-]/g, '').trim();
            if (snippet.length > 5) {
              tlCurrentTask.label = '💬 ' + snippet.slice(0, 45) + (snippet.length > 45 ? '…' : '');
              if (tlCurrentTask.el) tlRenderEntry(tlCurrentTask.el, tlCurrentTask, true);
            }
          }

          onEvent({ brain: -0.3, chaos: +1 });
          return;
        }

        return;
      }

      if (ev === 'chat' || ev === 'chat.message') {
        updateStats(p);
        const sessionId = p.sessionKey || p.runId || p.key || '';
        const runId = p.runId || '';
        const state = p.state || '';

        // Update session info from sessionKey
        if (p.sessionKey) {
          updateSessionFromKey(p.sessionKey);
        }

        console.log('[App] Chat event:', { runId, state, hasMessage: !!p.message });

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
        onEvent({ vibe: +5, chaos: +8 });
        if (window._brainFire) window._brainFire(null, 5);

        Chat.hideTyping();

        // 检查是否已经通过 agent 事件流式显示
        const alreadyStreamed = runId && streamedRunIds.has(runId);
        console.log('[App] Chat final, runId:', runId, 'alreadyStreamed:', alreadyStreamed);

        if (state === 'final') {
          if (alreadyStreamed) {
            // 已通过 agent 流式显示，只结束流
            console.log('[App] Final: ending stream, content already displayed');
            Chat.endStream();
            // 清除标记，避免影响后续消息
            streamedRunIds.delete(runId);
          } else {
            // 没有流式显示，添加完整消息
            console.log('[App] Final: adding complete message');
            const msg = p.message;
            if (msg && (msg.content || msg.text)) {
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
        // delta 状态的消息忽略（由 agent 事件处理）

        return;
      }

      if (ev === 'agent.message' || ev === 'message') {
        updateStats(p);
        msgCount++;
        const msEl = document.getElementById('sMessages');
        if (msEl) msEl.textContent = msgCount;

        // End stream and add complete message to chat
        Chat.endStream();
        if (p.content || p.message) {
          Chat.addMessage({
            role: 'assistant',
            content: p.content || p.message,
            timestamp: Date.now()
          });
        }

        addLog('agent', 'AGENT', (p.content || p.message || '').slice(0, 120));
        onEvent({ vibe: +3, brain: -0.5, chaos: +2 });
        return;
      }

      if (ev === 'tool.start' || ev === 'tool_start') {
        tlAddTool();
        tlAddTag('tool');
        if (!tlCurrentTask) tlStartTask('工具: ' + (p.tool || p.name || '?'));
        onEvent({ vibe: -2, brain: -1, chaos: +8 });
        if (window._brainFire) window._brainFire(null, 6);
        return;
      }

      if (ev === 'tool.end' || ev === 'tool.result' || ev === 'tool_end') {
        const ok = !p.error;
        addLog(ok ? 'success' : 'error', 'TOOL', ok ? '✓ 完成' : '✗ ' + (p.error || '失败'));
        onEvent({ vibe: ok ? +4 : -8, brain: -1, chaos: ok ? -6 : +15 });
        if (window._brainFire) window._brainFire(null, ok ? 5 : 3);
        return;
      }

      if (ev === 'error' || (p && p.error)) {
        tlAddError();
        onEvent({ vibe: -10, brain: -1, chaos: +18 });
        return;
      }

      // Unknown event
      addLog('info', (ev + '     ').slice(0, 5).toUpperCase(), JSON.stringify(p || {}).slice(0, 100));
    });
  }

  // === CHAT HANDLERS ===
  function initChatHandlers() {
    // Chat will be initialized when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Chat.init());
    } else {
      Chat.init();
    }
  }

  // === STATS UPDATE ===
  function updateStats(d) {
    const s = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null && v !== '' && v !== '—') el.textContent = v;
    };

    if (d.sessions && d.sessions.length > 0) {
      const active = d.sessions.find(s => s.active) || d.sessions[d.sessions.length - 1];
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

  // === LOGGING ===
  function addLog(type, tag, msg) {
    console.log(`[${tag}] ${msg}`);
  }

  // === TIMELINE ===
  function tlStartSession() {
    if (tlSessionStart) return;
    tlSessionStart = Date.now();
    tlTimerInterval = setInterval(() => {
      if (!tlSessionStart) return;
      const s = Math.floor((Date.now() - tlSessionStart) / 1000);
      const m = Math.floor(s / 60), sec = s % 60;
      const timerEl = document.getElementById('sessionTimer');
      if (timerEl) {
        timerEl.textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      }
    }, 1000);
  }

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

  function tlAddTag(tag) {
    if (tlCurrentTask) {
      tlCurrentTask.tags.add(tag);
      tlCurrentTask.lastMs = Date.now();
    }
  }

  function tlAddTool() {
    if (tlCurrentTask) {
      tlCurrentTask.tools++;
      tlCurrentTask.lastMs = Date.now();
      tlTools++;
      const tlToolsEl = document.getElementById('tlTools');
      if (tlToolsEl) tlToolsEl.textContent = tlTools;
    }
  }

  function tlAddError() {
    if (tlCurrentTask) {
      tlCurrentTask.errors++;
      tlCurrentTask.lastMs = Date.now();
      tlErrors++;
      const tlErrorsEl = document.getElementById('tlErrors');
      if (tlErrorsEl) tlErrorsEl.textContent = tlErrors;
    }
  }

  function tlAddTokens(n) {
    tlTotalTokens += n;
    tlSessionTokens += n;
    if (tlCurrentTask) tlCurrentTask.tokens += n;

    const el = document.getElementById('tokenCount');
    if (el) {
      el.textContent = tlTotalTokens >= 1000 ? (tlTotalTokens / 1000).toFixed(1) + 'k' : tlTotalTokens;
      el.classList.remove('token-flash');
      void el.offsetWidth;
      el.classList.add('token-flash');
    }

    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      tlTokenRateEl.textContent = tlTasks > 0 ? Math.round(tlTotalTokens / tlTasks) : tlTotalTokens;
    }
  }

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

  function tlRenderEntry(el, task, active) {
    // 活跃任务显示圆点，历史任务显示实际持续时间
    const dur = active ? '●' : tlFmtDur((task.lastMs || task.startMs) - task.startMs);
    // 图标选择：错误 > 有工具调用(Agent) > 聊天 > 默认
    const icon = task.errors > 0 ? '⚠️' : task.tags.has('agent') ? '🤖' : task.tags.has('chat') ? '💬' : '✨';
    const time = new Date(task.startMs).toTimeString().slice(0, 8);

    // Clear and rebuild using DOM methods
    el.textContent = '';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'tl-icon';
    iconEl.textContent = icon;
    el.appendChild(iconEl);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'tl-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = task.label;
    bodyEl.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'tl-meta';

    // Add tags
    for (const tag of task.tags) {
      const tagEl = document.createElement('span');
      tagEl.className = 'tl-tag ' + tag;
      tagEl.textContent = tag.toUpperCase();
      metaEl.appendChild(tagEl);
    }

    // Add tool count
    if (task.tools > 0) {
      const toolEl = document.createElement('span');
      toolEl.className = 'tl-tag tool';
      toolEl.textContent = task.tools + ' tool' + (task.tools > 1 ? 's' : '');
      metaEl.appendChild(toolEl);
    }

    // Add error count
    if (task.errors > 0) {
      const errEl = document.createElement('span');
      errEl.className = 'tl-tag error';
      errEl.textContent = task.errors + ' err';
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

    if (task.tokens > 0) {
      const tokEl = document.createElement('span');
      tokEl.className = 'tl-tokens';
      tokEl.textContent = '+' + (task.tokens >= 1000 ? (task.tokens / 1000).toFixed(1) + 'k' : task.tokens) + ' tok';
      rightEl.appendChild(tokEl);
    }

    el.appendChild(rightEl);
  }

  function tlFmtDur(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
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
        Gateway.connect();
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
      Gateway.connect();
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

    tlTasks = 0;
    tlMsgs = 0;
    tlTools = 0;
    tlErrors = 0;
    tlTotalTokens = 0;
    tlSessionTokens = 0;
    tlSessionStart = null;
    tlCurrentTask = null;
    taskProgressStart = 0;
    taskProgressDone = false;
    renderTaskProgress();

    if (tlTimerInterval) clearInterval(tlTimerInterval);

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

  // === INIT ON DOM READY ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
