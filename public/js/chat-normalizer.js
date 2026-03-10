/**
 * YooAI Chat - Message Normalizer
 * 消息标准化处理，转换为统一的 ChatItem 格式
 */

const ChatNormalizer = (function() {
  // ChatItem 类型枚举
  const CHAT_ITEM_TYPES = {
    MESSAGE: 'message',
    DIVIDER: 'divider',
    STREAM: 'stream',
    READING_INDICATOR: 'reading-indicator'
  };

  // 角色配置
  const ROLE_CONFIGS = {
    user: {
      avatar: '*',
      sender: 'YOU',
      color: '#a0f0f0',
      cssClass: 'user'
    },
    assistant: {
      avatar: '>',
      sender: 'YOOAI',
      color: '#f9e49a',
      cssClass: 'assistant'
    },
    system: {
      avatar: '#',
      sender: 'SYSTEM',
      color: '#f9a070',
      cssClass: 'system'
    }
  };

  /**
   * 获取角色配置
   * @param {string} role - 角色 (user/assistant/system)
   * @returns {Object} 角色配置
   */
  function getRoleConfig(role) {
    return ROLE_CONFIGS[role] || ROLE_CONFIGS.system;
  }

  /**
   * 标准化消息内容
   * 将字符串/数组/对象转换为统一的 Array<MessageContentItem> 格式
   * @param {string|Array|Object} content - 原始内容
   * @returns {Array} 标准化后的内容项数组
   */
  function normalizeContent(content) {
    if (!content) {
      return [{ type: 'text', text: '' }];
    }

    // 如果是字符串
    if (typeof content === 'string') {
      // 检查是否包含工具标记
      if (ChatToolCards.hasToolContent(content)) {
        return ChatToolCards.parseToolContent(content);
      }
      return [{ type: 'text', text: content }];
    }

    // 如果是数组
    if (Array.isArray(content)) {
      return content.map(item => {
        if (typeof item === 'string') {
          return { type: 'text', text: item };
        }
        if (!item.type) {
          return { type: 'text', text: item.text || JSON.stringify(item) };
        }
        return item;
      });
    }

    // 如果是对象
    if (typeof content === 'object') {
      // 检查是否是已结构化的内容项
      if (content.type) {
        return [content];
      }
      // 如果有 content 字段
      if (content.content) {
        return normalizeContent(content.content);
      }
      // 如果有 text 字段
      if (content.text) {
        return [{ type: 'text', text: content.text }];
      }
      // 其他情况转为 JSON 字符串
      return [{ type: 'text', text: JSON.stringify(content) }];
    }

    return [{ type: 'text', text: String(content) }];
  }

  /**
   * 标准化单条消息
   * @param {Object} msg - 原始消息对象
   * @param {number} index - 消息索引
   * @returns {Object} 标准化后的 ChatItem
   */
  function normalizeMessage(msg, index) {
    if (!msg) return null;

    const timestamp = msg.timestamp || Date.now();
    const role = msg.role || 'system';
    const content = normalizeContent(msg.content);

    return {
      type: msg.streaming ? CHAT_ITEM_TYPES.STREAM : CHAT_ITEM_TYPES.MESSAGE,
      id: msg.id || `msg-${timestamp}-${index}`,
      role,
      content,
      timestamp,
      streaming: msg.streaming || false,
      raw: msg // 保留原始消息引用
    };
  }

  /**
   * 将原始消息数组转换为 ChatItem 数组
   * 包含日期分隔线和消息分组处理
   * @param {Array} rawMessages - 原始消息数组
   * @returns {Array} ChatItem 数组
   */
  function normalize(rawMessages) {
    if (!rawMessages || rawMessages.length === 0) {
      return [];
    }

    const chatItems = [];
    let lastDate = null;

    rawMessages.forEach((msg, index) => {
      // 检查是否需要日期分隔线
      const msgDate = new Date(msg.timestamp || Date.now()).toDateString();

      if (msgDate !== lastDate) {
        chatItems.push({
          type: CHAT_ITEM_TYPES.DIVIDER,
          timestamp: msg.timestamp || Date.now(),
          dateLabel: ChatMessageUtils.formatDateLabel(msg.timestamp || Date.now())
        });
        lastDate = msgDate;
      }

      // 标准化消息
      const normalizedMsg = normalizeMessage(msg, index);
      if (normalizedMsg) {
        chatItems.push(normalizedMsg);
      }
    });

    return chatItems;
  }

  /**
   * 创建流式消息项
   * @param {string} text - 初始文本
   * @param {number} startedAt - 开始时间戳
   * @returns {Object} 流式消息项
   */
  function createStreamItem(text = '', startedAt = Date.now()) {
    return {
      type: CHAT_ITEM_TYPES.STREAM,
      id: `stream-${startedAt}`,
      role: 'assistant',
      content: [{ type: 'text', text }],
      timestamp: startedAt,
      streaming: true
    };
  }

  /**
   * 创建输入指示器项
   * @returns {Object} 输入指示器项
   */
  function createReadingIndicatorItem() {
    return {
      type: CHAT_ITEM_TYPES.READING_INDICATOR,
      timestamp: Date.now()
    };
  }

  /**
   * 渲染消息内容
   * @param {Array} contentItems - 内容项数组
   * @param {Function} markdownRenderer - Markdown 渲染函数（可选）
   * @returns {HTMLElement|string} 渲染后的内容
   */
  function renderContentItems(contentItems, markdownRenderer) {
    if (!contentItems || contentItems.length === 0) {
      return '';
    }

    // 检查是否包含工具内容
    const hasTools = contentItems.some(item =>
      item.type === 'tool_use' ||
      item.type === 'tool_call' ||
      item.type === 'tool_result'
    );

    if (hasTools) {
      // 使用 ChatToolCards 渲染
      return ChatToolCards.renderContentWithTools(contentItems);
    }

    // 纯文本内容，使用 Markdown 渲染
    const textContent = contentItems
      .filter(item => item.type === 'text' || !item.type)
      .map(item => item.text || '')
      .join('\n');

    if (markdownRenderer && typeof markdownRenderer === 'function') {
      return markdownRenderer(textContent);
    }

    // 如果有 marked 库
    if (typeof marked !== 'undefined') {
      return marked.parse(textContent);
    }

    // 降级处理：转义 HTML 并保留换行
    return textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  /**
   * 安全地设置 HTML 内容
   * @param {HTMLElement} element - 目标元素
   * @param {string} html - HTML 字符串
   */
  function setSafeHTML(element, html) {
    if (typeof DOMPurify !== 'undefined') {
      element.innerHTML = DOMPurify.sanitize(html);
    } else {
      // Fallback: 基本净化
      const sanitized = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
      element.innerHTML = sanitized;
    }
  }

  /**
   * 渲染单个 ChatItem
   * @param {Object} item - ChatItem 对象
   * @param {Object} options - 渲染选项
   * @param {Function} options.markdownRenderer - Markdown 渲染函数
   * @param {Function} options.sanitizeHtml - HTML 净化函数
   * @returns {HTMLElement|null} 渲染后的 DOM 元素
   */
  function renderItem(item, options = {}) {
    if (!item) return null;

    const { markdownRenderer, sanitizeHtml } = options;

    switch (item.type) {
      case CHAT_ITEM_TYPES.DIVIDER:
        return ChatMessageUtils.createDateDivider(item.timestamp);

      case CHAT_ITEM_TYPES.READING_INDICATOR:
        return ChatMessageUtils.createTypingIndicator();

      case CHAT_ITEM_TYPES.STREAM:
      case CHAT_ITEM_TYPES.MESSAGE:
        return renderMessageItem(item, { markdownRenderer, sanitizeHtml });

      default:
        console.warn('[ChatNormalizer] Unknown item type:', item.type);
        return null;
    }
  }

  /**
   * 渲染消息项
   * @param {Object} item - 消息项
   * @param {Object} options - 渲染选项
   * @returns {HTMLElement} 消息 DOM 元素
   */
  function renderMessageItem(item, options = {}) {
    const { markdownRenderer, sanitizeHtml } = options;
    const roleConfig = getRoleConfig(item.role);

    const msgEl = document.createElement('div');
    msgEl.className = `message ${roleConfig.cssClass}${item.streaming ? ' streaming' : ''}`;
    msgEl.dataset.timestamp = item.timestamp;
    msgEl.dataset.role = item.role;

    if (item.id) {
      msgEl.dataset.id = item.id;
    }

    // 消息头部
    const headerEl = document.createElement('div');
    headerEl.className = 'message-header';

    const avatarEl = document.createElement('span');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = roleConfig.avatar;

    const senderEl = document.createElement('span');
    senderEl.className = 'message-sender';
    senderEl.textContent = roleConfig.sender;
    senderEl.style.color = roleConfig.color;

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = formatTime(item.timestamp);

    headerEl.appendChild(avatarEl);
    headerEl.appendChild(senderEl);
    headerEl.appendChild(timeEl);

    // 消息气泡
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    // 渲染内容
    const renderedContent = renderContentItems(item.content, markdownRenderer);

    if (renderedContent instanceof HTMLElement) {
      // 工具卡片等 DOM 元素
      contentEl.appendChild(renderedContent);
    } else {
      // HTML 字符串（Markdown 渲染结果）
      setSafeHTML(contentEl, renderedContent);
    }

    bubbleEl.appendChild(contentEl);

    // 组装消息
    msgEl.appendChild(headerEl);
    msgEl.appendChild(bubbleEl);

    return msgEl;
  }

  /**
   * 格式化时间
   * @param {number} ts - 时间戳
   * @returns {string} 格式化后的时间字符串
   */
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // Public API
  return {
    normalize,
    normalizeMessage,
    normalizeContent,
    createStreamItem,
    createReadingIndicatorItem,
    renderItem,
    getRoleConfig,
    renderContentItems,
    CHAT_ITEM_TYPES
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatNormalizer;
}
