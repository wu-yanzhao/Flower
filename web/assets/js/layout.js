/* =========================================================
   站点公共布局：顶部导航、搜索、用户菜单、页脚、登录守卫
   ========================================================= */
(function (global) {
  'use strict';
  var UI = global.UI;
  var LOGO_SVG =
    '<svg viewBox="0 0 40 40" width="34" height="34">' +
    '<defs><radialGradient id="lg" cx="50%" cy="40%" r="60%">' +
    '<stop offset="0%" stop-color="#FFD3DE"/><stop offset="100%" stop-color="#E4577A"/></radialGradient></defs>' +
    '<circle cx="20" cy="20" r="19" fill="url(#lg)"/>' +
    '<g fill="#fff">' +
    '<ellipse cx="20" cy="11" rx="5" ry="7"/><ellipse cx="29" cy="20" rx="7" ry="5"/>' +
    '<ellipse cx="20" cy="29" rx="5" ry="7"/><ellipse cx="11" cy="20" rx="7" ry="5"/>' +
    '</g><circle cx="20" cy="20" r="4.5" fill="#FFE9A8"/></svg>';

  var NAV = [
    { href: 'index.html', text: '首页' },
    { href: 'flowers.html', text: '全部鲜花' },
    { href: 'orders.html', text: '我的订单' },
    { href: 'user.html', text: '个人中心' },
  ];

  function currentPage() {
    var path = location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function renderHeader() {
    var host = document.getElementById('siteHeader');
    if (!host) return;
    var page = currentPage();
    var user = global.Auth.getUser();

    var navHtml = NAV.map(function (item) {
      var active = page === item.href ? ' active' : '';
      return '<a class="' + active.trim() + '" href="' + item.href + '">' + item.text + '</a>';
    }).join('');

    var actionHtml = '';
    if (user) {
      actionHtml =
        '<div class="user-menu" id="userMenu">' +
        '<button class="user-trigger" id="userTrigger">' +
        '<span class="avatar">' + UI.escapeHtml((user.nickname || user.username || 'U').slice(0, 1)) + '</span>' +
        '<span>' + UI.escapeHtml(user.nickname || user.username) + '</span>' +
        '</button>' +
        '<div class="dropdown" id="userDropdown" style="display:none">' +
        '<a href="user.html">个人中心</a>' +
        '<a href="orders.html">我的订单</a>' +
        '<a href="user.html?tab=favorites">我的收藏</a>' +
        (user.role === 'admin' ? '<a href="admin/index.html">后台管理</a>' : '') +
        '<div class="divider"></div>' +
        '<button id="logoutBtn">退出登录</button>' +
        '</div></div>';
    } else {
      actionHtml =
        '<a class="btn btn-ghost btn-sm" href="login.html">登录</a>' +
        '<a class="btn btn-primary btn-sm" href="register.html">注册</a>';
    }

    host.innerHTML =
      '<div class="topbar"><div class="container">' +
      '<span>🌸 欢迎来到花间集鲜花商城 · 当日现采 · 同城最快 2 小时送达</span>' +
      '<span><a href="flowers.html">全部鲜花</a><a href="orders.html">我的订单</a>' +
      '<a href="admin/index.html">管理入口</a></span>' +
      '</div></div>' +
      '<div class="header"><div class="container">' +
      '<a class="logo" href="index.html">' + LOGO_SVG +
      '<span>花间集<small>FLOWER SHOP</small></span></a>' +
      '<nav class="nav">' + navHtml + '</nav>' +
      '<div class="header-search"><input id="globalSearch" placeholder="搜索鲜花 / 花语，如：玫瑰" />' +
      '<button class="search-btn" id="searchBtn">🔍</button></div>' +
      '<div class="header-actions">' +
      '<a class="cart-link" href="cart.html">🛒 购物车<span class="count" id="cartCount">0</span></a>' +
      actionHtml +
      '</div></div></div>';

    bindHeaderEvents();
  }

  function bindHeaderEvents() {
    var trigger = document.getElementById('userTrigger');
    var dropdown = document.getElementById('userDropdown');
    if (trigger && dropdown) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', function () {
        dropdown.style.display = 'none';
      });
      var logout = document.getElementById('logoutBtn');
      if (logout) {
        logout.addEventListener('click', function () {
          global.Auth.clear();
          UI.toast('已退出登录');
          setTimeout(function () {
            location.href = 'index.html';
          }, 400);
        });
      }
    }

    function doSearch() {
      var input = document.getElementById('globalSearch');
      var keyword = (input.value || '').trim();
      location.href = 'flowers.html' + (keyword ? '?keyword=' + encodeURIComponent(keyword) : '');
    }
    var btn = document.getElementById('searchBtn');
    var input = document.getElementById('globalSearch');
    if (btn) btn.addEventListener('click', doSearch);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSearch();
      });
    }
  }

  function renderFooter() {
    var host = document.getElementById('siteFooter');
    if (!host) return;
    host.innerHTML =
      '<div class="container">' +
      '<div class="footer-cols">' +
      '<div class="footer-brand"><h4>' + LOGO_SVG + ' 花间集鲜花商城</h4>' +
      '<p>成立于 2020 年，专注鲜花礼品一站式服务，全国 268 个城市可配送。<br/>每一束花都由花艺师手工制作，承诺“不新鲜，无条件重做”。</p></div>' +
      '<div><h4>购物指南</h4><ul><li>注册与登录</li><li>选购与下单</li><li>支付方式</li><li>配送说明</li></ul></div>' +
      '<div><h4>售后服务</h4><ul><li>退换货政策</li><li>鲜花养护指南</li><li>配送异常处理</li><li>意见反馈</li></ul></div>' +
      '<div><h4>联系我们</h4><ul><li>客服电话：400-888-8866</li><li>服务时间：09:00 - 21:00</li>' +
      '<li>邮箱：service@flower.com</li><li>地址：广州市天河区花城大道 88 号</li></ul></div>' +
      '</div>' +
      '<div class="footer-bottom">© 2026 花间集鲜花商城 · 毕业设计演示项目（广东交通职业技术学院 软件技术专业）· 仅供学习交流使用</div>' +
      '</div>';
  }

  /** 刷新右上角购物车数量 */
  function refreshCartCount() {
    var node = document.getElementById('cartCount');
    if (!node) return;
    if (!global.Auth.isLogin()) {
      node.textContent = '0';
      return;
    }
    global.API.get('/cart/count')
      .then(function (data) {
        node.textContent = data.count || 0;
      })
      .catch(function () {
        node.textContent = '0';
      });
  }

  /** 页面级登录守卫：未登录跳转到登录页并记录来源 */
  function requireLogin() {
    if (!global.Auth.isLogin()) {
      UI.toast('请先登录后再操作', 'error');
      setTimeout(function () {
        location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
      }, 600);
      return false;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHeader();
    renderFooter();
    refreshCartCount();
  });

  global.Layout = {
    renderHeader: renderHeader,
    renderFooter: renderFooter,
    refreshCartCount: refreshCartCount,
    requireLogin: requireLogin,
    LOGO_SVG: LOGO_SVG,
  };
})(window);
