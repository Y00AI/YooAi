/**
 * @file chat-renderer.js
 * @description 聊天消息渲染器 - 处理消息的DOM渲染、Markdown解析和安全HTML设置
 * @module YooAI/Chat/Renderer
 * @version 2.0.0
 * @author 赵工
 *
 * @dependencies
 * - marked (外部库) - Markdown 解析
 * - DOMPurify (外部库) - HTML 消毒
 *
 * @exports
 * - ChatRenderer.init(libs) - 初始化渲染器
 * - ChatRenderer.renderMessage(msg) - 渲染单条消息
 * - ChatRenderer.updateStreamingMessage(content) - 更新流式消息
 * - ChatRenderer.renderContent(content) - Markdown 渲染
 * - ChatRenderer.setSafeHTML(element, html) - 安全设置 HTML
 * - ChatRenderer.setupCodeBlockCopy(container) - 代码块复制
 * - ChatRenderer.scrollToBottom() - 滚动到底部
 * - ChatRenderer.renderEmptyState() - 空状态
 * - ChatRenderer.formatTime(ts) - 格式化时间戳
 *
 * @example
 * // 初始化渲染器
 * ChatRenderer.init({ marked, DOMPurify });
 *
 * // 渲染消息
 * ChatRenderer.renderMessage({
 *   role: 'user',
 *   content: 'Hello **world**',
 *   timestamp: Date.now()
 * });
 *
 * @architecture
 * 渲染流程:
 * 1. renderMessage() 创建消息DOM结构
 * 2. renderContent() 将Markdown转为HTML
 * 3. setSafeHTML() 使用DOMPurify消毒后插入
 * 4. setupCodeBlockCopy() 添加代码复制按钮
 */

const ChatRenderer = (function() {
  // 库引用
  let markedLib = null;
  let domPurifyLib = null;

  /**
   * 初始化渲染器
   * @param {Object} libs - 库引用对象
   * @param {Function} libs.marked - marked.js 库
   * @param {Function} libs.DOMPurify - DOMPurify 库
   */
  function init(libs = {}) {
    if (libs.marked) {
      markedLib = libs.marked;
      markedLib.setOptions({
        breaks: true,
        gfm: true
      });
    }

    if (libs.DOMPurify) {
      domPurifyLib = libs.DOMPurify;
    }
  }

  /**
   * 渲染单条消息
   * @param {Object} msg - 消息对象
   * @param {string} msg.role - 角色 (user/assistant)
   * @param {string} msg.content - 消息内容
   * @param {number} msg.timestamp - 时间戳
   * @param {boolean} msg.streaming - 是否流式消息
   * @returns {HTMLElement} 消息DOM元素
   */
  function renderMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (!container) return null;

    // 移除空状态
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const msgEl = document.createElement('div');
    msgEl.className = `message ${msg.role}${msg.streaming ? ' streaming' : ''}`;
    msgEl.dataset.timestamp = msg.timestamp;

    const avatar = msg.role === 'user' ? '*' : '>';
    const sender = msg.role === 'user' ? 'YOU' : 'YOOAI';
    const time = formatTime(msg.timestamp);

    // 创建消息头部
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

    // 创建消息气泡
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    setSafeHTML(contentEl, renderContent(msg.content));

    bubbleEl.appendChild(contentEl);
    msgEl.appendChild(headerEl);
    msgEl.appendChild(bubbleEl);

    container.appendChild(msgEl);

    // 设置代码块复制
    setupCodeBlockCopy(msgEl);

    return msgEl;
  }

  /**
   * 更新流式消息内容
   * @param {string} content - 当前累计内容
   */
  function updateStreamingMessage(content) {
    const msgEl = document.querySelector('.message.streaming');
    if (!msgEl) return;

    const contentEl = msgEl.querySelector('.message-content');
    if (contentEl) {
      setSafeHTML(contentEl, renderContent(content));
    }
  }

  /**
   * 渲染内容 (Markdown -> HTML)
   * @param {string} content - 原始内容
   * @returns {string} 渲染后的HTML
   */
  function renderContent(content) {
    if (!content) return '';

    if (markedLib) {
      return markedLib.parse(content);
    }

    // 降级处理: 转义HTML并保留换行
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  /**
   * 安全设置HTML内容 (使用DOMPurify消毒)
   * @param {HTMLElement} element - 目标元素
   * @param {string} html - HTML字符串
   */
  function setSafeHTML(element, html) {
    if (domPurifyLib) {
      // 使用DOMPurify进行安全消毒
      element.innerHTML = domPurifyLib.sanitize(html);
    } else {
      // 降级处理: 基本消毒 (移除script标签和事件处理器)
      const sanitized = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
      element.innerHTML = sanitized;
    }
  }

  /**
   * 设置代码块复制按钮
   * @param {HTMLElement} container - 容器元素
   */
  function setupCodeBlockCopy(container) {
    const codeBlocks = container.querySelectorAll('pre code');

    codeBlocks.forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (pre.querySelector('.code-block-copy')) return;

      // 包装pre元素
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // 添加复制按钮
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
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @param {HTMLElement} button - 复制按钮
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
      console.error('[ChatRenderer] Copy failed:', err);
    }
  }

  /**
   * 渲染空状态
   */
  function renderEmptyState() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // 不重复创建
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
   * 滚动到底部
   */
  function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * 格式化时间戳
   * @param {number} ts - 时间戳
   * @returns {string} 格式化后的时间字符串
   */
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 公开API
  return {
    init,
    renderMessage,
    updateStreamingMessage,
    renderContent,
    setSafeHTML,
    setupCodeBlockCopy,
    scrollToBottom,
    renderEmptyState,
    formatTime
  };
})();

// ES模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatRenderer;
}
