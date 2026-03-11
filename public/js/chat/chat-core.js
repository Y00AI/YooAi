/**
 * @file chat-core.js
 * @description 聊天核心逻辑 - 初始化、消息发送、事件监听和模块协调
 * @module YooAI/Chat/Core
 * @version 2.0.0
 * @author 赵工
 *
 * @dependencies
 * - Gateway (gateway.js) - WebSocket通信
 * - ChatRenderer (chat/chat-renderer.js) - 消息渲染
 * - ChatStream (chat/chat-stream.js) - 流式消息处理
 * - ChatNormalizer (chat-normalizer.js) - 消息格式化
 * - ChatMessageUtils (chat-message-utils.js) - UI工具
 * - marked (外部库) - Markdown解析
 * - DOMPurify (外部库) - HTML消毒
 *
 * @exports
 * - Chat.init() - 初始化聊天面板
 * - Chat.sendMessage() - 发送消息
 * - Chat.addMessage(msg) - 添加完整消息
 * - Chat.clear() - 清空消息
 * - Chat.getMessages() - 获取所有消息
 * - Chat.appendToStream(content) - 追加流式内容 (代理到ChatStream)
 * - Chat.endStream() - 结束流式消息 (代理到ChatStream)
 * - Chat.appendToolCall(options) - 添加工具调用卡片 (代理到ChatStream)
 * - Chat.appendToolResult(options) - 添加工具结果卡片 (代理到ChatStream)
 * - Chat.appendElement(el) - 追加DOM元素 (代理到ChatStream)
 * - Chat.showTyping() - 显示输入指示器 (代理到ChatStream)
 * - Chat.hideTyping() - 隐藏输入指示器 (代理到ChatStream)
 * - Chat.scrollToBottom() - 滚动到底部 (代理到ChatRenderer)
 * - Chat.renderContent(content) - 渲染Markdown (代理到ChatRenderer)
 *
 * @example
 * // 初始化
 * await Chat.init();
 *
 * // 发送消息
 * Chat.sendMessage();
 *
 * // 添加消息
 * Chat.addMessage({
 *   role: 'user',
 *   content: 'Hello',
 *   timestamp: Date.now()
 * });
 *
 * @architecture
 * 模块架构:
 * ChatCore (协调器)
 *   ├── ChatRenderer (渲染器)
 *   └── ChatStream (流处理器)
 *
 * 消息流程:
 * 1. 用户输入 -> sendMessage() -> Gateway.send()
 * 2. Gateway事件 -> app.js分发 -> ChatStream.appendToStream()
 * 3. 完整消息 -> addMessage() -> ChatRenderer.renderMessage()
 */

const Chat = (function() {
  // 消息存储
  let messages = [];

  /**
   * 初始化聊天面板
   */
  async function init() {
    // 初始化渲染器
    if (typeof ChatRenderer !== 'undefined') {
      ChatRenderer.init({
        marked: typeof marked !== 'undefined' ? marked : null,
        DOMPurify: typeof DOMPurify !== 'undefined' ? DOMPurify : null
      });
    }

    // 初始化流处理器
    if (typeof ChatStream !== 'undefined') {
      ChatStream.init({
        messages: messages,
        renderer: typeof ChatRenderer !== 'undefined' ? ChatRenderer : null
      });
    }

    setupEventListeners();
    renderEmptyState();
    setupConnectionListener();
  }

  /**
   * 设置连接状态监听器
   */
  function setupConnectionListener() {
    // 监听网关连接事件
    if (typeof Gateway !== 'undefined' && Gateway.onMessage) {
      Gateway.onMessage((msg) => {
        if (msg.type === 'gateway.connected') {
          updateConnectionStatus(true);
        } else if (msg.type === 'gateway.disconnected' || msg.type === 'gateway.error') {
          updateConnectionStatus(false);
        }
      });
    }

    // 延迟检查初始连接状态
    setTimeout(() => {
      const connected = typeof Gateway !== 'undefined' && Gateway.isConnected && Gateway.isConnected();
      updateConnectionStatus(connected);
    }, 500);
  }

  /**
   * 更新连接状态UI
   * @param {boolean} isConnected - 是否已连接
   */
  function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById('chatStatus');
    if (statusEl) {
      statusEl.textContent = isConnected ? '已连接' : '未连接';
      statusEl.style.color = isConnected ? '#a0ffc8' : '#f9a98e';
    }
  }

  /**
   * 设置事件监听器
   */
  function setupEventListeners() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    if (input) {
      // 自动调整文本框高度
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      // Cmd/Ctrl + Enter 发送
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
  }

  /**
   * 发送消息
   */
  function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) {
      console.error('[Chat] Input element not found');
      return;
    }

    const text = input.value.trim();
    if (!text) {
      return;
    }

    // 开始新对话前结束之前的流式消息
    endStream();

    // 添加用户消息到UI
    addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now()
    });

    // 清空输入
    input.value = '';
    input.style.height = 'auto';

    // 检查网关连接
    if (typeof Gateway === 'undefined' || !Gateway.isConnected()) {
      console.error('[Chat] Gateway not connected!');
      addMessage({
        role: 'assistant',
        content: '未连接到网关，请先在设置中配置并连接。',
        timestamp: Date.now()
      });
      return;
    }

    // 发送到网关 - 使用OpenClaw WebChat协议
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const payload = {
      type: 'req',
      id: 'chat-' + timestamp + '-' + random,
      method: 'chat.send',
      params: {
        sessionKey: 'main',
        message: text,
        idempotencyKey: 'idem-' + timestamp + '-' + random
      }
    };

    Gateway.send(payload);
  }

  /**
   * 添加完整消息
   * 包含日期分割线逻辑
   * @param {Object} msg - 消息对象
   */
  function addMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // 移除空状态
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    // 检查是否需要日期分割线
    if (typeof ChatMessageUtils !== 'undefined') {
      if (ChatMessageUtils.getDateDividerIfNeeded(messages, msg)) {
        const divider = ChatMessageUtils.createDateDivider(msg.timestamp);
        container.appendChild(divider);
      }
    }

    // 添加到消息数组
    messages.push(msg);

    // 使用ChatNormalizer渲染消息
    if (typeof ChatNormalizer !== 'undefined') {
      const chatItem = ChatNormalizer.normalizeMessage(msg, messages.length - 1);
      const msgEl = ChatNormalizer.renderItem(chatItem, {
        markdownRenderer: typeof marked !== 'undefined' ? marked.parse.bind(marked) : null,
        sanitizeHtml: typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize.bind(DOMPurify) : null
      });

      if (msgEl) {
        container.appendChild(msgEl);
        if (typeof ChatRenderer !== 'undefined') {
          ChatRenderer.setupCodeBlockCopy(msgEl);
        }
      }
    } else if (typeof ChatRenderer !== 'undefined') {
      // 降级: 直接使用ChatRenderer
      ChatRenderer.renderMessage(msg);
    }

    // 滚动到底部
    if (typeof ChatRenderer !== 'undefined') {
      ChatRenderer.scrollToBottom();
    }
  }

  /**
   * 渲染空状态
   */
  function renderEmptyState() {
    if (typeof ChatRenderer !== 'undefined') {
      ChatRenderer.renderEmptyState();
    }
  }

  /**
   * 清空所有消息
   */
  function clear() {
    messages = [];

    // 清空流处理器
    if (typeof ChatStream !== 'undefined') {
      ChatStream.clear();
    }

    // 清空容器
    const container = document.getElementById('messagesContainer');
    if (container) {
      // 使用textContent安全清空
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }

    renderEmptyState();
  }

  /**
   * 获取所有消息
   * @returns {Array} 消息数组副本
   */
  function getMessages() {
    return [...messages];
  }

  // ========== 流处理器代理方法 ==========

  /**
   * 追加流式内容 (代理到ChatStream)
   * @param {string} content - 内容
   */
  function appendToStream(content) {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.appendToStream(content);
    }
  }

  /**
   * 结束流式消息 (代理到ChatStream)
   */
  function endStream() {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.endStream();
    }
  }

  /**
   * 添加工具调用卡片 (代理到ChatStream)
   * @param {Object} options - 工具调用选项
   */
  function appendToolCall(options) {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.appendToolCall(options);
    }
  }

  /**
   * 添加工具结果卡片 (代理到ChatStream)
   * @param {Object} options - 工具结果选项
   */
  function appendToolResult(options) {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.appendToolResult(options);
    }
  }

  /**
   * 追加DOM元素 (代理到ChatStream)
   * @param {HTMLElement} el - 元素
   */
  function appendElement(el) {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.appendElement(el);
    }
  }

  /**
   * 显示输入指示器 (代理到ChatStream)
   */
  function showTyping() {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.showTyping();
    }
  }

  /**
   * 隐藏输入指示器 (代理到ChatStream)
   */
  function hideTyping() {
    if (typeof ChatStream !== 'undefined') {
      ChatStream.hideTyping();
    }
  }

  // ========== 渲染器代理方法 ==========

  /**
   * 滚动到底部 (代理到ChatRenderer)
   */
  function scrollToBottom() {
    if (typeof ChatRenderer !== 'undefined') {
      ChatRenderer.scrollToBottom();
    }
  }

  /**
   * 渲染Markdown内容 (代理到ChatRenderer)
   * @param {string} content - 内容
   * @returns {string} 渲染后的HTML
   */
  function renderContent(content) {
    if (typeof ChatRenderer !== 'undefined') {
      return ChatRenderer.renderContent(content);
    }
    return content;
  }

  // 公开API - 保持与原Chat模块完全兼容
  return {
    init,
    sendMessage,
    addMessage,
    clear,
    getMessages,
    appendToStream,
    endStream,
    appendToolCall,
    appendToolResult,
    appendElement,
    showTyping,
    hideTyping,
    scrollToBottom,
    renderContent
  };
})();

// ES模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
}
