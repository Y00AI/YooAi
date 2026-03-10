/**
 * YooAI Chat - Status Info Manager
 * Handles agent status updates
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
   */
  function updateTokens(used, total, max) {
    const tokenEl = document.getElementById('chatTokenInfo');
    if (tokenEl) {
      const labelEl = tokenEl.querySelector('.status-label');
      const pct = Math.round((used / total) * 100);
      const pctColor = pct > 75 ? '#f9a070' :
                       pct > 50 ? '#f9e49a' :
                       pct > 25 ? '#4caf50' : '#a0ffc8';

      labelEl.textContent = `tokens ${used}k/${total}k (${pct}%)`;
      labelEl.style.color = pctColor;
    }
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
