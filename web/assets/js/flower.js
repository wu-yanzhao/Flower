/* =========================================================
   商品详情页：信息渲染、数量选择、加购/立即购买、评价
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var flowerId = Number(UI.qs('id') || 0);
  var flower = null;
  var qty = 1;
  var reviewPage = 1;

  if (!flowerId) {
    document.body.innerHTML = '<div class="empty">参数错误：缺少商品 id<br/><a href="flowers.html">返回鲜花列表</a></div>';
    return;
  }

  function render(data) {
    flower = data;
    document.title = data.name + ' - 花间集鲜花商城';
    document.getElementById('crumb').textContent = data.name;
    document.getElementById('mainImg').src = data.image || 'assets/images/ui/no-image.svg';
    document.getElementById('fName').textContent = data.name;
    document.getElementById('fSubtitle').textContent = data.subtitle || '';
    document.getElementById('fPrice').textContent = '¥' + UI.money(data.price);
    document.getElementById('fOldPrice').textContent = data.original_price > data.price ? '¥' + UI.money(data.original_price) : '';
    var discount = data.original_price > data.price ? Math.round((1 - data.price / data.original_price) * 100) : 0;
    document.getElementById('fDiscount').textContent = discount ? discount + '% OFF' : '';
    document.getElementById('fRating').innerHTML = UI.stars(Math.round(data.reviewAvg || 5)) + ' <span class="muted">' + (data.reviewAvg || 5) + ' 分</span>';
    document.getElementById('fSales').textContent = data.sales || 0;
    document.getElementById('fStock').textContent = data.stock || 0;
    document.getElementById('fLanguage').textContent = data.flower_language || '—';
    document.getElementById('fMaterial').textContent = data.material || '—';
    document.getElementById('fPacking').textContent = data.packing || '—';
    document.getElementById('stockTip').textContent = data.stock > 0 ? '（每人限购 20 束）' : '暂时缺货';
    document.getElementById('reviewCount').textContent = data.reviewCount || 0;
    document.getElementById('favBtn').innerHTML = data.favorited ? '♥ 已收藏' : '♡ 收藏';

    document.getElementById('tabDesc').innerHTML =
      '<h3>商品介绍</h3><p>' + UI.escapeHtml(data.description || '') + '</p>' +
      '<h3>花材与包装</h3><p>主花材：' + UI.escapeHtml(data.material || '') + '<br/>包装方式：' + UI.escapeHtml(data.packing || '') + '</p>' +
      '<h3>配送说明</h3><p>支持全国大部分城市配送，同城最快 2 小时送达；下单时可在备注中指定送达时间段。</p>';

    var buyBtn = document.getElementById('buyNowBtn');
    var cartBtn = document.getElementById('addCartBtn');
    if (data.stock <= 0) {
      buyBtn.disabled = true;
      cartBtn.disabled = true;
      buyBtn.textContent = '暂时缺货';
    }
  }

  function loadReviews() {
    window.API.get('/flowers/' + flowerId + '/reviews', { page: reviewPage, pageSize: 5 })
      .then(function (data) {
        var box = document.getElementById('reviewList');
        box.innerHTML = data.list.length
          ? data.list
              .map(function (r) {
                return (
                  '<div class="review-item">' +
                  '<div class="who"><span class="avatar">' + UI.escapeHtml((r.nickname || '用').slice(0, 1)) + '</span>' +
                  '<b>' + UI.escapeHtml(r.nickname || '匿名用户') + '</b>' +
                  UI.stars(r.rating) +
                  '<span class="muted text-sm" style="margin-left:auto">' + UI.date(r.created_at, true) + '</span></div>' +
                  '<div>' + UI.escapeHtml(r.content) + '</div>' +
                  (r.reply ? '<div class="reply">商家回复：' + UI.escapeHtml(r.reply) + '</div>' : '') +
                  '</div>'
                );
              })
              .join('')
          : UI.empty('还没有评价，快来抢沙发～', '💬');
        UI.renderPagination(document.getElementById('reviewPages'), data.page, data.totalPages, function (p) {
          reviewPage = p;
          loadReviews();
        });
      })
      .catch(function () {});
  }

  function loadRelated() {
    window.API.get('/flowers', { categoryId: flower ? flower.category_id : '', pageSize: 4, sort: 'sales' })
      .then(function (data) {
        var list = data.list.filter(function (f) { return f.id !== flowerId; }).slice(0, 4);
        document.getElementById('relatedGrid').innerHTML =
          list.map(window.Components.flowerCard).join('') || UI.empty('暂无相关推荐');
      })
      .catch(function () {});
  }

  function bindEvents() {
    var input = document.getElementById('qtyInput');
    document.getElementById('qtyMinus').addEventListener('click', function () {
      qty = Math.max(1, qty - 1);
      input.value = qty;
    });
    document.getElementById('qtyPlus').addEventListener('click', function () {
      qty = Math.min(flower ? flower.stock : 20, qty + 1);
      input.value = qty;
    });
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10) || 1;
      qty = Math.max(1, Math.min(flower ? flower.stock : 20, v));
      input.value = qty;
    });

    document.getElementById('addCartBtn').addEventListener('click', function () {
      window.Components.addToCart(flowerId, qty);
    });

    document.getElementById('buyNowBtn').addEventListener('click', function () {
      if (!window.Auth.isLogin()) {
        UI.toast('请先登录', 'error');
        setTimeout(function () {
          location.href = 'login.html?redirect=' + encodeURIComponent('flower.html?id=' + flowerId);
        }, 600);
        return;
      }
      sessionStorage.setItem(
        'buyNow',
        JSON.stringify({ flowerId: flowerId, quantity: qty, name: flower.name, price: flower.price, image: flower.image })
      );
      location.href = 'checkout.html?mode=buyNow';
    });

    document.getElementById('favBtn').addEventListener('click', function () {
      window.Components.toggleFavorite(flowerId, this);
      setTimeout(function () {
        window.API.get('/flowers/' + flowerId).then(function (d) {
          document.getElementById('favBtn').innerHTML = d.favorited ? '♥ 已收藏' : '♡ 收藏';
        });
      }, 300);
    });

    document.getElementById('detailTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (!btn) return;
      UI.$$('#detailTabs button').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      var isReview = btn.getAttribute('data-tab') === 'review';
      document.getElementById('tabDesc').style.display = isReview ? 'none' : 'block';
      document.getElementById('tabReview').style.display = isReview ? 'block' : 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.API.get('/flowers/' + flowerId)
      .then(function (data) {
        render(data);
        loadReviews();
        loadRelated();
      })
      .catch(function (err) {
        document.querySelector('.detail-layout').innerHTML = UI.empty(err.message || '商品不存在');
      });
    bindEvents();
    window.Components.bindCards(document.body);
  });
})();
