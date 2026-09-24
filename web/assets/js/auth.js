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
          window.Auth.setToken(data.token);
          window.Auth.setUser(data.user);
          UI.toast('登录成功，欢迎回来！', 'success');
          setTimeout(function () {
            if (data.user.role === 'admin' && !UI.qs('redirect')) {
              // 管理员默认进入后台，也可自行返回商城
              location.href = 'admin/index.html';
            } else {
              redirectBack();
            }
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
