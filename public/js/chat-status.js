/**
 * @file chat-status.js
 * @description YooAI 状态信息管理器 - 处理智能体状态、会话信息、Token 使用量显示
 * @module YooAI/ChatStatus
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - 无外部依赖
 *
 * @exports
 * - ChatStatus.init() - 初始化状态面板
 * - ChatStatus.updateStatus(state) - 更新智能体状态 (idle/thinking/streaming)
 * - ChatStatus.updateSession(sessionKey) - 更新会话标识
 * - ChatStatus.updateModel(model) - 更新模型信息
 * - ChatStatus.updateTokens(tokens) - 更新 Token 使用量
 *
 * @example
 * // 更新智能体状态
 * ChatStatus.updateStatus('thinking'); // idle | thinking | streaming
 *
 * // 更新 Token 信息
 * ChatStatus.updateTokens({
 *   used: 50000,
 *   total: 204800,
 *   percentUsed: 24
 * });
 *
 * // 更新模型
 * ChatStatus.updateModel('claude-sonnet-4-6');
 *
 * @architecture
 * 状态类型:
 * - idle: 空闲，灰色指示器
 * - thinking: 思考中，蓝色脉冲动画
 * - streaming: 输出中，绿色指示器
 *
 * Token 颜色规则:
 * - <=50%: 绿色
 * - 50-70%: 黄色
 * - >70%: 红色
 */

const ChatStatus = (function() {
  let agentState = 'idle';
  let sessionKey = 'main';
  let model = 'zai/glm-5';
  let thinkLevel = 'low';

  /**
   * Initialize
   */
  function init() {
    // Initial UI update
    updateStatusUI();
  }

  /**
   * Update status display in UI
   */
  function updateStatusUI() {
    // Update status dot and label
    const statusEl = document.getElementById('chatAgentStatus');
    if (statusEl) {
      const dotEl = statusEl.querySelector('.status-dot');
      const labelEl = statusEl.querySelector('.status-label');
      if (dotEl) {
        dotEl.className = 'status-dot ' + agentState;
      }
      if (labelEl) {
        labelEl.textContent = agentState;
      }
    }

    // Update session info
    const sessionEl = document.getElementById('chatSessionInfo');
    if (sessionEl) {
      const labelEl = sessionEl.querySelector('.status-label');
      if (labelEl) {
        labelEl.textContent = 'session ' + sessionKey;
      }
    }

    // Update model info
    const modelEl = document.getElementById('chatModelInfo');
    if (modelEl) {
      const labelEl = modelEl.querySelector('.status-label');
      if (labelEl) {
        labelEl.textContent = model;
      }
    }

    // Update think level
    const thinkEl = document.getElementById('chatThinkInfo');
    if (thinkEl) {
      const labelEl = thinkEl.querySelector('.status-label');
      if (labelEl) {
        labelEl.textContent = 'think ' + thinkLevel;
      }
    }
  }

  /**
   * Update agent status
   * @param {string} status - 'idle' | 'thinking' | 'streaming' | 'error'
   */
  function updateStatus(status) {
    agentState = status;
    updateStatusUI();
  }

  /**
   * Update session
   */
  function updateSession(session) {
    sessionKey = session;
    updateStatusUI();
  }

  /**
   * Update model
   */
  function updateModel(newModel) {
    model = newModel;
    updateStatusUI();
  }

  /**
   * Update think level
   */
  function updateThinkLevel(level) {
    thinkLevel = level;
    updateStatusUI();
  }

  /**
   * Update token usage
   * @param {Object} tokens - Token info object
   * @param {number} tokens.used - Used tokens
   * @param {number} tokens.total - Total context window
   * @param {number} tokens.percentUsed - Pre-calculated percentage (optional)
   */
  function updateTokens(tokens) {
    const tokenEl = document.getElementById('chatTokenInfo');
    if (!tokenEl) {
      return;
    }

    const labelEl = tokenEl.querySelector('.status-label');
    if (!labelEl) return;

    // Support both object and individual params
    let used, total, pct;
    if (typeof tokens === 'object') {
      used = tokens.used || 0;
      total = tokens.total || 204800;
      pct = tokens.percentUsed || Math.round((used / total) * 100);
    } else {
      // Legacy: updateTokens(used, total, max)
      used = arguments[0] || 0;
      total = arguments[1] || 204800;
      pct = Math.round((used / total) * 100);
    }

    const usedK = Math.round(used / 1000);
    const totalK = Math.round(total / 1000);

    // Color based on percentage: red > 70%, yellow > 50%, green <= 50%
    const pctColor = pct > 70 ? '#ff6b6b' :   // 红色
                     pct > 50 ? '#ffd93d' :   // 黄色
                     '#4caf50';               // 绿色

    labelEl.textContent = `tokens ${usedK}k/${totalK}k (${pct}%)`;
    labelEl.style.color = pctColor;
  }

  /**
   * Handle agent event
   */
  function handleAgentEvent(ev, payload) {
    const stream = payload.stream;
    const data = payload.data || {};

    // Lifecycle events
    if (stream === 'lifecycle') {
      if (data.phase === 'start') {
        updateStatus('thinking');
        Chat.showTyping();
      } else if (data.phase === 'end') {
        updateStatus('idle');
        Chat.hideTyping();
        Chat.endStream();
      }
    }

    // Assistant stream - streaming text
    if (stream === 'assistant') {
      updateStatus('streaming');
      Chat.hideTyping();
      const delta = data.delta || '';
      if (delta) {
        Chat.appendToStream(delta);
      }
    }
  }

  // Public API
  return {
    init,
    updateStatus,
    updateSession,
    updateModel,
    updateThinkLevel,
    updateTokens,
    handleAgentEvent
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatStatus;
}
