/* =========================================================
   后台公共布局：侧边栏、顶栏、管理员权限守卫
   ========================================================= */
(function (global) {
  'use strict';
  var UI = global.UI;

  var MENU = [
    { group: '经营概览' },
    { href: 'index.html', text: '数据概览', icon: '📊' },
    { group: '商品中心' },
    { href: 'flowers.html', text: '商品管理', icon: '🌷' },
    { href: 'categories.html', text: '分类管理', icon: '🗂️' },
    { group: '交易与用户' },
    { href: 'orders.html', text: '订单管理', icon: '📦' },
    { href: 'users.html', text: '用户管理', icon: '👥' },
    { href: 'reviews.html', text: '评价管理', icon: '💬' },
    { group: '其它' },
    { href: '../index.html', text: '返回商城首页', icon: '🏠' },
  ];

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function render() {
    var side = document.getElementById('adminSide');
    var top = document.getElementById('adminTop');
    var user = global.Auth.getUser() || { nickname: '管理员' };

    var menuHtml = MENU.map(function (item) {
      if (item.group) return '<div class="group-title">' + item.group + '</div>';
      var active = currentPage() === item.href ? ' class="active"' : '';
      return '<a href="' + item.href + '"' + active + '><span class="ico">' + item.icon + '</span><span class="txt">' + item.text + '</span></a>';
    }).join('');

    var title = (document.querySelector('title') || {}).textContent || '后台管理';
    title = title.split('-')[0].trim();

    if (side) {
      side.innerHTML =
        '<div class="admin-brand"><span class="dot">🌸</span><span>花间集<small>ADMIN CONSOLE</small></span></div>' +
        '<nav class="admin-menu">' + menuHtml + '</nav>';
    }
    if (top) {
      top.innerHTML =
        '<h2>' + UI.escapeHtml(title) + '</h2>' +
        '<div class="right">' +
        '<span id="adminClock"></span>' +
        '<div class="admin-user"><span class="avatar">' + UI.escapeHtml((user.nickname || 'A').slice(0, 1)) + '</span>' +
        '<span>' + UI.escapeHtml(user.nickname) + '</span></div>' +
        '<button class="btn btn-ghost btn-sm" id="adminLogout">退出</button>' +
        '</div>';
      document.getElementById('adminLogout').addEventListener('click', function () {
        global.Auth.clear();
        UI.toast('已退出后台');
        setTimeout(function () {
          location.href = '../login.html';
        }, 400);
      });
      tickClock();
    }
  }

  function tickClock() {
    var node = document.getElementById('adminClock');
    if (!node) return;
    function update() {
      node.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
    }
    update();
    setInterval(update, 1000);
  }

  /** 管理员守卫：未登录或角色非管理员则拦截 */
  function guard() {
    var user = global.Auth.getUser();
    if (!global.Auth.isLogin()) {
      location.href = '../login.html?redirect=' + encodeURIComponent('admin/' + currentPage());
      return false;
    }
    if (!user || user.role !== 'admin') {
      UI.toast('仅管理员可访问后台管理系统', 'error');
      setTimeout(function () {
        location.href = '../index.html';
      }, 900);
      return false;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('adminSide')) return;
    if (!guard()) return;
    render();
  });

  global.AdminLayout = { render: render, guard: guard, MENU: MENU };
})(window);
