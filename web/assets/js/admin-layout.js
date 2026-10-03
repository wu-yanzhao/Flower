/* =========================================================
   后台公共布局：侧边栏、顶栏、页脚、管理员权限守卫
   ========================================================= */
(function (global) {
  'use strict';
  var UI = global.UI;

  /* 内联线性图标（与设计稿风格一致） */
  var I = {
    flower:
      '<circle cx="12" cy="12" r="2.3"/><path d="M12 9.7V5.6M12 14.3v4.1M9.7 12H5.6M14.3 12h4.1M10.4 10.4L7.5 7.5M13.6 13.6l2.9 2.9M13.6 10.4l2.9-2.9M10.4 13.6l-2.9 2.9"/>',
    chart:
      '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    folder:
      '<path d="M3 7.5A2 2 0 0 1 5 5.5h3.6l1.7 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
    chat: '<path d="M20 12a8 8 0 0 1-8 8H8l-4 3v-6.4A8 8 0 0 1 12 4a8 8 0 0 1 8 8z"/>',
    home: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    bell: '<path d="M18 16.5v-5a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    logout: '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/>',
    collapse: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="M15.5 10l-2.2 2 2.2 2"/>',
  };

  function svg(path, cls) {
    return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + path + '</svg>';
  }

  var MENU = [
    { group: '业务管理' },
    { href: 'index.html', text: '数据概览', icon: I.chart },
    { href: 'flowers.html', text: '商品管理', icon: I.flower },
    { href: 'categories.html', text: '分类管理', icon: I.folder },
    { href: 'orders.html', text: '订单管理', icon: I.box },
    { href: 'users.html', text: '用户管理', icon: I.user },
    { href: 'reviews.html', text: '评价管理', icon: I.chat },
  ];

  var COLLAPSE_KEY = 'hj_admin_side_collapsed';

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function pageTitle() {
    var t = (document.querySelector('title') || {}).textContent || '后台管理';
    return t.split('-')[0].trim();
  }

  function renderSide() {
    var side = document.getElementById('adminSide');
    if (!side) return;

    var menuHtml = MENU.map(function (item) {
      if (item.group) return '<div class="group-title">' + item.group + '</div>';
      var active = currentPage() === item.href ? ' class="active"' : '';
      return (
        '<a href="' + item.href + '"' + active + '>' + svg(item.icon) +
        '<span class="txt">' + item.text + '</span></a>'
      );
    }).join('');

    side.innerHTML =
      '<div class="admin-brand">' +
      '<span class="dot">' + svg(I.flower) + '</span>' +
      '<span class="txt">花间集后台管理<small>HUAJIANJI ADMIN</small></span>' +
      '</div>' +
      '<nav class="admin-menu">' + menuHtml + '</nav>' +
      '<div class="admin-side-foot">' +
      '<div class="ver">管理后台 v1.0.0 · 毕业设计</div>' +
      '<button class="admin-collapse" id="sideCollapse" type="button">' +
      svg(I.collapse) + '<span class="txt">收起侧边栏</span></button>' +
      '</div>';
  }

  function renderTop() {
    var top = document.getElementById('adminTop');
    if (!top) return;
    var user = global.Auth.getUser() || { nickname: '管理员' };
    var title = pageTitle();

    top.innerHTML =
      '<div class="crumb">' +
      '<a href="index.html">' + svg(I.home) + '</a>' +
      svg(I.chevronRight) +
      '<b>' + UI.escapeHtml(title) + '</b>' +
      '</div>' +
      '<div class="admin-search">' + svg(I.search) +
      '<input type="text" placeholder="搜索订单号 / 商品 / 用户" /></div>' +
      '<button class="admin-icon-btn" type="button" title="通知">' + svg(I.bell) +
      '<span class="dot"></span></button>' +
      '<div class="admin-user">' +
      '<button class="admin-user-btn" id="adminUserBtn" type="button">' +
      '<span class="avatar">' + UI.escapeHtml((user.nickname || 'A').slice(0, 1)) + '</span>' +
      '<span class="nm">' + UI.escapeHtml(user.nickname || '管理员') + '</span>' +
      svg(I.chevronDown) +
      '</button>' +
      '<div class="admin-user-menu" id="adminUserMenu">' +
      '<a href="../index.html">' + svg(I.home) + '返回商城首页</a>' +
      '<button type="button" id="adminLogout">' + svg(I.logout) + '退出登录</button>' +
      '</div>' +
      '</div>';

    var btn = document.getElementById('adminUserBtn');
    var menu = document.getElementById('adminUserMenu');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      menu.classList.remove('open');
    });
    document.getElementById('adminLogout').addEventListener('click', function () {
      global.Auth.clear();
      UI.toast('已退出后台');
      setTimeout(function () {
        location.href = '../login.html';
      }, 400);
    });
  }

  function renderFoot() {
    var foot = document.getElementById('adminFoot');
    if (!foot) return;
    var user = global.Auth.getUser() || {};
    var role = user.role === 'admin' ? '系统管理员' : '顾客';
    foot.innerHTML =
      '<div class="inner">' +
      '<span>© 2026 花间集鲜花商城 · 管理后台（毕业设计演示系统）</span>' +
      '<span class="admin-foot-user">当前登录：' + UI.escapeHtml(user.username || 'admin') +
      '（' + role + '）</span>' +
      '</div>';
  }

  function bindCollapse() {
    var layout = document.getElementById('adminLayout');
    var btn = document.getElementById('sideCollapse');
    if (!layout || !btn) return;
    if (localStorage.getItem(COLLAPSE_KEY) === '1') layout.classList.add('collapsed');
    btn.addEventListener('click', function () {
      var collapsed = layout.classList.toggle('collapsed');
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    });
  }

  function render() {
    renderSide();
    renderTop();
    renderFoot();
    bindCollapse();
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