/**
 * YooAI App - Main Application Logic
 */

(function() {
  'use strict';

  // === STATE ===
  let autoScroll = true;
  let logs = [];
  let msgCount = 0;

  // Mood state (all 0-100)
  let moodAct = 10;
  let moodVibe = 50;
  let moodBrain = 50;
  let moodFocus = 80;
  let moodEnergy = 100;

  // Task progress
  let taskProgressStart = 0;
  let taskProgressDone = false;
  const TASK_DURATION_MS = 120000;

  // Event tracking
  let eventBurst = 0;
  let lastEventTime = 0;
  let agentBusy = false;

  // Timeline stats
  let tlTasks = 0, tlMsgs = 0, tlTools = 0, tlErrors = 0;
  let tlTotalTokens = 0, tlSessionTokens = 0;
  let tlSessionStart = null;
  let tlCurrentTask = null;
  let tlTimerInterval = null;

  const TASK_DEBOUNCE = 5000;

  // === INIT ===
  function init() {
    initTitlebar();
    initFloatingBits();
    initMoodTick();
    initGatewayHandlers();
    initChatHandlers();

    // Auto-connect after short delay
    setTimeout(() => Gateway.connect(), 700);
  }

  // === TITLEBAR ===
  function initTitlebar() {
    if (window.yooai && window.yooai.platform === 'win32') {
      const titlebar = document.getElementById('titlebar');
      if (titlebar) {
        titlebar.classList.add('win');
        document.body.classList.add('has-titlebar');
      }
    }
  }

  // === FLOATING BITS ===
  function initFloatingBits() {
    const bEl = document.getElementById('bits');
    if (!bEl) return;

    ['◆','◇','✦','△','✧','⟡'].forEach((c, i) => {
      for (let j = 0; j < 3; j++) {
        const b = document.createElement('div');
        b.className = 'bit';
        b.textContent = c;
        b.style.cssText = `
          left: ${Math.random() * 100}vw;
          animation-duration: ${18 + Math.random() * 22}s;
          animation-delay: ${Math.random() * 30}s;
          font-size: ${8 + Math.random() * 10}px;
          color: ${['rgba(100,220,220,.4)', 'rgba(245,130,105,.4)', 'rgba(247,195,155,.4)', 'rgba(242,165,195,.4)', 'rgba(249,228,140,.4)'][Math.floor(Math.random() * 5)]}
        `;
        bEl.appendChild(b);
      }
    });
  }

  // === TASK PROGRESS ===
  function renderTaskProgress() {
    const bar = document.getElementById('brainBar');
    if (!bar) return;

    if (taskProgressDone) {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#a0ffc8)';
      return;
    }
    if (!taskProgressStart) {
      bar.style.width = '0%';
      bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#7de8e8)';
      return;
    }

    const elapsed = Date.now() - taskProgressStart;
    const pct = Math.min(95, (elapsed / TASK_DURATION_MS) * 100);
    bar.style.width = pct + '%';
    bar.style.background = 'linear-gradient(90deg,#a0f0f0,#b2ead6,#7de8e8)';
  }

  setInterval(() => {
    if (taskProgressStart && !taskProgressDone) renderTaskProgress();
  }, 500);

  // === MOOD RENDERING ===
  function clamp(v, mn, mx) {
    return Math.max(mn, Math.min(mx, v));
  }

  function renderMood() {
    const actBar = document.getElementById('actBar');
    const vibeBar = document.getElementById('vibeBar');
    const chaosBar = document.getElementById('chaosBar');
    const energyBar = document.getElementById('energyBar');

    if (actBar) actBar.style.width = moodAct + '%';
    if (vibeBar) vibeBar.style.width = moodVibe + '%';
    if (chaosBar) chaosBar.style.width = moodFocus + '%';
    if (energyBar) energyBar.style.width = moodEnergy + '%';

    let emoji, name, sub;
    if (!agentBusy && moodAct < 20) {
      emoji = '😴'; name = '休眠中'; sub = '等待任务中~';
    } else if (!agentBusy) {
      emoji = '😌'; name = '休息中'; sub = '任务完成~';
    } else if (moodEnergy < 5) {
      emoji = '🪫'; name = '精疲力竭'; sub = '能量耗尽...';
    } else if (moodFocus < 12) {
      emoji = '🤯'; name = '不知所措'; sub = '任务太重了...';
    } else if (moodVibe < 25) {
      emoji = '😤'; name = '艰难中'; sub = '情况有点棘手...';
    } else if (moodBrain > 80) {
      emoji = '🤔'; name = '深思中'; sub = '深度推理模式...';
    } else if (moodAct > 80) {
      emoji = '🎯'; name = '专注中'; sub = '全神贯注！';
    } else if (moodVibe > 75) {
      emoji = '✨'; name = '状态极佳'; sub = '感觉很好！';
    } else {
      emoji = '🤔'; name = '思考中...'; sub = '正在处理...';
    }

    const moodEmoji = document.getElementById('moodEmoji');
    const moodName = document.getElementById('moodName');
    const moodSub = document.getElementById('moodSub');

    if (moodEmoji) moodEmoji.textContent = emoji;
    if (moodName) moodName.textContent = name;
    if (moodSub) moodSub.textContent = sub;

    // Update cyborg mood
    if (window._setCyborgMood) {
      window._soulEnergy = moodEnergy;
      if (!agentBusy && moodEnergy < 5) window._setCyborgMood('exhausted');
      else if (!agentBusy) window._setCyborgMood('sleeping');
      else if (moodFocus < 12) window._setCyborgMood('frustrated');
      else if (moodVibe > 75) window._setCyborgMood('vibing');
      else if (moodBrain > 75) window._setCyborgMood('thinking');
      else if (moodAct > 75) window._setCyborgMood('focused');
      else if (moodVibe > 55) window._setCyborgMood('excited');
      else window._setCyborgMood('thinking');
    }
  }

  function onEvent(deltas = {}) {
    const now = Date.now();
    const wasIdle = !agentBusy;
    lastEventTime = now;
    eventBurst++;
    agentBusy = true;

    moodAct = clamp(moodAct + 18, 10, 100);

    if (wasIdle) { moodBrain = 100; moodFocus = 80; }
    if (deltas.brain != null) moodBrain = clamp(moodBrain + deltas.brain, 0, 100);
    if (deltas.vibe != null) moodVibe = clamp(moodVibe + deltas.vibe, 0, 100);
    if (deltas.chaos != null) moodFocus = clamp(moodFocus - deltas.chaos, 0, 100);

    moodEnergy = clamp(moodEnergy - 0.3, 0, 100);
    renderMood();
  }

  function initMoodTick() {
    setInterval(() => {
      if (!Gateway.isConnected()) return;

      const now = Date.now();
      const idleMs = now - lastEventTime;
      const IDLE_THRESHOLD = 8000;

      if (idleMs > IDLE_THRESHOLD && agentBusy) {
        tlCommitTask();
        agentBusy = false;
        moodAct = clamp(moodAct - 40, 10, 100);
        moodFocus = clamp(moodFocus + 20, 0, 100);
        moodBrain = clamp(moodBrain - 20, 20, 100);
        moodVibe = clamp(moodVibe - 10, 40, 100);
        renderMood();
        return;
      }

      if (agentBusy) {
        moodVibe = clamp(moodVibe + 1, 0, 100);
        moodBrain = clamp(moodBrain - 0.4, 0, 100);
        moodEnergy = clamp(moodEnergy - 0.4, 0, 100);
        moodFocus = clamp(moodFocus - 0.2, 0, 100);
        renderMood();
        return;
      }

      if (!agentBusy) {
        moodAct = clamp(moodAct - 3, 10, 100);
        moodVibe = clamp(moodVibe + (moodVibe < 50 ? 1 : -1), 40, 60);
        moodBrain = clamp(moodBrain + 1, 20, 100);
        moodFocus = clamp(moodFocus + 1, 0, 100);
        if (moodAct < 20) moodEnergy = clamp(moodEnergy + 3, 0, 100);
        renderMood();
      }
    }, 500);
  }

  // === GATEWAY HANDLERS ===
  function initGatewayHandlers() {
    Gateway.onMessage((msg) => {
      const ev = msg.type;
      const p = msg.payload;

      if (ev === 'tick') {
        updateStats(p.snapshot || p);
        return;
      }

      if (ev === 'log') {
        const lvl = p.level || 'info';
        addLog(lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'info', 'LOG', p.message || JSON.stringify(p).slice(0, 100));
        return;
      }

      if (ev === 'health') {
        updateStats(p);
        addLog('success', 'WS', '网关健康 ✓');
        return;
      }

      if (ev === 'session.status' || ev === 'status') {
        updateStats(p);
        return;
      }

      if (ev === 'notification') {
        addLog('info', 'NOTIF', p.title || p.message || '通知');
        return;
      }

      if (ev === 'agent.status') {
        updateStats(p);
        addLog('info', 'AGENT', '状态: ' + (p.status || '?'));
        return;
      }

      if (ev === 'telegram.message') {
        addLog('info', 'TG', '来自 ' + (p.from || '用户') + ' 的消息');
        return;
      }

      if (ev === 'agent' || ev === 'agent.stream') {
        updateStats(p);
        tlAddTokens(1);
        tlAddTag('agent');

        // Handle streaming content for chat
        let raw = p.data || p.content || p.message || p.text || '';
        if (typeof raw !== 'string') raw = JSON.stringify(raw);
        if (raw) {
          Chat.appendToStream(raw);
        }

        // Accumulate for timeline label
        if (tlCurrentTask) {
          tlCurrentTask._buf = (tlCurrentTask._buf || '') + raw;
          const snippet = tlCurrentTask._buf.replace(/[^\w\s.,!?'-]/g, '').trim();
          if (snippet.length > 5) {
            tlCurrentTask.label = '💬 ' + snippet.slice(0, 45) + (snippet.length > 45 ? '…' : '');
            if (tlCurrentTask.el) tlRenderEntry(tlCurrentTask.el, tlCurrentTask, true);
          }
        }

        onEvent({ brain: -0.3, chaos: +1 });
        return;
      }

      if (ev === 'chat' || ev === 'chat.message') {
        updateStats(p);
        const sessionId = p.sessionKey || p.runId || p.key || '';
        const parts = sessionId.split(':');
        const agentName = parts[1] || parts[0] || 'agent';
        tlStartTask('会话: ' + agentName + ' · ' + new Date().toTimeString().slice(0, 5));
        tlAddTag('chat');
        tlMsgs++;
        const tlMsgsEl = document.getElementById('tlMsgs');
        if (tlMsgsEl) tlMsgsEl.textContent = tlMsgs;
        onEvent({ vibe: +5, chaos: +8 });
        if (window._brainFire) window._brainFire(null, 5);
        return;
      }

      if (ev === 'agent.message' || ev === 'message') {
        updateStats(p);
        msgCount++;
        const msEl = document.getElementById('sMessages');
        if (msEl) msEl.textContent = msgCount;

        // End stream and add complete message to chat
        Chat.endStream();
        if (p.content || p.message) {
          Chat.addMessage({
            role: 'assistant',
            content: p.content || p.message,
            timestamp: Date.now()
          });
        }

        addLog('agent', 'AGENT', (p.content || p.message || '').slice(0, 120));
        onEvent({ vibe: +3, brain: -0.5, chaos: +2 });
        return;
      }

      if (ev === 'tool.start' || ev === 'tool_start') {
        tlAddTool();
        tlAddTag('tool');
        if (!tlCurrentTask) tlStartTask('工具: ' + (p.tool || p.name || '?'));
        onEvent({ vibe: -2, brain: -1, chaos: +8 });
        if (window._brainFire) window._brainFire(null, 6);
        return;
      }

      if (ev === 'tool.end' || ev === 'tool.result' || ev === 'tool_end') {
        const ok = !p.error;
        addLog(ok ? 'success' : 'error', 'TOOL', ok ? '✓ 完成' : '✗ ' + (p.error || '失败'));
        onEvent({ vibe: ok ? +4 : -8, brain: -1, chaos: ok ? -6 : +15 });
        if (window._brainFire) window._brainFire(null, ok ? 5 : 3);
        return;
      }

      if (ev === 'error' || p.error) {
        tlAddError();
        onEvent({ vibe: -10, brain: -1, chaos: +18 });
        return;
      }

      // Unknown event
      addLog('info', (ev + '     ').slice(0, 5).toUpperCase(), JSON.stringify(p).slice(0, 100));
    });
  }

  // === CHAT HANDLERS ===
  function initChatHandlers() {
    // Chat will be initialized when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Chat.init());
    } else {
      Chat.init();
    }
  }

  // === STATS UPDATE ===
  function updateStats(d) {
    const s = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null && v !== '' && v !== '—') el.textContent = v;
    };

    if (d.sessions && d.sessions.length > 0) {
      const active = d.sessions.find(s => s.active) || d.sessions[d.sessions.length - 1];
      if (active) {
        if (active.model) s('sModel', active.model.includes('/') ? active.model.split('/').pop() : active.model);
        const sid = active.key || active.id || '';
        if (sid) s('sSession', sid.length > 16 ? sid.slice(0, 16) + '…' : sid);
        if (active.totalTokens != null && active.contextTokens != null) {
          s('sContext', Math.round(active.totalTokens / active.contextTokens * 100) + '%');
        }
        if (active.messageCount != null) s('sMessages', active.messageCount);
        if (active.cost != null) {
          const sMessages = document.getElementById('sMessages');
          if (sMessages) sMessages.title = '$' + active.cost.toFixed(4);
        }
      }
    }

    const model = d.model || d.modelId || d.modelName || '';
    if (model) s('sModel', model.includes('/') ? model.split('/').pop() : model);
    s('sVersion', d.version || d.openclaw_version || d.gatewayVersion);
    const sid = d.sessionId || d.session || d.sessionKey || d.runId || d.key || '';
    if (sid) s('sSession', sid.length > 16 ? sid.slice(0, 16) + '…' : sid);
    if (d.reasoning != null) s('sReasoning', d.reasoning ? 'ON ✓' : 'OFF');
    if (d.extendedThinking != null) s('sReasoning', d.extendedThinking ? 'ON ✓' : 'OFF');
  }

  // === LOGGING ===
  function addLog(type, tag, msg) {
    console.log(`[${tag}] ${msg}`);
  }

  // === TIMELINE ===
  function tlStartSession() {
    if (tlSessionStart) return;
    tlSessionStart = Date.now();
    tlTimerInterval = setInterval(() => {
      if (!tlSessionStart) return;
      const s = Math.floor((Date.now() - tlSessionStart) / 1000);
      const m = Math.floor(s / 60), sec = s % 60;
      const timerEl = document.getElementById('sessionTimer');
      if (timerEl) {
        timerEl.textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      }
    }, 1000);
  }

  function tlStartTask(label) {
    const now = Date.now();
    if (tlCurrentTask && (now - tlCurrentTask.lastMs) < TASK_DEBOUNCE) {
      tlCurrentTask.lastMs = now;
      return;
    }
    if (tlCurrentTask) tlCommitTask();

    tlCurrentTask = {
      label: label || '处理中...',
      startMs: now,
      lastMs: now,
      tools: 0,
      errors: 0,
      tokens: 0,
      tags: new Set(),
      el: null
    };

    taskProgressStart = now;
    taskProgressDone = false;
    renderTaskProgress();
    tlStartSession();

    const el = tlAddEntry(tlCurrentTask, true);
    tlCurrentTask.el = el;
  }

  function tlAddTag(tag) {
    if (tlCurrentTask) {
      tlCurrentTask.tags.add(tag);
      tlCurrentTask.lastMs = Date.now();
    }
  }

  function tlAddTool() {
    if (tlCurrentTask) {
      tlCurrentTask.tools++;
      tlCurrentTask.lastMs = Date.now();
      tlTools++;
      const tlToolsEl = document.getElementById('tlTools');
      if (tlToolsEl) tlToolsEl.textContent = tlTools;
    }
  }

  function tlAddError() {
    if (tlCurrentTask) {
      tlCurrentTask.errors++;
      tlCurrentTask.lastMs = Date.now();
      tlErrors++;
      const tlErrorsEl = document.getElementById('tlErrors');
      if (tlErrorsEl) tlErrorsEl.textContent = tlErrors;
    }
  }

  function tlAddTokens(n) {
    tlTotalTokens += n;
    tlSessionTokens += n;
    if (tlCurrentTask) tlCurrentTask.tokens += n;

    const el = document.getElementById('tokenCount');
    if (el) {
      el.textContent = tlTotalTokens >= 1000 ? (tlTotalTokens / 1000).toFixed(1) + 'k' : tlTotalTokens;
      el.classList.remove('token-flash');
      void el.offsetWidth;
      el.classList.add('token-flash');
    }

    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      tlTokenRateEl.textContent = tlTasks > 0 ? Math.round(tlTotalTokens / tlTasks) : tlTotalTokens;
    }
  }

  function tlCommitTask() {
    if (!tlCurrentTask) return;
    const t = tlCurrentTask;
    tlCurrentTask = null;
    tlTasks++;
    taskProgressDone = true;
    renderTaskProgress();

    setTimeout(() => {
      taskProgressDone = false;
      taskProgressStart = 0;
      renderTaskProgress();
    }, 2500);

    const tlTasksEl = document.getElementById('tlTasks');
    if (tlTasksEl) tlTasksEl.textContent = tlTasks;

    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) tlTokenRateEl.textContent = Math.round(tlTotalTokens / tlTasks);

    if (t.el) {
      t.el.classList.remove('tl-active');
      tlRenderEntry(t.el, t, false);
    }
  }

  function tlAddEntry(task, active) {
    const empty = document.getElementById('tlEmpty');
    if (empty) empty.remove();

    const list = document.getElementById('timelineList');
    if (!list) return null;

    const el = document.createElement('div');
    el.className = 'tl-entry' + (active ? ' tl-active' : '');
    tlRenderEntry(el, task, active);
    list.insertBefore(el, list.firstChild);

    while (list.children.length > 50) list.removeChild(list.lastChild);

    return el;
  }

  function tlRenderEntry(el, task, active) {
    const dur = active ? '●' : tlFmtDur(Date.now() - task.startMs);
    const icon = task.errors > 0 ? '⚠️' : task.tools > 2 ? '🔧' : task.tags.has('chat') ? '💬' : '✨';
    const time = new Date(task.startMs).toTimeString().slice(0, 8);

    // Clear and rebuild using DOM methods
    el.textContent = '';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'tl-icon';
    iconEl.textContent = icon;
    el.appendChild(iconEl);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'tl-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = task.label;
    bodyEl.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'tl-meta';

    // Add tags
    for (const tag of task.tags) {
      const tagEl = document.createElement('span');
      tagEl.className = 'tl-tag ' + tag;
      tagEl.textContent = tag.toUpperCase();
      metaEl.appendChild(tagEl);
    }

    // Add tool count
    if (task.tools > 0) {
      const toolEl = document.createElement('span');
      toolEl.className = 'tl-tag tool';
      toolEl.textContent = task.tools + ' tool' + (task.tools > 1 ? 's' : '');
      metaEl.appendChild(toolEl);
    }

    // Add error count
    if (task.errors > 0) {
      const errEl = document.createElement('span');
      errEl.className = 'tl-tag error';
      errEl.textContent = task.errors + ' err';
      metaEl.appendChild(errEl);
    }

    bodyEl.appendChild(metaEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'tl-time';
    timeEl.textContent = time;
    bodyEl.appendChild(timeEl);

    el.appendChild(bodyEl);

    // Right side
    const rightEl = document.createElement('div');
    rightEl.className = 'tl-right';

    const durEl = document.createElement('div');
    durEl.className = 'tl-dur';
    durEl.textContent = dur;
    rightEl.appendChild(durEl);

    if (task.tokens > 0) {
      const tokEl = document.createElement('span');
      tokEl.className = 'tl-tokens';
      tokEl.textContent = '+' + (task.tokens >= 1000 ? (task.tokens / 1000).toFixed(1) + 'k' : task.tokens) + ' tok';
      rightEl.appendChild(tokEl);
    }

    el.appendChild(rightEl);
  }

  function tlFmtDur(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
  }

  // === GLOBAL FUNCTIONS ===
  window.openModal = function() {
    fetch('/api/config').then(r => r.json()).then(c => {
      const modalGwInfo = document.getElementById('modalGwInfo');
      if (modalGwInfo) modalGwInfo.textContent = c.gatewayHost + ':' + c.gatewayPort;

      const statusEl = document.getElementById('tokenStatus');
      if (statusEl) {
        if (c.hasToken) {
          statusEl.textContent = '✓ 在 ~/.openclaw/openclaw.json 中找到令牌';
          statusEl.style.color = '#a0ffc8';
          const cfgToken = document.getElementById('cfgToken');
          if (cfgToken) cfgToken.placeholder = '•••••••••••• (令牌已设置 — 粘贴以替换)';
        } else {
          statusEl.textContent = '⚠ 未找到令牌 — 请在下方粘贴您的网关令牌';
          statusEl.style.color = '#f9a98e';
        }
      }
    }).catch(() => {});

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('open');
  };

  window.closeModal = function() {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('open');
  };

  window.toggleTokenVis = function() {
    const inp = document.getElementById('cfgToken');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  window.saveAndConnect = async function() {
    const tokenEl = document.getElementById('cfgToken');
    const token = tokenEl ? tokenEl.value.trim() : '';
    const saveMsg = document.getElementById('saveMsg');
    const saveBtn = document.getElementById('saveBtn');

    if (token) {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      try {
        const r = await fetch('/api/set-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (!r.ok) throw new Error('Save failed');

        if (saveMsg) {
          saveMsg.textContent = '✓ Token saved!';
          saveMsg.style.color = '#a0ffc8';
        }
        if (tokenEl) {
          tokenEl.value = '';
          tokenEl.placeholder = '•••••••••••• (token saved — paste to replace)';
        }
        const tokenStatus = document.getElementById('tokenStatus');
        if (tokenStatus) {
          tokenStatus.textContent = '✓ Saved to ~/.openclaw/openclaw.json';
          tokenStatus.style.color = '#a0ffc8';
        }
        closeModal();
        Gateway.connect();
      } catch (e) {
        if (saveMsg) {
          saveMsg.textContent = '✗ ' + e.message;
          saveMsg.style.color = '#f9a98e';
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 保存并连接';
        }
      }
    } else {
      closeModal();
      Gateway.connect();
    }
  };

  window.clearTimeline = function() {
    const list = document.getElementById('timelineList');
    if (list) {
      // Clear using DOM methods
      list.textContent = '';

      const emptyEl = document.createElement('div');
      emptyEl.className = 'tl-empty';
      emptyEl.id = 'tlEmpty';

      const iconEl = document.createElement('span');
      iconEl.style.fontSize = '28px';
      iconEl.textContent = '✨';

      const textEl = document.createElement('div');
      textEl.style.fontSize = '11px';
      textEl.style.fontWeight = '700';
      textEl.style.color = 'rgba(255,255,255,0.3)';
      textEl.style.marginTop = '6px';
      textEl.textContent = '等待活动...';

      emptyEl.appendChild(iconEl);
      emptyEl.appendChild(textEl);
      list.appendChild(emptyEl);
    }

    tlTasks = 0;
    tlMsgs = 0;
    tlTools = 0;
    tlErrors = 0;
    tlTotalTokens = 0;
    tlSessionTokens = 0;
    tlSessionStart = null;
    tlCurrentTask = null;
    taskProgressStart = 0;
    taskProgressDone = false;
    renderTaskProgress();

    if (tlTimerInterval) clearInterval(tlTimerInterval);

    ['tlTasks', 'tlMsgs', 'tlTools', 'tlErrors', 'tlTokenRate', 'tokenCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });

    const sessionTimer = document.getElementById('sessionTimer');
    if (sessionTimer) sessionTimer.textContent = '--:--';
  };

  window.loadMemory = async function() {
    const g = document.getElementById('memGrid');
    if (!g) return;

    // Clear and show loading
    g.textContent = '';

    const loadingEl = document.createElement('div');
    loadingEl.className = 'mem-empty';

    const loadingIcon = document.createElement('span');
    loadingIcon.textContent = '⏳';

    const loadingText = document.createTextNode('Loading...');

    loadingEl.appendChild(loadingIcon);
    loadingEl.appendChild(loadingText);
    g.appendChild(loadingEl);

    try {
      const r = await fetch('/api/memory');
      if (!r.ok) throw 0;
      const d = await r.json();
      const files = d.files || d.memories || d || [];

      g.textContent = '';

      if (!files.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'mem-empty';

        const emptyIcon = document.createElement('span');
        emptyIcon.textContent = '🧠';

        const emptyText = document.createTextNode('未找到记忆文件');

        emptyEl.appendChild(emptyIcon);
        emptyEl.appendChild(emptyText);
        g.appendChild(emptyEl);
        return;
      }

      files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'mem-item';

        const headEl = document.createElement('div');
        headEl.className = 'mem-head';

        const iconEl = document.createElement('span');
        iconEl.className = 'mem-icon';
        iconEl.textContent = '📝';

        const titleEl = document.createElement('span');
        titleEl.className = 'mem-title';
        titleEl.textContent = f.name || f.filename || 'Memory';

        const dateEl = document.createElement('span');
        dateEl.className = 'mem-date';
        dateEl.textContent = f.date || '';

        headEl.appendChild(iconEl);
        headEl.appendChild(titleEl);
        headEl.appendChild(dateEl);

        const previewEl = document.createElement('div');
        previewEl.className = 'mem-preview';
        previewEl.textContent = f.preview || f.content?.slice(0, 120) || '...';

        el.appendChild(headEl);
        el.appendChild(previewEl);
        g.appendChild(el);
      });
    } catch {
      g.textContent = '';

      // Add placeholder items
      const items = [
        { icon: '📝', title: 'MEMORY.md', date: 'today', preview: 'Connect Mission Control on port 3000 to view live memory files here' },
        { icon: '🌐', title: 'browser-tool-notes', date: '2026-03-03', preview: 'Browser tool syntax, Chrome relay setup, aria refs, troubleshooting tips saved from session' }
      ];

      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'mem-item';

        const headEl = document.createElement('div');
        headEl.className = 'mem-head';

        const iconEl = document.createElement('span');
        iconEl.className = 'mem-icon';
        iconEl.textContent = item.icon;

        const titleEl = document.createElement('span');
        titleEl.className = 'mem-title';
        titleEl.textContent = item.title;

        const dateEl = document.createElement('span');
        dateEl.className = 'mem-date';
        dateEl.textContent = item.date;

        headEl.appendChild(iconEl);
        headEl.appendChild(titleEl);
        headEl.appendChild(dateEl);

        const previewEl = document.createElement('div');
        previewEl.className = 'mem-preview';
        previewEl.textContent = item.preview;

        el.appendChild(headEl);
        el.appendChild(previewEl);
        g.appendChild(el);
      });
    }
  };

  // === INIT ON DOM READY ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
