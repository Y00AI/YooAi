/**
 * @file chat.js
 * @description YooAI 聊天面板管理器 - 处理聊天消息的发送、接收、流式输出和渲染
 * @module YooAI/Chat
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - Gateway (gateway.js) - 消息发送
 * - ChatNormalizer (chat-normalizer.js) - 消息格式化
 * - ChatMessageUtils (chat-message-utils.js) - UI工具
 * - ChatToolCards (chat-tool-cards.js) - 工具卡片
 * - marked (外部库) - Markdown 解析
 * - DOMPurify (外部库) - HTML 消毒
 *
 * @exports
 * - Chat.init() - 初始化聊天面板
 * - Chat.addMessage(msg) - 添加完整消息
 * - Chat.appendToStream(content) - 追加流式内容
 * - Chat.endStream() - 结束流式消息
 * - Chat.appendToolCall(options) - 添加工具调用卡片
 * - Chat.appendToolResult(options) - 添加工具结果卡片
 * - Chat.appendElement(el) - 追加 DOM 元素
 * - Chat.showTyping() - 显示输入指示器
 * - Chat.hideTyping() - 隐藏输入指示器
 * - Chat.clear() - 清空消息
 *
 * @example
 * // 添加用户消息
 * Chat.addMessage({ role: 'user', content: 'Hello', timestamp: Date.now() });
 *
 * // 流式追加助手回复
 * Chat.appendToStream('Hello, ');
 * Chat.appendToStream('how can I help?');
 * Chat.endStream();
 *
 * // 添加工具调用
 * Chat.appendToolCall({ name: 'read', args: { file_path: '/path/to/file' } });
 *
 * @architecture
 * 消息流程:
 * 1. 用户输入 → sendMessage() → Gateway.send()
 * 2. Gateway 事件 → app.js 分发 → Chat.appendToStream() / addMessage()
 * 3. 流式消息 → currentStreamingMsg 缓存 → DOM 更新
 */

const Chat = (function() {
  let messages = [];
  let currentStreamingMsg = null;
  let markedLib = null;
  let domPurifyLib = null;

  /**
   * Initialize chat panel
   */
  async function init() {
    // Wait for marked.js to load
    if (typeof marked !== 'undefined') {
      markedLib = marked;
      markedLib.setOptions({
        breaks: true,
        gfm: true
      });
    }

    // Wait for DOMPurify to load
    if (typeof DOMPurify !== 'undefined') {
      domPurifyLib = DOMPurify;
    }

    setupEventListeners();
    renderEmptyState();
    setupConnectionListener();
  }

  /**
   * Setup connection status listener
   */
  function setupConnectionListener() {
    // Listen for gateway connection events
    if (typeof Gateway !== 'undefined' && Gateway.onMessage) {
      Gateway.onMessage((msg) => {
        if (msg.type === 'gateway.connected') {
          updateConnectionStatus(true);
        } else if (msg.type === 'gateway.disconnected' || msg.type === 'gateway.error') {
          updateConnectionStatus(false);
        }
      });
    }

    // Check initial connection status after a short delay
    setTimeout(() => {
      const connected = typeof Gateway !== 'undefined' && Gateway.isConnected && Gateway.isConnected();
      updateConnectionStatus(connected);
    }, 500);
  }

  /**
   * Update connection status UI
   */
  function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById('chatStatus');
    if (statusEl) {
      statusEl.textContent = isConnected ? '已连接' : '未连接';
      statusEl.style.color = isConnected ? '#a0ffc8' : '#f9a98e';
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    if (input) {
      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      // Cmd/Ctrl + Enter to send
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
   * Send message
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

    // End any previous streaming message before starting new conversation
    endStream();

    // Add user message to UI
    addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now()
    });

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Check if Gateway is connected
    if (!Gateway.isConnected()) {
      console.error('[Chat] Gateway not connected!');
      addMessage({
        role: 'assistant',
        content: '未连接到网关，请先在设置中配置并连接。',
        timestamp: Date.now()
      });
      return;
    }

    // Send to gateway - using OpenClaw WebChat protocol
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
   * Add a complete message
   * Now includes date divider logic using ChatMessageUtils
   */
  function addMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Remove empty state if present
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    // Check if date divider is needed
    if (ChatMessageUtils.getDateDividerIfNeeded(messages, msg)) {
      const divider = ChatMessageUtils.createDateDivider(msg.timestamp);
      container.appendChild(divider);
    }

    // Add to messages array
    messages.push(msg);

    // Render message using ChatNormalizer
    const chatItem = ChatNormalizer.normalizeMessage(msg, messages.length - 1);
    const msgEl = ChatNormalizer.renderItem(chatItem, {
      markdownRenderer: markedLib ? markedLib.parse.bind(markedLib) : null,
      sanitizeHtml: domPurifyLib ? domPurifyLib.sanitize.bind(domPurifyLib) : null
    });

    if (msgEl) {
      container.appendChild(msgEl);
      setupCodeBlockCopy(msgEl);
    }

    scrollToBottom();
  }

  /**
   * Append content to streaming message
   * Now uses ChatMessageUtils.showTypingIndicator()
   */
  function appendToStream(content) {
    try {
      // Hide typing indicator when content starts arriving
      if (typeof ChatMessageUtils !== 'undefined') {
        ChatMessageUtils.hideTypingIndicator();
      }
    } catch (e) {
      console.error('[Chat] Error hiding typing indicator:', e);
    }

    // If no current streaming message, or previous one ended, create new
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      // End any previous stream properly
      if (currentStreamingMsg) {
        currentStreamingMsg.streaming = false;
        const prevEl = document.querySelector('.message.streaming');
        if (prevEl) prevEl.classList.remove('streaming');
      }

      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);

      // Check if date divider is needed
      const container = document.getElementById('messagesContainer');
      if (container && ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
        const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
        container.appendChild(divider);
      }

      renderMessage(currentStreamingMsg);
    }

    currentStreamingMsg.content += content;
    updateStreamingMessage();
    scrollToBottom();
  }

  /**
   * End streaming message
   * Now uses ChatMessageUtils.hideTypingIndicator()
   */
  function endStream() {
    // Hide typing indicator
    ChatMessageUtils.hideTypingIndicator();

    if (currentStreamingMsg) {
      currentStreamingMsg.streaming = false;
      const msgEl = document.querySelector('.message.streaming');
      if (msgEl) msgEl.classList.remove('streaming');
      currentStreamingMsg = null;
    }
  }

  /**
   * Append tool call card to streaming message
   * @param {Object} options - Tool call options
   * @param {string} options.name - Tool name
   * @param {Object} options.args - Tool arguments
   * @param {string} options.status - Status (pending/running)
   */
  function appendToolCall({ name, args, status = 'running' }) {
    // Ensure we have a streaming message container
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      // Create a new streaming message for tool calls
      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);

      const container = document.getElementById('messagesContainer');
      if (container && ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
        const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
        container.appendChild(divider);
      }

      renderMessage(currentStreamingMsg);
    }

    // Create tool call card
    if (typeof ChatToolCards !== 'undefined') {
      const card = ChatToolCards.createToolCallCard({ name, args, status });
      appendElementToStream(card);
    }

    scrollToBottom();
  }

  /**
   * Append tool result card to streaming message
   * @param {Object} options - Tool result options
   * @param {string} options.name - Tool name
   * @param {string} options.text - Result text
   * @param {boolean} options.success - Whether tool succeeded
   */
  function appendToolResult({ name, text, success = true }) {
    // Ensure we have a streaming message container
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);

      const container = document.getElementById('messagesContainer');
      if (container && ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
        const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
        container.appendChild(divider);
      }

      renderMessage(currentStreamingMsg);
    }

    // Create tool result card
    if (typeof ChatToolCards !== 'undefined') {
      const card = ChatToolCards.createToolResultCard({ name, text, success });
      appendElementToStream(card);
    }

    scrollToBottom();
  }

  /**
   * Append a DOM element to the current streaming message content
   * @param {HTMLElement} element - Element to append
   */
  function appendElementToStream(element) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Find current streaming message content area
    let contentEl = container.querySelector('.message.streaming .message-content');
    if (!contentEl) {
      // Fallback: find last assistant message
      const lastMsg = container.querySelector('.message.assistant:last-child .message-content');
      contentEl = lastMsg;
    }

    if (contentEl) {
      contentEl.appendChild(element);
    }
  }

  /**
   * Append a DOM element directly to the messages container
   * Used for adding tool cards from chat history
   * @param {HTMLElement} element - Element to append
   */
  function appendElement(element) {
    const container = document.getElementById('messagesContainer');
    if (!container) {
      return;
    }

    // Remove empty state if present
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    container.appendChild(element);
    scrollToBottom();
  }

  /**
   * Show typing indicator (public API)
   */
  function showTyping() {
    ChatMessageUtils.showTypingIndicator();
  }

  /**
   * Hide typing indicator (public API)
   */
  function hideTyping() {
    ChatMessageUtils.hideTypingIndicator();
  }

  /**
   * Render a single message
   */
  function renderMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Remove empty state if present
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const msgEl = document.createElement('div');
    msgEl.className = `message ${msg.role}${msg.streaming ? ' streaming' : ''}`;
    msgEl.dataset.timestamp = msg.timestamp;

    const avatar = msg.role === 'user' ? '*' : '>';
    const sender = msg.role === 'user' ? 'YOU' : 'YOOAI';
    const time = formatTime(msg.timestamp);

    // Create message structure using DOM methods
    const headerEl = document.createElement('div');
    headerEl.className = 'message-header';

    const avatarEl = document.createElement('span');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = avatar;

    const senderEl = document.createElement('span');
    senderEl.className = 'message-sender';
    senderEl.textContent = sender;

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = time;

    headerEl.appendChild(avatarEl);
    headerEl.appendChild(senderEl);
    headerEl.appendChild(timeEl);

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    setSafeHTML(contentEl, renderContent(msg.content));

    bubbleEl.appendChild(contentEl);
    msgEl.appendChild(headerEl);
    msgEl.appendChild(bubbleEl);

    container.appendChild(msgEl);

    // Setup code block copy buttons
    setupCodeBlockCopy(msgEl);
  }

  /**
   * Update streaming message content
   */
  function updateStreamingMessage() {
    const msgEl = document.querySelector('.message.streaming');
    if (!msgEl || !currentStreamingMsg) return;

    const contentEl = msgEl.querySelector('.message-content');
    if (contentEl) {
      setSafeHTML(contentEl, renderContent(currentStreamingMsg.content));
    }
  }

  /**
   * Safely set HTML content using DOMPurify if available
   */
  function setSafeHTML(element, html) {
    if (domPurifyLib) {
      element.innerHTML = domPurifyLib.sanitize(html);
    } else {
      // Fallback: basic sanitization
      const sanitized = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
      element.innerHTML = sanitized;
    }
  }

  /**
   * Render content (Markdown)
   * Exposed for other modules to use
   */
  function renderContent(content) {
    if (!content) return '';

    if (markedLib) {
      return markedLib.parse(content);
    }

    // Fallback: escape HTML and preserve line breaks
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  /**
   * Setup code block copy buttons
   */
  function setupCodeBlockCopy(container) {
    const codeBlocks = container.querySelectorAll('pre code');

    codeBlocks.forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (pre.querySelector('.code-block-copy')) return;

      // Wrap pre in container
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Add copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-block-copy';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', () => {
        copyToClipboard(codeBlock.textContent, copyBtn);
      });
      wrapper.appendChild(copyBtn);
    });
  }

  /**
   * Copy text to clipboard
   */
  async function copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '已复制';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = '复制';
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  /**
   * Render empty state
   */
  function renderEmptyState() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Don't create if already exists
    if (container.querySelector('.chat-empty')) return;

    const emptyEl = document.createElement('div');
    emptyEl.className = 'chat-empty';

    const iconEl = document.createElement('div');
    iconEl.className = 'chat-empty-icon';
    iconEl.textContent = '💬';

    const titleEl = document.createElement('div');
    titleEl.className = 'chat-empty-title';
    titleEl.textContent = '开始对话';

    const subEl = document.createElement('div');
    subEl.className = 'chat-empty-sub';
    subEl.textContent = '在下方输入消息开始与 YooAI 对话。支持 Markdown 格式和代码高亮。';

    emptyEl.appendChild(iconEl);
    emptyEl.appendChild(titleEl);
    emptyEl.appendChild(subEl);
    container.appendChild(emptyEl);
  }

  /**
   * Scroll to bottom
   */
  function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Format timestamp
   */
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Clear all messages
   */
  function clear() {
    messages = [];
    currentStreamingMsg = null;
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.innerHTML = '';
    }
    renderEmptyState();
  }

  /**
   * Get all messages
   */
  function getMessages() {
    return [...messages];
  }

  // Public API
  return {
    init,
    addMessage,
    appendToStream,
    appendToolCall,
    appendToolResult,
    appendElement,
    endStream,
    showTyping,
    hideTyping,
    clear,
    getMessages,
    scrollToBottom,
    renderContent
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
}
