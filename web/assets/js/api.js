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

  /**
   * 核心请求方法
   * @returns Promise<data>  失败时 reject(new Error(message))
   */
  function request(method, path, body, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = Auth.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    return fetch(BASE + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { code: res.status, message: '服务响应异常（HTTP ' + res.status + '）', data: null };
        });
      })
      .then(function (json) {
        if (json.code === 401) {
          Auth.clear();
          if (global.UI && global.UI.toast) global.UI.toast('登录已失效，请重新登录', 'error');
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
