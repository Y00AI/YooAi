/**
 * @file chat-message-utils.js
 * @description YooAI 消息工具函数 - 日期分隔线、消息分组、输入指示器等 UI 工具
 * @module YooAI/ChatMessageUtils
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - 无外部依赖
 *
 * @exports
 * - ChatMessageUtils.formatDateLabel(ts) - 格式化日期标签 (今天/昨天/M/D)
 * - ChatMessageUtils.createDateDivider(timestamp) - 创建日期分割线元素
 * - ChatMessageUtils.getDateDividerIfNeeded(messages, newMsg) - 判断是否需要日期分割线
 * - ChatMessageUtils.createTypingIndicator() - 创建输入指示器
 * - ChatMessageUtils.showTypingIndicator() - 显示输入指示器
 * - ChatMessageUtils.hideTypingIndicator() - 隐藏输入指示器
 * - ChatMessageUtils.groupMessagesByInterval(messages, gapMs) - 按时间间隔分组消息
 *
 * @example
 * // 创建日期分割线
 * const divider = ChatMessageUtils.createDateDivider(Date.now());
 * container.appendChild(divider);
 *
 * // 显示输入指示器
 * ChatMessageUtils.showTypingIndicator();
 *
 * // 检查是否需要日期分割线
 * if (ChatMessageUtils.getDateDividerIfNeeded(previousMessages, newMessage)) {
 *   container.appendChild(ChatMessageUtils.createDateDivider(newMessage.timestamp));
 * }
 *
 * @architecture
 * 日期分割线规则:
 * - 同一天: 不显示分割线
 * - 不同天: 显示 "今天" / "昨天" / "3/10" 格式
 *
 * 输入指示器:
 * - 三个动画圆点，表示对方正在输入
 * - 自动插入到消息容器末尾
 */

const ChatMessageUtils = (function() {
  // Typing indicator element reference
  let typingIndicatorEl = null;

  /**
   * Format date label (today/yesterday/Month Day)
   * @param {number} ts - timestamp in milliseconds
   * @returns {string} formatted date label
   */
  function formatDateLabel(ts) {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return 'TODAY';
    } else if (isSameDay(date, yesterday)) {
      return 'YESTERDAY';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    }
  }

  /**
   * Check if two dates are on the same day
   * @param {Date|number} d1 - first date
   * @param {Date|number} d2 - second date
   * @returns {boolean}
   */
  function isSameDay(d1, d2) {
    const date1 = d1 instanceof Date ? d1 : new Date(d1);
    const date2 = d2 instanceof Date ? d2 : new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Create date divider element
   * @param {number} timestamp - timestamp in milliseconds
   * @returns {HTMLElement}
   */
  function createDateDivider(timestamp) {
    const divider = document.createElement('div');
    divider.className = 'date-divider';
    divider.dataset.date = new Date(timestamp).toDateString();

    const label = document.createElement('span');
    label.className = 'date-divider-label';
    label.textContent = formatDateLabel(timestamp);

    divider.appendChild(label);
    return divider;
  }

  /**
   * Check if date divider is needed between existing messages and a new message
   * @param {Array} existingMessages - array of existing message elements or data
   * @param {Object} newMessage - new message object with timestamp
   * @returns {boolean}
   */
  function getDateDividerIfNeeded(existingMessages, newMessage) {
    if (!existingMessages || existingMessages.length === 0) {
      return true; // First message always gets a divider
    }

    // Get the last message's timestamp
    const lastMsg = existingMessages[existingMessages.length - 1];
    let lastTimestamp;

    if (lastMsg.dataset && lastMsg.dataset.timestamp) {
      // DOM element
      lastTimestamp = parseInt(lastMsg.dataset.timestamp, 10);
    } else if (lastMsg.timestamp) {
      // Message object
      lastTimestamp = lastMsg.timestamp;
    } else {
      return false;
    }

    // Check if dates are different
    return !isSameDay(lastTimestamp, newMessage.timestamp);
  }

  /**
   * Get sender label based on role
   * @param {string} role - 'user' or 'assistant'
   * @returns {Object} { label, avatar }
   */
  function getSenderLabel(role) {
    const labels = {
      user: { label: 'YOU', avatar: '*' },
      assistant: { label: 'YOOAI', avatar: '>' },
      system: { label: 'SYSTEM', avatar: '#' }
    };
    return labels[role] || labels.system;
  }

  /**
   * Create typing indicator element with three-dot animation
   * @returns {HTMLElement}
   */
  function createTypingIndicator() {
    if (typingIndicatorEl) {
      return typingIndicatorEl;
    }

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';

    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';

    // Create three dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      dot.style.animationDelay = `${i * 0.15}s`;
      bubble.appendChild(dot);
    }

    indicator.appendChild(bubble);
    typingIndicatorEl = indicator;
    return indicator;
  }

  /**
   * Show typing indicator in messages container
   * @param {HTMLElement} container - messages container element (optional)
   */
  function showTypingIndicator(container) {
    const targetContainer = container || document.getElementById('messagesContainer');
    if (!targetContainer) return;

    // Remove empty state if present
    const empty = targetContainer.querySelector('.chat-empty');
    if (empty) empty.remove();

    // Create or reuse indicator
    const indicator = createTypingIndicator();

    // Don't add if already visible
    if (indicator.parentElement === targetContainer) return;

    // Remove any existing indicator
    const existing = targetContainer.querySelector('#typingIndicator');
    if (existing) existing.remove();

    targetContainer.appendChild(indicator);
    scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  function hideTypingIndicator() {
    if (typingIndicatorEl && typingIndicatorEl.parentElement) {
      typingIndicatorEl.remove();
    }

    // Also remove any indicator in DOM
    const existing = document.getElementById('typingIndicator');
    if (existing) existing.remove();
  }

  /**
   * Group messages by sender and time gap
   * @param {Array} messages - array of message objects
   * @param {number} gapThreshold - time gap threshold in milliseconds (default: 60000 = 1 min)
   * @returns {Array} array of grouped messages
   */
  function groupMessages(messages, gapThreshold = 60000) {
    if (!messages || messages.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    messages.forEach((msg, index) => {
      const shouldStartNewGroup = !currentGroup ||
        currentGroup.role !== msg.role ||
        (msg.timestamp - messages[index - 1]?.timestamp > gapThreshold);

      if (shouldStartNewGroup) {
        currentGroup = {
          role: msg.role,
          messages: [msg],
          isFirst: groups.length === 0
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(msg);
      }
    });

    return groups;
  }

  /**
   * Apply grouped message styling to message elements
   * @param {HTMLElement} msgEl - message element
   * @param {boolean} isGrouped - whether this message is part of a group
   * @param {boolean} isFirst - whether this is the first in group
   * @param {boolean} isLast - whether this is the last in group
   */
  function applyGroupedStyle(msgEl, isGrouped, isFirst, isLast) {
    if (!msgEl) return;

    // Remove existing group classes
    msgEl.classList.remove('grouped', 'group-first', 'group-middle', 'group-last');

    if (isGrouped) {
      msgEl.classList.add('grouped');

      if (isFirst && isLast) {
        // Single message, no special styling
        return;
      } else if (isFirst) {
        msgEl.classList.add('group-first');
        // Hide avatar for non-first messages
      } else if (isLast) {
        msgEl.classList.add('group-last');
        const avatar = msgEl.querySelector('.message-avatar');
        if (avatar) avatar.style.visibility = 'hidden';
      } else {
        msgEl.classList.add('group-middle');
        const avatar = msgEl.querySelector('.message-avatar');
        if (avatar) avatar.style.visibility = 'hidden';
      }
    }
  }

  /**
   * Create system message element
   * @param {string} content - message content
   * @param {number} timestamp - timestamp in milliseconds
   * @returns {HTMLElement}
   */
  function createSystemMessage(content, timestamp = Date.now()) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message system';
    msgEl.dataset.timestamp = timestamp;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble system-bubble';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = content;

    bubbleEl.appendChild(contentEl);
    msgEl.appendChild(bubbleEl);

    return msgEl;
  }

  /**
   * Scroll messages container to bottom
   * @param {boolean} smooth - use smooth scrolling (default: false)
   */
  function scrollToBottom(smooth = false) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    if (smooth) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Insert date dividers into a container
   * @param {HTMLElement} container - messages container
   * @param {Array} messages - array of message objects with timestamps
   */
  function insertDateDividers(container, messages) {
    if (!container || !messages || messages.length === 0) return;

    // Remove existing date dividers
    container.querySelectorAll('.date-divider').forEach(el => el.remove());

    let lastDate = null;
    const messageElements = container.querySelectorAll('.message');

    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.timestamp).toDateString();

      if (msgDate !== lastDate) {
        const divider = createDateDivider(msg.timestamp);
        const msgEl = messageElements[index];

        if (msgEl) {
          container.insertBefore(divider, msgEl);
        } else {
          container.appendChild(divider);
        }

        lastDate = msgDate;
      }
    });
  }

  // Public API
  return {
    createDateDivider,
    formatDateLabel,
    isSameDay,
    createTypingIndicator,
    showTypingIndicator,
    hideTypingIndicator,
    groupMessages,
    applyGroupedStyle,
    getSenderLabel,
    getDateDividerIfNeeded,
    createSystemMessage,
    insertDateDividers,
    scrollToBottom
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatMessageUtils;
}
