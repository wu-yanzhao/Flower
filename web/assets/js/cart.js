/* =========================================================
   购物车：列表、勾选、数量调整、删除、结算
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var cart = { list: [], summary: {} };

  function render() {
    var box = document.getElementById('cartBox');
    if (!cart.list.length) {
      box.innerHTML =
        '<div class="empty"><div class="empty-icon">🛒</div>' +
        '<div>购物车还是空的，去挑一束喜欢的花吧</div>' +
        '<div style="margin-top:14px"><a class="btn btn-primary" href="flowers.html">去逛逛</a></div></div>';
      return;
    }

    var head =
      '<div class="cart-row cart-head">' +
      '<input type="checkbox" class="checkbox" id="checkAll" ' + (allChecked() ? 'checked' : '') + ' />' +
      '<div>商品图片</div><div>商品信息</div><div>单价</div><div>数量</div><div>操作</div></div>';

    var rows = cart.list
      .map(function (item) {
        var disabled = item.status !== 'on' || item.stock <= 0;
        return (
          '<div class="cart-row" data-id="' + item.id + '">' +
          '<input type="checkbox" class="checkbox" data-check="' + item.id + '" ' +
          (item.checked === 1 && !disabled ? 'checked' : '') + (disabled ? ' disabled' : '') + ' />' +
          '<img class="pic" src="' + (item.image || 'assets/images/ui/no-image.svg') + '" alt=""/>' +
          '<div><div class="nm">' + UI.escapeHtml(item.name) + '</div>' +
          '<div class="sb">' + UI.escapeHtml(item.subtitle || '') + '</div>' +
          (disabled ? '<div class="sb" style="color:#e2564f">该商品已下架或售罄</div>' : '') +
          '<div class="sb">小计：<b style="color:#e4577a">¥' + UI.money(item.price * item.quantity) + '</b></div></div>' +
          '<div class="price">¥' + UI.money(item.price) + '</div>' +
          '<div><div class="stepper">' +
          '<button data-minus="' + item.id + '">−</button>' +
          '<input value="' + item.quantity + '" data-qty="' + item.id + '" />' +
          '<button data-plus="' + item.id + '">+</button></div>' +
          '<div class="sb" style="margin-top:4px">库存 ' + item.stock + '</div></div>' +
          '<div><button class="link-btn danger" data-del="' + item.id + '">删除</button></div>' +
          '</div>'
        );
      })
      .join('');

    var s = cart.summary || {};
    var bottom =
      '<div class="cart-bottom">' +
      '<div><label class="text-sm"><input type="checkbox" class="checkbox" id="checkAll2" ' +
      (allChecked() ? 'checked' : '') + ' /> 全选</label>' +
      '<span class="muted text-sm" style="margin-left:14px">已选 ' + (s.count || 0) + ' 件</span></div>' +
      '<div class="cart-total">' +
      '<span class="line">商品总额：¥' + UI.money(s.totalAmount) + '</span>' +
      '<span class="line">优惠：-¥' + UI.money(s.discount) + '</span>' +
      '<span class="line">应付：<b>¥' + UI.money(s.payAmount) + '</b></span>' +
      '<button class="btn btn-primary btn-lg" id="checkoutBtn" ' + ((s.count || 0) ? '' : 'disabled') + '>去结算</button>' +
      '</div></div>';

    box.innerHTML = head + rows + bottom;
  }

  function allChecked() {
    var valid = cart.list.filter(function (i) { return i.status === 'on' && i.stock > 0; });
    return valid.length > 0 && valid.every(function (i) { return i.checked === 1; });
  }

  function load() {
    window.API.get('/cart')
      .then(function (data) {
        cart = data;
        render();
      })
      .catch(function (err) {
        document.getElementById('cartBox').innerHTML = UI.empty(err.message || '加载失败');
      });
  }

  function updateQty(id, quantity) {
    window.API.put('/cart/' + id, { quantity: quantity })
      .then(function () {
        load();
        window.Layout.refreshCartCount();
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
        load();
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;
    load();

    document.getElementById('cartBox').addEventListener('click', function (e) {
      var t = e.target;

      if (t.id === 'checkAll' || t.id === 'checkAll2') {
        window.API.put('/cart/check-all', { checked: t.checked }).then(load);
        return;
      }
      var minus = t.closest('[data-minus]');
      if (minus) {
        var item = findItem(Number(minus.getAttribute('data-minus')));
        if (item) updateQty(item.id, Math.max(0, item.quantity - 1));
        return;
      }
      var plus = t.closest('[data-plus]');
      if (plus) {
        var item2 = findItem(Number(plus.getAttribute('data-plus')));
        if (item2) updateQty(item2.id, item2.quantity + 1);
        return;
      }
      var del = t.closest('[data-del]');
      if (del) {
        var id = Number(del.getAttribute('data-del'));
        UI.confirm('确定要从购物车移出这件商品吗？').then(function (ok) {
          if (!ok) return;
          window.API.del('/cart/' + id).then(function () {
            load();
            window.Layout.refreshCartCount();
          });
        });
        return;
      }
      if (t.id === 'checkoutBtn') {
        var ids = cart.list.filter(function (i) { return i.checked === 1 && i.status === 'on'; }).map(function (i) { return i.id; });
        if (!ids.length) {
          UI.toast('请先勾选要结算的商品', 'error');
          return;
        }
        sessionStorage.setItem('checkout', JSON.stringify({ mode: 'cart', cartIds: ids }));
        location.href = 'checkout.html';
      }
    });

    document.getElementById('cartBox').addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('data-check')) {
        window.API.put('/cart/' + t.getAttribute('data-check') + '/check', { checked: t.checked }).then(load);
      }
      if (t.hasAttribute && t.hasAttribute('data-qty')) {
        var v = parseInt(t.value, 10) || 1;
        updateQty(Number(t.getAttribute('data-qty')), v);
      }
    });

    document.getElementById('clearCart').addEventListener('click', function () {
      UI.confirm('确定清空购物车吗？该操作不可恢复。').then(function (ok) {
        if (!ok) return;
        window.API.del('/cart').then(function () {
          load();
          window.Layout.refreshCartCount();
        });
      });
    });
  });

  function findItem(id) {
    return cart.list.filter(function (i) { return i.id === id; })[0];
  }
})();
