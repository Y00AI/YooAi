/**
 * YooAI Chat - Chat Panel Manager
 * Handles chat UI and message rendering
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
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Add user message
    addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now()
    });

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Send to gateway
    Gateway.send({
      method: 'agent.turn',
      params: {
        messages: [{ role: 'user', content: text }]
      }
    });
  }

  /**
   * Add a complete message
   */
  function addMessage(msg) {
    messages.push(msg);
    renderMessage(msg);
    scrollToBottom();
  }

  /**
   * Append content to streaming message
   */
  function appendToStream(content) {
    if (!currentStreamingMsg) {
      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);
      renderMessage(currentStreamingMsg);
    }

    currentStreamingMsg.content += content;
    updateStreamingMessage();
    scrollToBottom();
  }

  /**
   * End streaming message
   */
  function endStream() {
    if (currentStreamingMsg) {
      currentStreamingMsg.streaming = false;
      const msgEl = document.querySelector('.message.streaming');
      if (msgEl) msgEl.classList.remove('streaming');
      currentStreamingMsg = null;
    }
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

    const avatar = msg.role === 'user' ? '👤' : '🦀';
    const sender = msg.role === 'user' ? '你' : 'YooAI';
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
    endStream,
    clear,
    getMessages,
    scrollToBottom
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
}
