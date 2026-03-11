/**
 * Brain Memory Neural Network Canvas Animation
 *
 * 神经网络动画模块，用于展示大脑记忆网络的动态效果
 *
 * 全局接口:
 * - window._brainFire(start, len) - 触发神经元激活
 *   - start: 起始节点索引 (可选，null 则随机选择)
 *   - len: 激活链长度
 *
 * 依赖:
 * - Canvas 元素 ID: brainCanvas
 * - 外部变量: window.agentBusy (可选，用于控制动画状态)
 */

(function() {
  'use strict';

  const canvas = document.getElementById('brainCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  // 节点和连接数据
  const N = 38;
  const nodes = [];
  const conns = [];

  // 颜色配置
  const COLS = ['rgba(160,240,240,', 'rgba(249,228,154,', 'rgba(242,167,195,'];

  // 响应式调整
  function resize() {
    const p = canvas.parentElement.getBoundingClientRect();
    W = p.width;
    H = p.height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // 初始化节点
  function initNodes() {
    // 提供默认尺寸以防 canvas 尚未渲染
    const defaultW = W || 280;
    const defaultH = H || 200;

    for (let i = 0; i < N; i++) {
      nodes.push({
        x: 25 + Math.random() * (defaultW - 50),
        y: 15 + Math.random() * (defaultH - 30),
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 3 + Math.random() * 4,
        type: Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? 1 : 2,
        ph: Math.random() * Math.PI * 2,
        ps: 0.018 + Math.random() * 0.022,
        glow: 0,
      });
    }
  }

  // 初始化连接
  function initConnections() {
    for (let i = 0; i < N; i++) {
      const sorted = nodes
        .map((n, j) => ({
          j,
          d: j === i ? 1e9 : Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y)
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2 + Math.floor(Math.random() * 2));

      for (const { j } of sorted) {
        if (!conns.find(c => (c.a === i && c.b === j) || (c.a === j && c.b === i))) {
          conns.push({ a: i, b: j, p: 0 });
        }
      }
    }
  }

  /**
   * 触发神经元激活链
   * @param {number|null} start - 起始节点索引，null 则随机选择
   * @param {number} len - 激活链长度
   */
  function fire(start, len) {
    let cur = start != null ? start : Math.floor(Math.random() * N);

    for (let s = 0; s < len; s++) {
      const delay = s * 110;
      const idx = cur;

      setTimeout(function() {
        nodes[idx].glow = 1;

        const nc = conns.filter(function(c) {
          return c.a === idx || c.b === idx;
        });

        for (let ci = 0; ci < nc.length; ci++) {
          nc[ci].p = 1;
        }

        const nbs = nc.map(function(c) {
          return c.a === idx ? c.b : c.a;
        });

        if (nbs.length) {
          cur = nbs[Math.floor(Math.random() * nbs.length)];
        }
      }, delay);
    }
  }

  // 绘制函数
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);

    // 更新节点位置和状态
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      n.ph += n.ps;
      n.x += n.vx + Math.sin(n.ph * 0.4) * 0.07;
      n.y += n.vy + Math.cos(n.ph * 0.3) * 0.06;

      // 边界碰撞检测
      if (n.x < 18) { n.x = 18; n.vx = Math.abs(n.vx); }
      if (n.x > W - 18) { n.x = W - 18; n.vx = -Math.abs(n.vx); }
      if (n.y < 12) { n.y = 12; n.vy = Math.abs(n.vy); }
      if (n.y > H - 12) { n.y = H - 12; n.vy = -Math.abs(n.vy); }

      // glow 衰减
      if (n.glow > 0) {
        n.glow = Math.max(0, n.glow - 0.016);
      }
    }

    // 绘制连接线
    for (let i = 0; i < conns.length; i++) {
      const c = conns[i];
      if (c.p > 0) {
        c.p = Math.max(0, c.p - 0.02);
      }

      const na = nodes[c.a];
      const nb = nodes[c.b];
      const al = 0.06 + c.p * 0.5;

      ctx.save();
      ctx.globalAlpha = al;
      ctx.strokeStyle = COLS[na.type] + '0.9)';
      ctx.lineWidth = 0.6 + c.p * 1.5;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();

      // 绘制移动的光点
      if (c.p > 0.25) {
        const px = na.x + (nb.x - na.x) * (1 - c.p);
        const py = na.y + (nb.y - na.y) * (1 - c.p);
        ctx.globalAlpha = c.p * 0.9;

        const pg = ctx.createRadialGradient(px, py, 0, px, py, 5);
        pg.addColorStop(0, COLS[na.type] + '1)');
        pg.addColorStop(1, COLS[na.type] + '0)');

        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
      }
      ctx.restore();
    }

    // 绘制节点
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      const col = COLS[n.type];
      const br = 0.5 + Math.sin(n.ph) * 0.2;
      const r = n.r + Math.sin(n.ph * 0.7) * 0.8 + n.glow * 3;

      // 绘制光晕
      ctx.save();
      ctx.globalAlpha = br * 0.18 + n.glow * 0.45;
      const og = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.5 + n.glow * 15);
      og.addColorStop(0, col + '0.9)');
      og.addColorStop(1, col + '0)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 3.5 + n.glow * 15, 0, Math.PI * 2);
      ctx.fillStyle = og;
      ctx.fill();
      ctx.restore();

      // 绘制核心
      ctx.save();
      ctx.globalAlpha = br + n.glow * 0.4;
      const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      ng.addColorStop(0, col + '1)');
      ng.addColorStop(1, col + '0.1)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = ng;
      ctx.fill();
      ctx.restore();

      // 绘制白色闪光
      if (n.glow > 0.15) {
        ctx.save();
        ctx.globalAlpha = n.glow * 0.85;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 获取 agentBusy 状态
  function getAgentBusy() {
    return typeof window.agentBusy !== 'undefined' ? window.agentBusy : false;
  }

  // 初始化
  resize();
  initNodes();
  initConnections();
  window.addEventListener('resize', resize);

  // 暴露全局接口
  window._brainFire = fire;

  // 定时触发动画
  setInterval(function() {
    if (!getAgentBusy()) {
      fire(null, 2 + Math.floor(Math.random() * 3));
    }
  }, 2800);

  setInterval(function() {
    var st = document.getElementById('memStatus');
    if (getAgentBusy()) {
      fire(null, 4 + Math.floor(Math.random() * 5));
      if (st) st.textContent = '活跃';
    } else {
      if (st) st.textContent = '空闲';
    }
  }, 950);

  // 启动动画循环
  draw();

})();
