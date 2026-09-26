'use strict';

/**
 * 前端独立静态服务（零第三方依赖，仅用 Node 内置模块）
 * ------------------------------------------------------------------
 * 作用：让 web 目录可以脱离后端单独启动，方便在编辑器里改页面即时预览。
 * 关键能力：把 /api 开头的请求转发给后端服务，前端代码里的 BASE='/api'
 *          无需任何改动，也不会产生跨域问题。
 *
 * 用法：
 *   node server.js
 *   set PORT=8080 && node server.js
 *   set API_TARGET=http://localhost:4000 && node server.js
 *   node server.js --open        （启动后自动打开浏览器）
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || process.env.FE_PORT || 5173);
const BACKEND = String(process.env.API_TARGET || 'http://localhost:3000').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
};

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function log(tag, msg) {
  console.log(`  [${now()}] ${tag} ${msg}`);
}

/* ---------------- 静态资源 ---------------- */

async function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return sendText(res, 400, '请求地址非法');
  }

  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';

  let filePath = path.join(ROOT, pathname);

  // 防目录穿越：解析后的路径必须仍在 web 目录内
  if (!filePath.startsWith(ROOT)) {
    return sendText(res, 403, '禁止访问该路径');
  }

  try {
    let stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fsp.stat(filePath);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
    log('静态', `${req.method} ${pathname}`);
  } catch (e) {
    log('缺失', `${req.method} ${pathname}`);
    sendText(res, 404, `找不到资源：${pathname}`);
  }
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

/* ---------------- API 转发 ---------------- */

function proxyToBackend(req, res) {
  let target;
  try {
    target = new URL(BACKEND + req.url);
  } catch (e) {
    return sendText(res, 500, `后端地址配置有误：${BACKEND}`);
  }

  const headers = Object.assign({}, req.headers);
  delete headers.host;
  delete headers.connection;
  // 重新由本服务决定消息体长度，避免 chunked 与 content-length 冲突导致后端 400
  delete headers['transfer-encoding'];
  delete headers['content-length'];
  headers.host = target.host;

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (body.length) headers['content-length'] = String(body.length);

    const preq = http.request(target, { method: req.method, headers }, (pres) => {
      const out = Object.assign({}, pres.headers);
      delete out['transfer-encoding'];
      delete out.connection;
      res.writeHead(pres.statusCode, out);
      if (req.method === 'HEAD') return res.end();
      pres.pipe(res);
      log('转发', `${req.method} ${req.url} -> ${pres.statusCode}`);
    });

    preq.setTimeout(15000, () => preq.destroy(new Error('后端响应超时')));

    preq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          code: 502,
          message: `无法连接后端服务 ${BACKEND}（${err.message}）。请先在 IDEA 中启动后端。`
        })
      );
      log('错误', `转发失败 ${req.url} -> ${err.message}`);
    });

    if (body.length) preq.write(body);
    preq.end();
  });
}

/* ---------------- 启动 ---------------- */

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return proxyToBackend(req, res);
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ code: 0, message: '前端静态服务正常', backend: BACKEND }));
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  const line = '═'.repeat(60);
  console.log('');
  console.log(line);
  console.log('  🌸  鲜花订购与管理系统 · 前端静态服务已启动');
  console.log('  ------------------------------------------------------------');
  console.log(`  ➤  顾客端：   http://localhost:${PORT}/`);
  console.log(`  ➤  管理端：   http://localhost:${PORT}/admin/index.html`);
  console.log(`  ➤  接口转发： /api/*  →  ${BACKEND}/api/*`);
  console.log(`  ➤  根目录：   ${ROOT}`);
  console.log(`  ➤  运行环境： Node.js ${process.versions.node}`);
  console.log('  ------------------------------------------------------------');
  console.log('  请用 IDEA 或其他终端另行启动后端，接口才会正常');
  console.log(line);
  console.log('');

  if (process.argv.includes('--open')) {
    spawn('cmd', ['/c', 'start', '', `http://localhost:${PORT}/`], { stdio: 'ignore' }).unref();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  [错误] 端口 ${PORT} 已被占用。换端口方式：`);
    console.error('         CMD 终端：       set PORT=8080 然后 node server.js');
    console.error('         PowerShell 终端：$env:PORT="8080" 然后 node server.js');
    console.error('         （VS Code 默认终端是 PowerShell，请用第二种写法）\n');
  } else {
    console.error('\n  [错误]', err.message, '\n');
  }
  process.exit(1);
});
