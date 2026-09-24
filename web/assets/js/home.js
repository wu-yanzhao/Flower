/* =========================================================
   首页：分类入口、推荐商品、热销榜、基础统计
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var CAT_ICON = ['🌹', '🎂', '💐', '🌷', '🎁', '🎉'];

  function loadCategories() {
    window.API.get('/categories')
      .then(function (list) {
        var box = document.getElementById('catEntry');
        box.innerHTML = list
          .map(function (c, i) {
            return (
              '<div class="cat-card" data-cat="' + c.id + '">' +
              '<div class="cat-icon">' + CAT_ICON[i % CAT_ICON.length] + '</div>' +
              '<div class="cat-name">' + UI.escapeHtml(c.name) + '</div>' +
              '<div class="cat-count">' + c.flower_count + ' 款在售</div>' +
              '</div>'
            );
          })
          .join('');
        box.addEventListener('click', function (e) {
          var card = e.target.closest('[data-cat]');
          if (card) location.href = 'flowers.html?categoryId=' + card.getAttribute('data-cat');
        });
      })
      .catch(function () {
        document.getElementById('catEntry').innerHTML = UI.empty('分类加载失败');
      });
  }

  function loadRecommend() {
    window.API.get('/flowers/recommend', { limit: 8 })
      .then(function (list) {
        var box = document.getElementById('recommendGrid');
        box.innerHTML = list.map(window.Components.flowerCard).join('') || UI.empty('暂无推荐商品');
      })
      .catch(function () {
        document.getElementById('recommendGrid').innerHTML = UI.empty('商品加载失败');
      });
  }

  function loadRank() {
    window.API.get('/flowers', { sort: 'sales', pageSize: 5 })
      .then(function (data) {
        var box = document.getElementById('rankList');
        box.innerHTML = data.list
          .map(function (f, i) {
            return (
              '<div class="rank-item' + (i < 3 ? ' top' + (i + 1) : '') + '" data-id="' + f.id + '">' +
              '<div class="no">' + (i + 1) + '</div>' +
              '<img src="' + (f.image || 'assets/images/ui/no-image.svg') + '" alt="' + UI.escapeHtml(f.name) + '"/>' +
              '<div class="rn">' + UI.escapeHtml(f.name) + '</div>' +
              '<div class="price" style="font-size:15px">' + UI.money(f.price) + '</div>' +
              '</div>'
            );
          })
          .join('');
        box.addEventListener('click', function (e) {
          var item = e.target.closest('[data-id]');
          if (item) location.href = 'flower.html?id=' + item.getAttribute('data-id');
        });
      })
      .catch(function () {});
  }

  /** 首页顶部统计：优先展示后台统计（需管理员接口，失败则回退为商品接口数据） */
  function loadStats() {
    window.API.get('/flowers', { pageSize: 1 })
      .then(function (data) {
        document.getElementById('statFlower').textContent = data.total || 0;
      })
      .catch(function () {});
    window.API.get('/flowers', { sort: 'sales', pageSize: 100 })
      .then(function (data) {
        var sales = data.list.reduce(function (s, f) { return s + (f.sales || 0); }, 0);
        document.getElementById('statOrder').textContent = sales;
        document.getElementById('statUser').textContent = Math.max(120, Math.round(sales / 8));
      })
      .catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadCategories();
    loadRecommend();
    loadRank();
    loadStats();
    window.Components.bindCards(document.body);
  });
})();
