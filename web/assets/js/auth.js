/* =========================================================
   登录 / 注册：客户端校验 + 接口调用 + 跳转回来源页
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;

  function setError(field, message) {
    var node = document.querySelector('[data-error="' + field + '"]');
    if (node) node.textContent = message || '';
  }
  function clearErrors() {
    UI.$$('[data-error]').forEach(function (n) {
      n.textContent = '';
    });
  }
  function redirectBack() {
    var redirect = UI.qs('redirect');
    location.href = redirect ? redirect : 'index.html';
  }

  /**
   * 登录后根据「角色」决定跳转目标（角色优先于 redirect 参数）：
   * - 管理员：默认进入后台；仅当 redirect 本身指向后台页时才沿用
   *   （如被守卫拦截后回填的 ?redirect=admin/index.html），避免携带
   *   顾客页 redirect（?redirect=index.html）时被错误带回前台。
   * - 普通用户：沿用非后台来源页，否则进入商城首页。
   * 同时校验 redirect 必须为同源相对路径，杜绝 open-redirect。
   */
  function resolveTarget(user) {
    var redirect = UI.qs('redirect') || '';
    var safe = !/^(?:[a-z]+:|\/\/)/i.test(redirect); // 拒绝 javascript: / http:// / //
    var isAdminTarget = /(^|\/)admin\//.test(redirect);
    if (user && user.role === 'admin') {
      return safe && isAdminTarget ? redirect : 'admin/index.html';
    }
    return safe && !isAdminTarget && redirect ? redirect : 'index.html';
  }

  /* ---------------- 登录 ---------------- */
  function initLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    UI.$$('[data-fill]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-fill');
        document.getElementById('username').value = type === 'admin' ? 'admin' : 'customer';
        document.getElementById('password').value = type === 'admin' ? 'admin123' : '123456';
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      var username = document.getElementById('username').value.trim();
      var password = document.getElementById('password').value;

      var okFlag = true;
      if (!username) {
        setError('username', '请输入登录账号');
        okFlag = false;
      }
      if (!password) {
        setError('password', '请输入登录密码');
        okFlag = false;
      }
      if (!okFlag) return;

      var btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.textContent = '登录中…';
      window.API.post('/auth/login', { username: username, password: password })
        .then(function (data) {
          // 先清除上一角色的认证状态，再写入本次登录态，避免残留令牌/用户信息串号
          window.Auth.clear();
          window.Auth.setToken(data.token);
          window.Auth.setUser(data.user);
          UI.toast('登录成功，欢迎回来！', 'success');
          var target = resolveTarget(data.user);
          setTimeout(function () {
            location.href = target;
          }, 500);
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = '登 录';
          var detail = err.details || {};
          if (detail.username) setError('username', detail.username);
          if (detail.password) setError('password', detail.password);
          UI.toast(err.message, 'error');
        });
    });
  }

  /* ---------------- 注册 ---------------- */
  function initRegister() {
    var form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      var payload = {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        nickname: document.getElementById('nickname').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
      };
      var confirmPwd = document.getElementById('confirmPassword').value;

      var okFlag = true;
      if (!/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(payload.username)) {
        setError('username', '账号需 3-20 位，字母开头，仅含字母数字下划线');
        okFlag = false;
      }
      if (payload.password.length < 6 || payload.password.length > 20) {
        setError('password', '密码长度需为 6-20 位');
        okFlag = false;
      }
      if (confirmPwd !== payload.password) {
        setError('confirmPassword', '两次输入的密码不一致');
        okFlag = false;
      }
      if (!payload.nickname) {
        setError('nickname', '请输入用户昵称');
        okFlag = false;
      }
      if (payload.phone && !/^1[3-9]\d{9}$/.test(payload.phone)) {
        setError('phone', '手机号格式不正确');
        okFlag = false;
      }
      if (payload.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(payload.email)) {
        setError('email', '邮箱格式不正确');
        okFlag = false;
      }
      if (!okFlag) return;

      var btn = document.getElementById('registerBtn');
      btn.disabled = true;
      btn.textContent = '提交中…';
      window.API.post('/auth/register', payload)
        .then(function (data) {
          window.Auth.setToken(data.token);
          window.Auth.setUser(data.user);
          UI.toast('注册成功，已自动登录！', 'success');
          setTimeout(function () {
            location.href = 'index.html';
          }, 600);
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = '注 册';
          var detail = err.details || {};
          Object.keys(detail).forEach(function (k) {
            setError(k, detail[k]);
          });
          UI.toast(err.message, 'error');
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLogin();
    initRegister();
  });
})();
