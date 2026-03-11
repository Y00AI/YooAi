/**
 * YooAI Gateway - WebSocket Connection Manager
 * Handles connection to OpenClaw gateway through YooAI proxy
 */

const Gateway = (function() {
  let ws = null;
  let connected = false;
  let messageHandlers = [];
  let pendingRequests = new Map(); // id → { resolve, timeout }

  /**
   * Connect to WebSocket
   */
  function connect() {
    if (ws) ws.close();

    const wsUrl = `ws://${location.host}/`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected = true;
        updateConnectionUI(true);
        dispatchMessage({ type: 'gateway.connected' });
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          processMessage(data);
        } catch (err) {
          console.error('[Gateway] Parse error:', err);
        }
      };

      ws.onerror = () => {
        console.error('[Gateway] Connection error');
        dispatchMessage({ type: 'gateway.error', error: 'Connection error' });
      };

      ws.onclose = (e) => {
        connected = false;
        updateConnectionUI(false);
        dispatchMessage({ type: 'gateway.disconnected', code: e.code });
      };
    } catch (err) {
      console.error('[Gateway] Failed to connect:', err);
    }
  }

  /**
   * Disconnect WebSocket
   */
  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
    updateConnectionUI(false);
  }

  /**
   * Send message through WebSocket
   */
  function send(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[Gateway] Not connected');
      return false;
    }

    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(payload);
      return true;
    } catch (err) {
      console.error('[Gateway] Send error:', err);
      return false;
    }
  }

  /**
   * Send request and wait for response
   * @param {string} method - Method name
   * @param {Object} params - Request parameters
   * @param {number} timeout - Timeout in ms (default 10000)
   * @returns {Promise<Object>} Response payload
   */
  function request(method, params = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      pendingRequests.set(id, {
        resolve: (res) => {
          if (res.ok) {
            resolve(res.payload || res);
          } else {
            reject(new Error(res.error || 'Request failed'));
          }
        },
        timeout: timer
      });

      const payload = {
        type: 'req',
        id,
        method,
        params
      };

      ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Process incoming message
   */
  function processMessage(d) {
    // Handle response to our request
    if (d.type === 'res' && d.id && pendingRequests.has(d.id)) {
      const pending = pendingRequests.get(d.id);
      clearTimeout(pending.timeout);
      pendingRequests.delete(d.id);
      pending.resolve(d);
      return;
    }

    // Skip internal protocol frames
    if (d.type === 'res') return;
    if (d.type === 'event' && d.event === 'connect.challenge') return;

    // Unwrap envelope
    const ev = (d.type === 'event' && d.event) ? d.event : (d.type || d.event || '?');
    const p = (d.type === 'event' && d.payload) ? d.payload : d;

    // Dispatch to handlers
    dispatchMessage({ type: ev, payload: p, raw: d });
  }

  /**
   * Dispatch message to all handlers
   */
  function dispatchMessage(msg) {
    for (const handler of messageHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error('[Gateway] Handler error:', err);
      }
    }
  }

  /**
   * Register message handler
   */
  function onMessage(handler) {
    messageHandlers.push(handler);
    return () => {
      messageHandlers = messageHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Update connection UI
   */
  function updateConnectionUI(isConnected) {
    const badge = document.getElementById('connBadge');
    const dot = document.getElementById('dot');
    const text = document.getElementById('connTxt');

    if (badge) {
      badge.className = 'conn-badge glass ' + (isConnected ? 'on' : 'off');
    }
    if (dot) {
      dot.className = 'dot' + (isConnected ? ' pulse' : '');
    }
    if (text) {
      text.textContent = isConnected ? '已连接' : '未连接';
    }
  }

  /**
   * Check if connected
   */
  function isConnected() {
    return connected && ws && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Save token and connect
   */
  async function saveTokenAndConnect(token) {
    try {
      const r = await fetch('/api/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!r.ok) throw new Error('Save failed');

      connect();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Public API
  return {
    connect,
    disconnect,
    send,
    request,
    onMessage,
    isConnected,
    saveTokenAndConnect
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Gateway;
}
