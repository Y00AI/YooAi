/**
 * YooAI Chat - Tool Cards
 * 工具卡片组件：工具调用、工具结果、思考过程（三级折叠）
 */

const ChatToolCards = (function() {
  const SHORT_OUTPUT_THRESHOLD = 80;

  // 基础卡片类型配置
  const CARD_TYPES = {
    toolCall: { icon: '🔧', label: 'TOOL CALL', color: '#78909c' },
    toolResult: { icon: '📋', label: 'TOOL RESULT', color: '#78909c' },
    thinking: { icon: '💭', label: 'THINKING', color: '#ba68c8' }
  };

  // 工具特定配置（图标 + 颜色）
  const TOOL_CONFIG = {
    read:      { icon: '📄', color: '#42a5f5', label: 'READ' },       // 蓝色
    edit:      { icon: '✏️', color: '#ffa726', label: 'EDIT' },       // 橙色
    write:     { icon: '📝', color: '#ab47bc', label: 'WRITE' },      // 紫色
    bash:      { icon: '💻', color: '#ffca28', label: 'BASH' },       // 黄色
    exec:      { icon: '💻', color: '#ffca28', label: 'EXEC' },       // 黄色
    grep:      { icon: '🔍', color: '#26a69a', label: 'GREP' },       // 青色
    glob:      { icon: '📁', color: '#66bb6a', label: 'GLOB' },       // 绿色
    websearch: { icon: '🌐', color: '#29b6f6', label: 'WEB SEARCH' }, // 天蓝
    notebook:  { icon: '📓', color: '#8d6e63', label: 'NOTEBOOK' },   // 棕色
    default:   { icon: '🔧', color: '#78909c', label: 'TOOL' }        // 灰色
  };

  // 根据工具名获取配置
  function getToolConfig(name) {
    if (!name) return TOOL_CONFIG.default;
    const n = name.toLowerCase().replace(/[^a-z]/g, '');
    if (TOOL_CONFIG[n]) return TOOL_CONFIG[n];
    // 模糊匹配
    for (const k of Object.keys(TOOL_CONFIG)) {
      if (n.includes(k) || k.includes(n)) return TOOL_CONFIG[k];
    }
    return TOOL_CONFIG.default;
  }

  function getToolIcon(name) {
    return getToolConfig(name).icon;
  }

  function formatArgsPreview(args) {
    if (!args) return '';
    let obj = args;
    if (typeof args === 'string') {
      try { obj = JSON.parse(args); } catch { return args.slice(0, 50); }
    }
    for (const k of ['file_path', 'path', 'pattern', 'command', 'query', 'url']) {
      if (obj[k]) return String(obj[k]).slice(0, 40);
    }
    return JSON.stringify(obj).slice(0, 50);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function generateSummary(text, maxLen = 60) {
    if (!text) return '';
    const line = text.split('\n')[0];
    return line.length > maxLen ? line.slice(0, maxLen) + '...' : line;
  }

  /**
   * 创建可折叠卡片（三级折叠：collapsed → partial → full）
   * 简化结构：card > header + content
   * @param {string} type - 卡片类型 (toolCall, toolResult, thinking)
   * @param {string} name - 显示名称
   * @param {string} content - 内容
   * @param {boolean} success - 是否成功
   * @param {string} toolName - 工具名称（用于获取特定图标和颜色）
   */
  function createFoldableCard({ type, name, content, success = true, toolName = null }) {
    // 获取基础配置
    const baseConfig = CARD_TYPES[type] || CARD_TYPES.toolCall;
    // 如果有工具名，获取工具特定配置
    const toolConfig = toolName ? getToolConfig(toolName) : null;

    // 合并配置：工具特定配置优先
    const config = toolConfig ? {
      icon: toolConfig.icon,
      label: toolConfig.label,
      color: toolConfig.color
    } : baseConfig;

    // 生成 CSS 类名
    const cssClass = toolName
      ? `tool-${toolName.toLowerCase().replace(/[^a-z]/g, '')}`
      : type.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

    // 创建卡片容器
    const card = document.createElement('div');
    card.className = `foldable-card ${cssClass}${success ? '' : ' error'}`;
    card.dataset.state = 'collapsed';
    card.dataset.type = type;
    if (toolName) card.dataset.tool = toolName;

    // 创建头部
    const header = document.createElement('div');
    header.className = 'foldable-card-header';

    const icon = document.createElement('span');
    icon.className = 'foldable-card-icon';
    icon.textContent = config.icon;

    const label = document.createElement('span');
    label.className = 'foldable-card-label';
    label.textContent = name || config.label;
    label.style.color = config.color;

    const chevron = document.createElement('span');
    chevron.className = 'foldable-card-chevron';
    chevron.textContent = '›';

    header.appendChild(icon);
    header.appendChild(label);
    header.appendChild(chevron);

    // 创建内容区域
    const contentEl = document.createElement('div');
    contentEl.className = 'foldable-card-content';

    const contentInner = document.createElement('div');
    contentInner.className = 'foldable-card-content-inner';
    contentInner.textContent = content || 'No content';

    const expandBtn = document.createElement('button');
    expandBtn.className = 'foldable-card-expand';
    expandBtn.textContent = '展开全部';
    expandBtn.style.display = 'none';

    contentEl.appendChild(contentInner);
    contentEl.appendChild(expandBtn);

    // 组装卡片
    card.appendChild(header);
    card.appendChild(contentEl);

    // 事件绑定
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleFoldState(card);
    });

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setFoldState(card, 'full');
    });

    return card;
  }

  function cycleFoldState(card) {
    const states = ['collapsed', 'partial', 'full'];
    const current = card.dataset.state;
    const idx = states.indexOf(current);
    const next = states[(idx + 1) % states.length];
    setFoldState(card, next);
  }

  function setFoldState(card, state) {
    card.dataset.state = state;
    const contentEl = card.querySelector('.foldable-card-content');
    const expandBtn = card.querySelector('.foldable-card-expand');
    const contentInner = card.querySelector('.foldable-card-content-inner');

    if (state === 'collapsed') {
      contentEl.style.display = 'none';
      expandBtn.style.display = 'none';
      contentInner.style.maxHeight = '';
    } else if (state === 'partial') {
      contentEl.style.display = 'block';
      contentInner.style.maxHeight = '60px';
      contentInner.style.overflow = 'hidden';
      expandBtn.style.display = 'block';
    } else if (state === 'full') {
      contentEl.style.display = 'block';
      contentInner.style.maxHeight = 'none';
      contentInner.style.overflow = 'auto';
      expandBtn.style.display = 'none';
    }
  }

  // Legacy API compatibility
  function createToolCallCard({ name, args, status = 'pending' }) {
    const argsStr = typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args || '');
    const toolConfig = getToolConfig(name);
    return createFoldableCard({
      type: 'toolCall',
      name: name ? `${toolConfig.label}: ${name}` : 'Tool Call',
      content: argsStr ? `Arguments:\n${argsStr}` : 'No arguments',
      toolName: name
    });
  }

  function createToolResultCard({ name, text, success = true }) {
    const toolConfig = getToolConfig(name);
    return createFoldableCard({
      type: 'toolResult',
      name: name ? `${toolConfig.label} Result` : 'Tool Result',
      content: text || 'Completed',
      success,
      toolName: name
    });
  }

  function createThinkingCard({ content, summary }) {
    return createFoldableCard({
      type: 'thinking',
      name: summary || 'Thinking',
      content: content || ''
    });
  }

  function renderContentWithTools(contentItems) {
    const container = document.createElement('div');
    container.className = 'tool-content-container';

    if (typeof contentItems === 'string') {
      container.textContent = contentItems;
      return container;
    }

    const items = Array.isArray(contentItems) ? contentItems : [contentItems];

    for (const item of items) {
      if (!item) continue;
      let el = null;

      switch (item.type) {
        case 'tool_use':
        case 'tool_call':
          el = createToolCallCard({
            name: item.name || item.tool_name,
            args: item.input || item.arguments || item.args
          });
          break;
        case 'tool_result':
          el = createToolResultCard({
            name: item.tool_name || item.name,
            text: item.content || item.output || item.result,
            success: item.is_error !== true
          });
          break;
        case 'thinking':
          el = createThinkingCard({
            content: item.thinking || item.text,
            summary: 'Thinking'
          });
          break;
        default:
          if (item.text || typeof item === 'string') {
            const textEl = document.createElement('div');
            textEl.className = 'tool-text-content';
            textEl.textContent = item.text || item;
            el = textEl;
          }
      }
      if (el) container.appendChild(el);
    }
    return container;
  }

  function hasToolContent(content) {
    if (!content) return false;
    if (Array.isArray(content)) {
      return content.some(i => ['tool_use', 'tool_result', 'tool_call', 'thinking'].includes(i.type));
    }
    if (typeof content === 'object') {
      return ['tool_use', 'tool_result', 'tool_call', 'thinking'].includes(content.type);
    }
    return false;
  }

  function parseToolContent(content) {
    if (!content || typeof content !== 'string') return [{ type: 'text', text: String(content || '') }];
    return [{ type: 'text', text: content }];
  }

  function toggleOutput(cardEl) {
    if (cardEl.classList.contains('foldable-card')) cycleFoldState(cardEl);
  }

  return {
    createToolCallCard,
    createToolResultCard,
    createThinkingCard,
    createFoldableCard,
    renderContentWithTools,
    hasToolContent,
    getToolIcon,
    formatArgsPreview,
    toggleOutput,
    parseToolContent,
    cycleFoldState,
    setFoldState,
    SHORT_OUTPUT_THRESHOLD
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatToolCards;
}
