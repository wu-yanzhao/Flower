/* =========================================================
   可复用组件：商品卡片
   ========================================================= */
(function (global) {
  'use strict';
  var UI = global.UI;

  /** 商品卡片 HTML */
  function flowerCard(f, options) {
    options = options || {};
    var img = f.image || 'assets/images/ui/no-image.svg';
    var tagHtml = '';
    if (f.recommended) tagHtml += '<span class="tag-hot">推荐</span>';
    if (f.stock <= 10) tagHtml += '<span class="tag-hot" style="background:#e2564f">仅剩 ' + f.stock + '</span>';
    return (
      '<div class="flower-card" data-id="' + f.id + '">' +
      '<div class="pic">' +
      '<img src="' + img + '" alt="' + UI.escapeHtml(f.name) + '" loading="lazy" ' +
      'onerror="this.src=\'assets/images/ui/no-image.svg\'"/>' +
      '<div class="tags">' + tagHtml + '</div>' +
      '<button class="fav' + (f.favorited ? ' on' : '') + '" data-fav="' + f.id + '" title="收藏">' +
      (f.favorited ? '♥' : '♡') + '</button>' +
      '</div>' +
      '<div class="info">' +
      '<div class="name" data-detail="' + f.id + '">' + UI.escapeHtml(f.name) + '</div>' +
      '<div class="sub">' + UI.escapeHtml(f.subtitle || f.flower_language || '') + '</div>' +
      '<div class="meta"><span class="price">' + UI.money(f.price) + '</span>' +
      '<span class="sales">已售 ' + (f.sales || 0) + '</span></div>' +
      '<div class="add-cart"><button class="btn btn-outline btn-sm btn-block" data-add="' + f.id + '">加入购物车</button></div>' +
      '</div></div>'
    );
  }

  /** 卡片事件委托：收藏、加入购物车、查看详情 */
  function bindCards(root) {
    root = root || document.body;

    root.addEventListener('click', function (e) {
      var favBtn = e.target.closest('[data-fav]');
      var addBtn = e.target.closest('[data-add]');
      var detailEl = e.target.closest('[data-detail]');
      var card = e.target.closest('.flower-card');

      if (favBtn) {
        e.stopPropagation();
        toggleFavorite(Number(favBtn.getAttribute('data-fav')), favBtn);
        return;
      }
      if (addBtn) {
        e.stopPropagation();
        addToCart(Number(addBtn.getAttribute('data-add')));
        return;
      }
      if (detailEl) {
        location.href = 'flower.html?id=' + detailEl.getAttribute('data-detail');
        return;
      }
      if (card && card.getAttribute('data-id')) {
        location.href = 'flower.html?id=' + card.getAttribute('data-id');
      }
    });
  }

  function toggleFavorite(flowerId, btn) {
    if (!global.Auth.isLogin()) {
      UI.toast('请先登录后再收藏', 'error');
      setTimeout(function () {
        location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
      }, 600);
      return;
    }
    global.API.post('/favorites/toggle', { flowerId: flowerId })
      .then(function (data) {
        btn.classList.toggle('on', !!data.favorited);
        btn.textContent = data.favorited ? '♥' : '♡';
        UI.toast(data.favorited ? '已加入收藏' : '已取消收藏', 'success');
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function addToCart(flowerId, quantity, callback) {
    if (!global.Auth.isLogin()) {
      UI.toast('请先登录后再选购', 'error');
      setTimeout(function () {
        location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
      }, 600);
      return Promise.reject(new Error('未登录'));
    }
    return global.API.post('/cart', { flowerId: flowerId, quantity: quantity || 1 })
      .then(function () {
        UI.toast('已加入购物车 🛒', 'success');
        if (global.Layout) global.Layout.refreshCartCount();
        if (callback) callback();
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
        throw err;
      });
  }

  global.Components = { flowerCard: flowerCard, bindCards: bindCards, addToCart: addToCart, toggleFavorite: toggleFavorite };
})(window);
