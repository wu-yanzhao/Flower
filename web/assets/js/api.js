/* =========================================================
   前端 API 客户端：统一封装 fetch 请求、鉴权头、错误提示
   ========================================================= */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'flower_token';
  var USER_KEY = 'flower_user';

  // 通过 http 访问时与页面同源；直接双击打开 file:// 时回退到本地服务
  var BASE =
    global.API_BASE ||
    (location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api');

  /* ---------- 本地凭证 ---------- */
  var Auth = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY) || '';
    },
    setToken: function (token) {
      localStorage.setItem(TOKEN_KEY, token || '');
    },
    getUser: function () {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    setUser: function (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user || null));
    },
    clear: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    isLogin: function () {
      return !!localStorage.getItem(TOKEN_KEY);
    },
  };

  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** 默认请求超时 15 秒，避免后端无响应时页面永久等待 */
  var TIMEOUT_MS = Number(global.API_TIMEOUT || 15000);

  /** 401 去重跳转标记：并发多个请求时只允许触发一次跳转，避免竞态 */
  var authRedirecting = false;

  /** 当前是否在后台/子目录，决定登录页的相对路径 */
  function loginPath() {
    return /\/admin\//.test(location.pathname) ? '../login.html' : 'login.html';
  }

  /** 错误提示里展示完整后端地址（BASE 为同源相对路径时补上 origin） */
  function displayBase() {
    return BASE.indexOf('/') === 0 ? location.origin + BASE : BASE;
  }

  /**
   * 处理登录失效
   * 边界约定：只有「本次请求确实带了 token」才清理凭证并跳登录页；
   * 匿名请求的 401（如未登录访问需鉴权资源）交给调用方自行处理，
   * 否则游客浏览首页时会被无脑弹到登录页。
   * @param {string} message 后端提示
   * @param {boolean} hadToken 本次请求是否携带了 token
   */
  function handleUnauthorized(message, hadToken) {
    if (!hadToken) return;
    Auth.clear();
    if (global.UI && global.UI.toast) global.UI.toast(message || '登录已失效，请重新登录', 'error');
    if (authRedirecting) return;
    authRedirecting = true;
    setTimeout(function () {
      var page = (location.pathname.split('/').pop() || '').toLowerCase();
      if (page === 'login.html' || page === 'register.html') return;
      var back = location.pathname.replace(/^\//, '') + (location.search || '');
      location.href = loginPath() + '?redirect=' + encodeURIComponent(back);
    }, 600);
  }

  /**
   * 核心请求方法
   * @returns Promise<data>  失败时 reject(new Error(message))
   * 异常约定：
   *   err.code = 'NETWORK_ERROR' 后端不可达 / 未启动
   *   err.code = 'TIMEOUT'       请求超时
   *   err.code = 401            登录失效（已自动跳转登录页）
   *   err.code = 其它数字       后端返回的业务错误码
   */
  function request(method, path, body, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = Auth.getToken();
    var hadToken = !!token;
    if (token) headers.Authorization = 'Bearer ' + token;

    // 超时保护：后端"假死"（接受连接但不响应）时不至于永久挂起
    var timer = null;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var opts = { method: method, headers: headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    if (controller) {
      opts.signal = controller.signal;
      timer = setTimeout(function () {
        controller.abort();
      }, options.timeout || TIMEOUT_MS);
    }

    return fetch(BASE + path, opts)
      // 网络层异常：fetch 在断连/服务未启动时会 reject，原实现缺少 catch，
      // 导致管理端面板永远停在"加载中…"且控制台只有一条 unhandled rejection
      .catch(function (e) {
        var err;
        if (e && e.name === 'AbortError') {
          err = new Error('请求超时，请检查后端服务是否正常响应');
          err.code = 'TIMEOUT';
        } else {
          err = new Error('无法连接后端服务，请确认后端已启动（' + displayBase() + '）');
          err.code = 'NETWORK_ERROR';
        }
        err.detail = e && e.message;
        throw err;
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function () {
          return { code: res.status, message: '服务响应异常（HTTP ' + res.status + '）', data: null };
        });
      })
      .then(function (json) {
        if (json.code === 401) {
          handleUnauthorized(json.message, hadToken);
        }
        if (json.code !== 0) {
          var err = new Error(json.message || '请求失败');
          err.code = json.code;
          err.details = json.details;
          throw err;
        }
        return json.data;
      });
  }

  var api = {
    get: function (path, params) {
      return request('GET', path + buildQuery(params));
    },
    post: function (path, body) {
      return request('POST', path, body || {});
    },
    put: function (path, body) {
      return request('PUT', path, body || {});
    },
    del: function (path, body) {
      return request('DELETE', path, body);
    },
    request: request,
    base: BASE,
  };

  global.API = api;
  global.Auth = Auth;
})(window);
