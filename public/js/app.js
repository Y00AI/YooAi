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

  // === INFINITE SCROLL STATE ===
  const HISTORY_LIMIT = 100;
  let historyOffset = 0;
  let isLoadingMore = false;
  let hasMoreHistory = true;
  let loadedMessageIds = new Set(); // 已加载消息的唯一标识
  let cachedMessages = []; // 缓存原始消息数据，用于重新渲染

  // === 消息过滤状态 ===
  const FILTER_STORAGE_KEY = 'yooai_message_filter';

  const MessageFilter = {
    showThinking: false,  // 是否显示思考过程
    showToolCalls: false, // 是否显示工具调用
    showToolResults: false, // 是否显示工具结果

    // 从 localStorage 加载状态
    load() {
      try {
        const saved = localStorage.getItem(FILTER_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.showThinking = !!parsed.showThinking;
          this.showToolCalls = !!parsed.showToolCalls;
          this.showToolResults = !!parsed.showToolResults;
        }
      } catch (e) {
        console.warn('[App] Failed to load filter state:', e);
      }
    },

    // 保存状态到 localStorage
    save() {
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
          showThinking: this.showThinking,
          showToolCalls: this.showToolCalls,
          showToolResults: this.showToolResults
        }));
      } catch (e) {
        console.warn('[App] Failed to save filter state:', e);
      }
    },

    // 切换过滤选项
    toggle(type) {
      if (type === 'thinking') {
        this.showThinking = !this.showThinking;
      } else if (type === 'toolCalls') {
        this.showToolCalls = !this.showToolCalls;
      } else if (type === 'toolResults') {
        this.showToolResults = !this.showToolResults;
      }
      // 保存状态到 localStorage
      this.save();
      // 更新 UI 复选框状态
      updateFilterUI();
      // 重新渲染消息
      reloadMessages();
    },

    // 设置过滤选项
    set(type, value) {
      if (type === 'thinking') {
        this.showThinking = value;
      } else if (type === 'toolCalls') {
        this.showToolCalls = value;
      } else if (type === 'toolResults') {
        this.showToolResults = value;
      }
    },

    // 检查是否应该显示某类型内容
    shouldShow(type) {
      if (type === 'thinking') return this.showThinking;
      if (type === 'toolCall') return this.showToolCalls;
      if (type === 'toolResult') return this.showToolResults;
      return true; // 默认显示
    }
  };

  /**
   * 重新加载消息（根据当前过滤设置）
   */
  function reloadMessages() {
    if (typeof Chat !== 'undefined') {
      Chat.clear();

      // 重新渲染缓存的消息
      for (const msg of cachedMessages) {
        renderMessage(msg, true);
      }

      // 滚动到底部
      const container = document.getElementById('messagesContainer');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  /**
   * 更新过滤 UI 状态
   */
  function updateFilterUI() {
    const thinkingCheckbox = document.getElementById('filterThinking');
    const toolCallsCheckbox = document.getElementById('filterToolCalls');
    const toolResultsCheckbox = document.getElementById('filterToolResults');

    if (thinkingCheckbox) thinkingCheckbox.checked = MessageFilter.showThinking;
    if (toolCallsCheckbox) toolCallsCheckbox.checked = MessageFilter.showToolCalls;
    if (toolResultsCheckbox) toolResultsCheckbox.checked = MessageFilter.showToolResults;
  }

  // === INIT ===
  function init() {
    initTitlebar();
    initFloatingBits();
    initDevTools();

    // 初始化 Core 模块
    if (typeof MoodSystem !== 'undefined') MoodSystem.init();
    if (typeof EventRouter !== 'undefined') EventRouter.init();
    if (typeof SessionManager !== 'undefined') SessionManager.init();

    // 加载保存的过滤状态
    MessageFilter.load();
    updateFilterUI();

    initChatHandlers();
    initLoadMoreButton();

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
   * 生成消息唯一标识
   */
  function getMessageId(msg) {
    if (!msg) return null;
    const timestamp = msg.timestamp || 0;
    const role = msg.role || 'unknown';
    // 使用 timestamp + role 作为唯一标识
    return `${timestamp}-${role}`;
  }

  /**
   * Load chat history from backend API (JSONL files)
   * @param {boolean} loadMore - 是否为加载更多（追加到顶部）
   */
  async function loadChatHistory(loadMore = false) {
    if (isLoadingMore) return;

    try {
      const sessionKey = typeof SessionManager !== 'undefined'
        ? SessionManager.getCurrentSessionKey()
        : 'agent:main:main';

      // 如果是首次加载，重置状态
      if (!loadMore) {
        historyOffset = 0;
        hasMoreHistory = true;
        loadedMessageIds.clear(); // 清空已加载消息记录
        cachedMessages = []; // 清空消息缓存
      }

      isLoadingMore = true;

      // 使用新的 /api/chat/:sessionKey API，支持 offset 分页
      const url = `/api/chat/${encodeURIComponent(sessionKey)}?offset=${historyOffset}&limit=${HISTORY_LIMIT}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        console.error('[App] Chat API error:', result.error);
        hasMoreHistory = false;
        return;
      }

      if (result && Array.isArray(result.messages)) {
        // 首次加载：清空现有消息
        if (!loadMore && typeof Chat !== 'undefined') {
          Chat.clear();
        }

        const allMessages = result.messages;
        const totalReturned = allMessages.length;
        const totalAvailable = result.total || 0;

        // 过滤出尚未加载的消息
        const newMessages = [];
        for (const msg of allMessages) {
          const msgId = getMessageId(msg);
          if (msgId && !loadedMessageIds.has(msgId)) {
            newMessages.push(msg);
            loadedMessageIds.add(msgId);
          }
        }

        const newCount = newMessages.length;

        // 缓存原始消息数据（用于过滤时重新渲染）
        if (!loadMore) {
          // 首次加载：按原始顺序缓存
          cachedMessages = [...allMessages];
        } else {
          // 加载更多：合并到缓存开头（保持时间顺序）
          const existingIds = new Set(cachedMessages.map(m => getMessageId(m)));
          const trulyNew = newMessages.filter(m => !existingIds.has(getMessageId(m)));
          cachedMessages = [...trulyNew, ...cachedMessages];
        }

        // 根据 API 返回的 hasMore 判断是否还有更多历史
        hasMoreHistory = result.hasMore === true;

        // 如果是加载更多，需要保持滚动位置
        const container = document.getElementById('messagesContainer');
        const oldScrollHeight = container ? container.scrollHeight : 0;

        // 反向遍历，如果是加载更多则插入到顶部
        if (loadMore && newCount > 0) {
          // 从旧到新遍历，插入到顶部
          for (let i = newMessages.length - 1; i >= 0; i--) {
            const msg = newMessages[i];
            if (msg && (msg.content || msg.text)) {
              renderMessageToTop(msg);
            }
          }
          // 恢复滚动位置
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        } else if (!loadMore) {
          // 正常加载，追加到底部
          for (const msg of newMessages) {
            if (msg && (msg.content || msg.text)) {
              renderMessage(msg);
            }
          }
        }

        // 更新偏移量（用于下次分页）
        historyOffset += newCount;

        // 首次加载后，滚动到底部并加载时间线
        if (!loadMore) {
          loadTimelineHistory();
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
      } else {
        // 没有消息
        hasMoreHistory = false;
      }
    } catch (err) {
      console.error('[App] Failed to load chat history:', err, err?.message);
      // 加载更多失败时，设置 hasMoreHistory = false 避免重复尝试
      if (loadMore) {
        hasMoreHistory = false;
      } else {
        hasMoreHistory = false;
      }
    } finally {
      isLoadingMore = false;
      updateLoadMoreButton();
    }
  }

  /**
   * 渲染单条消息（追加到底部）
   * @param {Object} msg - 消息对象
   * @param {boolean} applyFilter - 是否应用过滤（默认 true）
   */
  function renderMessage(msg, applyFilter = true) {
    if (!msg || (!msg.content && !msg.text)) return;

    const content = msg.content;
    const role = msg.role || 'user';
    const timestamp = msg.timestamp || Date.now();

    // 处理 toolResult 消息
    if (role === 'toolResult') {
      // 检查过滤设置
      if (applyFilter && !MessageFilter.shouldShow('toolResult')) {
        return;
      }
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
        }
      }
      return;
    }

    // 字符串内容 - 始终显示
    if (typeof content === 'string') {
      if (content && typeof Chat !== 'undefined') {
        Chat.addMessage({ role, content, timestamp });
      }
      return;
    }

    // 非数组内容 - 始终显示
    if (!Array.isArray(content)) {
      const text = msg.text || JSON.stringify(content);
      if (text && typeof Chat !== 'undefined') {
        Chat.addMessage({ role, content: text, timestamp });
      }
      return;
    }

    // 数组内容 - 根据过滤设置渲染
    renderArrayContent(content, role, timestamp, applyFilter);
  }

  /**
   * 渲染消息到顶部（用于加载更多）
   * @param {Object} msg - 消息对象
   * @param {boolean} applyFilter - 是否应用过滤（默认 true）
   */
  function renderMessageToTop(msg, applyFilter = true) {
    if (!msg || (!msg.content && !msg.text)) return;

    const content = msg.content;
    const role = msg.role || 'user';
    const timestamp = msg.timestamp || Date.now();

    // 处理 toolResult 消息
    if (role === 'toolResult') {
      // 检查过滤设置
      if (applyFilter && !MessageFilter.shouldShow('toolResult')) {
        return;
      }
      if (typeof ChatToolCards !== 'undefined') {
        const resultText = Array.isArray(content)
          ? content.map(c => c.text || '').join('')
          : (typeof content === 'string' ? content : JSON.stringify(content));

        const card = ChatToolCards.createToolResultCard({
          name: msg.toolName || msg.tool_name || 'Tool',
          text: resultText,
          success: !msg.isError && !msg.is_error
        });

        if (card && typeof Chat !== 'undefined' && typeof Chat.prependElement === 'function') {
          Chat.prependElement(card);
        }
      }
      return;
    }

    // 字符串内容 - 始终显示
    if (typeof content === 'string') {
      if (content && typeof Chat !== 'undefined' && typeof Chat.prependMessage === 'function') {
        Chat.prependMessage({ role, content, timestamp });
      }
      return;
    }

    // 非数组内容 - 始终显示
    if (!Array.isArray(content)) {
      const text = msg.text || JSON.stringify(content);
      if (text && typeof Chat !== 'undefined' && typeof Chat.prependMessage === 'function') {
        Chat.prependMessage({ role, content: text, timestamp });
      }
      return;
    }

    // 数组内容 - 根据过滤设置渲染
    const textParts = [];
    const specialItems = [];

    for (const item of content) {
      if (!item) continue;
      const itemType = item.type;

      if (itemType === 'text') {
        // text 始终显示
        textParts.push(item.text || '');
      } else if (itemType === 'toolCall' || itemType === 'tool_use') {
        // toolCall 根据过滤设置
        if (!applyFilter || MessageFilter.shouldShow('toolCall')) {
          specialItems.push({
            type: 'toolCall',
            name: item.name || item.tool_name || 'Tool',
            args: item.input || item.arguments || item.args
          });
        }
      } else if (itemType === 'thinking') {
        // thinking 根据过滤设置
        if (!applyFilter || MessageFilter.shouldShow('thinking')) {
          specialItems.push({
            type: 'thinking',
            content: item.thinking || item.text || ''
          });
        }
      }
    }

    // 添加文本消息
    const textContent = textParts.join('');
    if (textContent && typeof Chat !== 'undefined' && typeof Chat.prependMessage === 'function') {
      Chat.prependMessage({ role, content: textContent, timestamp });
    }

    // 添加特殊卡片
    for (const item of specialItems) {
      if (typeof ChatToolCards === 'undefined') continue;

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

      if (card && typeof Chat !== 'undefined' && typeof Chat.prependElement === 'function') {
        Chat.prependElement(card);
      }
    }
  }

  /**
   * 渲染数组内容（追加到底部）
   * @param {Array} content - 内容数组
   * @param {string} role - 角色
   * @param {number} timestamp - 时间戳
   * @param {boolean} applyFilter - 是否应用过滤（默认 true）
   */
  function renderArrayContent(content, role, timestamp, applyFilter = true) {
    const textParts = [];
    const specialItems = [];

    for (const item of content) {
      if (!item) continue;
      const itemType = item.type;

      if (itemType === 'text') {
        // text 始终显示
        textParts.push(item.text || '');
      } else if (itemType === 'toolCall' || itemType === 'tool_use') {
        // toolCall 根据过滤设置
        if (!applyFilter || MessageFilter.shouldShow('toolCall')) {
          specialItems.push({
            type: 'toolCall',
            name: item.name || item.tool_name || 'Tool',
            args: item.input || item.arguments || item.args
          });
        }
      } else if (itemType === 'thinking') {
        // thinking 根据过滤设置
        if (!applyFilter || MessageFilter.shouldShow('thinking')) {
          specialItems.push({
            type: 'thinking',
            content: item.thinking || item.text || ''
          });
        }
      }
    }

    // 添加文本消息 - 始终显示
    const textContent = textParts.join('');
    if (textContent && typeof Chat !== 'undefined') {
      Chat.addMessage({ role, content: textContent, timestamp });
    }

    // 添加特殊卡片
    for (const item of specialItems) {
      if (typeof ChatToolCards === 'undefined') continue;

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
      }
    }
  }

  /**
   * 初始化"加载更多"按钮
   */
  function initLoadMoreButton() {
    const btn = document.getElementById('loadMoreBtn');
    if (!btn) return;

    btn.addEventListener('click', function() {
      if (isLoadingMore || !hasMoreHistory) return;
      loadChatHistory(true);
    });
  }

  /**
   * 更新"加载更多"按钮状态
   */
  function updateLoadMoreButton() {
    const wrapper = document.getElementById('loadMoreWrapper');
    const btn = document.getElementById('loadMoreBtn');
    const textEl = btn ? btn.querySelector('.load-more-text') : null;
    const spinnerEl = btn ? btn.querySelector('.load-more-spinner') : null;

    if (!wrapper || !btn) {
      return;
    }

    // 始终显示按钮区域
    wrapper.style.display = 'flex';

    if (!hasMoreHistory) {
      // 没有更多消息
      btn.classList.add('no-more');
      btn.disabled = true;
      if (textEl) textEl.textContent = '没有更多历史消息';
      if (spinnerEl) spinnerEl.style.display = 'none';
    } else if (isLoadingMore) {
      // 正在加载
      btn.classList.remove('no-more');
      btn.disabled = true;
      if (textEl) textEl.textContent = '加载中...';
      if (spinnerEl) spinnerEl.style.display = 'inline';
    } else {
      // 可以加载更多
      btn.classList.remove('no-more');
      btn.disabled = false;
      if (textEl) textEl.textContent = '加载更早的消息';
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  /**
   * 加载更多历史消息（公开方法）
   */
  function loadMoreChatHistory() {
    if (hasMoreHistory && !isLoadingMore) {
      loadChatHistory(true);
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

  // 全局过滤切换函数（供 HTML onclick 调用）
  window.toggleMessageFilter = function(type) {
    MessageFilter.toggle(type);
  };

  // 暴露 YooAI 命名空间
  window.YooAI = {
    init,
    onEvent: window.onEvent,
    loadChatHistory,
    loadMoreChatHistory,
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
