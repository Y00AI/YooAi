/**
 * @file chat-stream.js
 * @description 流式消息处理器 - 管理流式内容追加、工具调用卡片和输入指示器
 * @module YooAI/Chat/Stream
 * @version 2.0.0
 * @author 赵工
 *
 * @dependencies
 * - ChatRenderer (chat-renderer.js) - 消息渲染
 * - ChatMessageUtils (chat-message-utils.js) - UI工具
 * - ChatToolCards (chat-tool-cards.js) - 工具卡片
 *
 * @exports
 * - ChatStream.init(deps) - 初始化流处理器
 * - ChatStream.appendToStream(content) - 追加流式内容
 * - ChatStream.endStream() - 结束流式消息
 * - ChatStream.appendToolCall(options) - 添加工具调用卡片
 * - ChatStream.appendToolResult(options) - 添加工具结果卡片
 * - ChatStream.appendElement(element) - 追加DOM元素到容器
 * - ChatStream.appendElementToStream(element) - 追加元素到流式消息
 * - ChatStream.showTyping() - 显示输入指示器
 * - ChatStream.hideTyping() - 隐藏输入指示器
 * - ChatStream.getCurrentStreamingMsg() - 获取当前流式消息
 * - ChatStream.clear() - 清空流式状态
 *
 * @example
 * // 追加流式内容
 * ChatStream.appendToStream('Hello, ');
 * ChatStream.appendToStream('world!');
 * ChatStream.endStream();
 *
 * // 添加工具调用
 * ChatStream.appendToolCall({
 *   name: 'read_file',
 *   args: { path: '/src/index.js' },
 *   status: 'running'
 * });
 *
 * @architecture
 * 流式消息流程:
 * 1. appendToStream() 创建/更新流式消息
 * 2. content 累积到 currentStreamingMsg.content
 * 3. ChatRenderer.updateStreamingMessage() 更新DOM
 * 4. endStream() 标记流结束，清理状态
 */

const ChatStream = (function() {
  // 状态
  let currentStreamingMsg = null;
  let messages = []; // 引用外部消息数组

  // 依赖引用
  let ChatRendererRef = null;

  /**
   * 初始化流处理器
   * @param {Object} deps - 依赖对象
   * @param {Array} deps.messages - 消息数组引用
   * @param {Object} deps.renderer - ChatRenderer 引用
   */
  function init(deps = {}) {
    if (deps.messages) {
      messages = deps.messages;
    }
    if (deps.renderer) {
      ChatRendererRef = deps.renderer;
    }
  }

  /**
   * 追加内容到流式消息
   * @param {string} content - 要追加的内容
   */
  function appendToStream(content) {
    try {
      // 内容到达时隐藏输入指示器
      if (typeof ChatMessageUtils !== 'undefined') {
        ChatMessageUtils.hideTypingIndicator();
      }
    } catch (e) {
      console.error('[ChatStream] Error hiding typing indicator:', e);
    }

    // 如果没有当前流式消息，或已结束，创建新的
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      // 正确结束之前的流
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

      // 检查是否需要日期分割线
      const container = document.getElementById('messagesContainer');
      if (container && typeof ChatMessageUtils !== 'undefined') {
        if (ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
          const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
          container.appendChild(divider);
        }
      }

      // 渲染新消息
      if (ChatRendererRef) {
        ChatRendererRef.renderMessage(currentStreamingMsg);
      }
    }

    // 累积内容
    currentStreamingMsg.content += content;

    // 更新DOM
    if (ChatRendererRef) {
      ChatRendererRef.updateStreamingMessage(currentStreamingMsg.content);
    }

    // 滚动到底部
    if (ChatRendererRef) {
      ChatRendererRef.scrollToBottom();
    }
  }

  /**
   * 结束流式消息
   */
  function endStream() {
    // 隐藏输入指示器
    if (typeof ChatMessageUtils !== 'undefined') {
      ChatMessageUtils.hideTypingIndicator();
    }

    if (currentStreamingMsg) {
      currentStreamingMsg.streaming = false;
      const msgEl = document.querySelector('.message.streaming');
      if (msgEl) msgEl.classList.remove('streaming');
      currentStreamingMsg = null;
    }
  }

  /**
   * 添加工具调用卡片到流式消息
   * @param {Object} options - 工具调用选项
   * @param {string} options.name - 工具名称
   * @param {Object} options.args - 工具参数
   * @param {string} options.status - 状态 (pending/running)
   */
  function appendToolCall({ name, args, status = 'running' }) {
    // 确保有流式消息容器
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);

      const container = document.getElementById('messagesContainer');
      if (container && typeof ChatMessageUtils !== 'undefined') {
        if (ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
          const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
          container.appendChild(divider);
        }
      }

      if (ChatRendererRef) {
        ChatRendererRef.renderMessage(currentStreamingMsg);
      }
    }

    // 创建工具调用卡片
    if (typeof ChatToolCards !== 'undefined') {
      const card = ChatToolCards.createToolCallCard({ name, args, status });
      appendElementToStream(card);
    }

    if (ChatRendererRef) {
      ChatRendererRef.scrollToBottom();
    }
  }

  /**
   * 添加工具结果卡片到流式消息
   * @param {Object} options - 工具结果选项
   * @param {string} options.name - 工具名称
   * @param {string} options.text - 结果文本
   * @param {boolean} options.success - 是否成功
   */
  function appendToolResult({ name, text, success = true }) {
    // 确保有流式消息容器
    if (!currentStreamingMsg || !currentStreamingMsg.streaming) {
      currentStreamingMsg = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      };
      messages.push(currentStreamingMsg);

      const container = document.getElementById('messagesContainer');
      if (container && typeof ChatMessageUtils !== 'undefined') {
        if (ChatMessageUtils.getDateDividerIfNeeded(messages.slice(0, -1), currentStreamingMsg)) {
          const divider = ChatMessageUtils.createDateDivider(currentStreamingMsg.timestamp);
          container.appendChild(divider);
        }
      }

      if (ChatRendererRef) {
        ChatRendererRef.renderMessage(currentStreamingMsg);
      }
    }

    // 创建工具结果卡片
    if (typeof ChatToolCards !== 'undefined') {
      const card = ChatToolCards.createToolResultCard({ name, text, success });
      appendElementToStream(card);
    }

    if (ChatRendererRef) {
      ChatRendererRef.scrollToBottom();
    }
  }

  /**
   * 追加DOM元素到当前流式消息内容区
   * @param {HTMLElement} element - 要追加的元素
   */
  function appendElementToStream(element) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // 查找当前流式消息内容区
    let contentEl = container.querySelector('.message.streaming .message-content');
    if (!contentEl) {
      // 降级: 查找最后的助手消息
      const lastMsg = container.querySelector('.message.assistant:last-child .message-content');
      contentEl = lastMsg;
    }

    if (contentEl) {
      contentEl.appendChild(element);
    }
  }

  /**
   * 追加DOM元素到消息容器
   * 用于从聊天历史添加工具卡片
   * @param {HTMLElement} element - 要追加的元素
   */
  function appendElement(element) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // 移除空状态
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    container.appendChild(element);

    if (ChatRendererRef) {
      ChatRendererRef.scrollToBottom();
    }
  }

  /**
   * 显示输入指示器
   */
  function showTyping() {
    if (typeof ChatMessageUtils !== 'undefined') {
      ChatMessageUtils.showTypingIndicator();
    }
  }

  /**
   * 隐藏输入指示器
   */
  function hideTyping() {
    if (typeof ChatMessageUtils !== 'undefined') {
      ChatMessageUtils.hideTypingIndicator();
    }
  }

  /**
   * 获取当前流式消息
   * @returns {Object|null} 当前流式消息对象
   */
  function getCurrentStreamingMsg() {
    return currentStreamingMsg;
  }

  /**
   * 清空流式状态
   */
  function clear() {
    currentStreamingMsg = null;
  }

  // 公开API
  return {
    init,
    appendToStream,
    endStream,
    appendToolCall,
    appendToolResult,
    appendElement,
    appendElementToStream,
    showTyping,
    hideTyping,
    getCurrentStreamingMsg,
    clear
  };
})();

// ES模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatStream;
}
