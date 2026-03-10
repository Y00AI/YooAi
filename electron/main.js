const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron');
const { createServer } = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let tray = null;
let server = null;
let wss = null;

const PREFERRED_PORT = 8765;
let PORT = PREFERRED_PORT;
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
const WORKSPACE = path.join(OPENCLAW_HOME, 'workspace');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');
const isDev = process.argv.includes('--dev');

// ── Gateway config ────────────────────────────────────────────────────────────
function getGatewayConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(OPENCLAW_HOME, 'openclaw.json'), 'utf8'));
    return { host: '127.0.0.1', port: cfg?.gateway?.port || 18789, token: cfg?.gateway?.auth?.token || '' };
  } catch {
    return { host: '127.0.0.1', port: 18789, token: '' };
  }
}



// ── Memory files ──────────────────────────────────────────────────────────────
function getMemoryFiles() {
  const files = [];
  const mainMem = path.join(WORKSPACE, 'MEMORY.md');
  if (fs.existsSync(mainMem)) {
    const content = fs.readFileSync(mainMem, 'utf8');
    files.push({ name: 'MEMORY.md', date: 'pinned', preview: content.slice(0, 200).replace(/[#*`]/g, '').trim(), content });
  }
  if (fs.existsSync(MEMORY_DIR)) {
    fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 10).forEach(filename => {
      try {
        const content = fs.readFileSync(path.join(MEMORY_DIR, filename), 'utf8');
        files.push({ name: filename.replace('.md', ''), date: filename.slice(0, 10), preview: content.slice(0, 200).replace(/[#*`]/g, '').trim(), content });
      } catch {}
    });
  }
  return files;
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
function startBackendServer() {
  server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url === '/api/config') {
      const cfg = getGatewayConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ gatewayHost: cfg.host, gatewayPort: cfg.port, hasToken: !!cfg.token }));
    }

    if (req.method === 'POST' && req.url === '/api/set-token') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { token } = JSON.parse(body);
          const cfgPath = path.join(OPENCLAW_HOME, 'openclaw.json');
          fs.mkdirSync(OPENCLAW_HOME, { recursive: true });
          let cfg = {};
          try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
          cfg.gateway = cfg.gateway || {};
          cfg.gateway.auth = cfg.gateway.auth || {};
          cfg.gateway.auth.token = token;
          fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message || String(e) }));
        }
      });
      return;
    }

    if (req.url === '/api/memory') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ files: getMemoryFiles() }));
    }

    let filePath = path.join(__dirname, '../public', req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) filePath = path.join(__dirname, '../public/index.html');
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });

  // ── WebSocket proxy with proper OpenClaw v3 auth handshake ───────────────
  wss = new WebSocket.Server({ server });
  wss.on('connection', (clientWs) => {
    const cfg = getGatewayConfig();
    const gwUrl = `ws://${cfg.host}:${cfg.port}/ws`;

    let gatewayWs;
    try { gatewayWs = new WebSocket(gwUrl); }
    catch (err) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'Could not connect to OpenClaw gateway: ' + err.message }));
      clientWs.close(); return;
    }

    gatewayWs.on('open', () => {
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ type: 'proxy.connected', message: 'Gateway connected' }));
    });

    gatewayWs.on('message', (data) => {
      const str = data.toString();

      try {
        const msg = JSON.parse(str);

        // On connect.challenge, respond with token in auth — no device/crypto needed
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          const freshCfg = getGatewayConfig();
          const token = freshCfg.token;
          const connectReq = {
            type: 'req',
            method: 'connect',
            id: `yooai-${Date.now()}`,
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'gateway-client',
                displayName: 'YooAI Desktop',
                version: '1.0.0',
                platform: process.platform,
                mode: 'ui',
                instanceId: `yooai-${Date.now()}`
              },
              role: 'operator',
              scopes: ['operator.admin'],
              auth: token ? { token } : undefined
            }
          };
          gatewayWs.send(JSON.stringify(connectReq));
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(str);
          return;
        }

        // hello-ok = auth succeeded
        if (msg.type === 'res' && msg.ok === true) {
          if (clientWs.readyState === WebSocket.OPEN)
            clientWs.send(JSON.stringify({ type: 'proxy.authed', message: 'Gateway auth OK' }));
        }
      } catch (_) {}

      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(str);
    });

    gatewayWs.on('error', (err) => {
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ type: 'error', error: 'Gateway error: ' + err.message }));
    });

    gatewayWs.on('close', (code, reason) => {
      console.log('[YooAI] gateway closed — code:', code, 'reason:', reason && reason.toString());
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ type: 'proxy.disconnected', code, reason: reason && reason.toString() }));
    });

    clientWs.on('message', (data) => {
      if (gatewayWs.readyState === WebSocket.OPEN) gatewayWs.send(data.toString());
    });
    clientWs.on('close', () => {
      if (gatewayWs.readyState === WebSocket.OPEN) gatewayWs.close();
    });
  });

  function tryListen() {
    server.listen(PORT, '127.0.0.1');
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      PORT += 1;
      if (PORT > PREFERRED_PORT + 10) {
        require('electron').dialog.showErrorBox('YooAI — Port Conflict', 'Could not find a free port. Please close other YooAI instances and restart.');
        app.quit(); return;
      }
      server.close(() => tryListen());
    } else {
      throw err;
    }
  });

  tryListen();
}

// ── Electron window ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'YooAI', backgroundColor: '#0a1628',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'win32',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    show: false
  });
  if (process.platform === 'win32') mainWindow.setMenuBarVisibility(false);
  else Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); if (isDev) mainWindow.webContents.openDevTools(); });
  mainWindow.on('close', (e) => { if (process.platform === 'darwin' && !app.isQuitting) { e.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  const iconData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA' +
    'AXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABsSURBVHgB7ZKxDYAwDASfkAWyAUuwQmACNmAF' +
    'RqCiSBTJBmzACmzACmzABt2TLCERkZ+fU+z/nQ0AAAAASUVORK5CYII=', 'base64');
  const icon = nativeImage.createFromBuffer(iconData);
  tray = new Tray(icon);
  tray.setToolTip('YooAI — OpenClaw Dashboard');
  const menu = Menu.buildFromTemplate([
    { label: '🦀 YooAI Dashboard', enabled: false }, { type: 'separator' },
    { label: 'Show', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show(); } else createWindow(); });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
// Single instance lock — if another instance is running, focus it and quit this one
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    startBackendServer();
    server.on('listening', () => { createWindow(); createTray(); });
    app.on('activate', () => { if (!mainWindow) createWindow(); else mainWindow.show(); });
  });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; if (server) server.close(); });

ipcMain.handle('get-openclaw-home', () => OPENCLAW_HOME);
ipcMain.handle('get-memory-dir', () => MEMORY_DIR);
ipcMain.on('win-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('win-maximize', () => { if (!mainWindow) return; mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('win-close', () => { app.isQuitting = true; app.quit(); });
ipcMain.handle('get-gateway-log', () => { const today = new Date().toISOString().slice(0,10); return path.join(os.tmpdir(), 'openclaw', `openclaw-${today}.log`); });
