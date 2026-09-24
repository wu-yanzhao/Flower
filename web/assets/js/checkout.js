/* =========================================================
   结算页：地址选择/新增、商品清单、金额汇总、提交订单
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;

  var mode = UI.qs('mode') === 'buyNow' ? 'buyNow' : 'cart';
  var buyNow = JSON.parse(sessionStorage.getItem('buyNow') || 'null');
  var cartIds = JSON.parse(sessionStorage.getItem('checkout') || 'null');
  var addresses = [];
  var selectedAddrId = 0;
  var goods = [];
  var total = 0;
  var discount = 0;

  function loadAddresses() {
    return window.API.get('/addresses').then(function (list) {
      addresses = list;
      var def = list.filter(function (a) { return a.is_default === 1; })[0] || list[0];
      selectedAddrId = def ? def.id : 0;
      renderAddresses();
    });
  }

  function renderAddresses() {
    var box = document.getElementById('addressList');
    if (!addresses.length) {
      box.innerHTML = '<div class="empty" style="padding:20px">还没有收货地址，请先新增</div>';
      return;
    }
    box.innerHTML = addresses
      .map(function (a) {
        return (
          '<div class="address-card' + (a.id === selectedAddrId ? ' active' : '') + '" data-id="' + a.id + '">' +
          '<div class="ops"><span data-edit="' + a.id + '">编辑</span><span data-del="' + a.id + '">删除</span></div>' +
          '<div class="name">' + UI.escapeHtml(a.receiver) + ' <span class="muted">' + UI.escapeHtml(a.phone) + '</span>' +
          (a.is_default ? ' <span class="badge badge-primary">默认</span>' : '') + '</div>' +
          '<div class="muted text-sm">' + UI.escapeHtml(a.region) + ' ' + UI.escapeHtml(a.detail) + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function loadGoods() {
    if (mode === 'buyNow' && buyNow) {
      goods = [
        {
          flower_id: buyNow.flowerId,
          name: buyNow.name,
          image: buyNow.image,
          price: buyNow.price,
          quantity: buyNow.quantity,
        },
      ];
      renderGoods();
      return Promise.resolve();
    }
    if (!cartIds || !cartIds.cartIds) {
      document.getElementById('goodsList').innerHTML = UI.empty('没有待结算的商品', '🛒');
      return Promise.resolve();
    }
    return window.API.get('/cart').then(function (data) {
      goods = data.list.filter(function (i) { return cartIds.cartIds.indexOf(i.id) >= 0; });
      renderGoods();
    });
  }

  function renderGoods() {
    var box = document.getElementById('goodsList');
    if (!goods.length) {
      box.innerHTML = UI.empty('没有待结算的商品', '🛒');
      return;
    }
    box.innerHTML = goods
      .map(function (g) {
        return (
          '<div class="goods-line">' +
          '<img src="' + (g.image || 'assets/images/ui/no-image.svg') + '" alt=""/>' +
          '<div style="flex:1"><div style="font-weight:600">' + UI.escapeHtml(g.name) + '</div>' +
          '<div class="muted text-sm">¥' + UI.money(g.price) + ' × ' + g.quantity + '</div></div>' +
          '<b class="price">¥' + UI.money(g.price * g.quantity) + '</b>' +
          '</div>'
        );
      })
      .join('');

    total = goods.reduce(function (s, g) { return s + g.price * g.quantity; }, 0);
    var count = goods.reduce(function (s, g) { return s + g.quantity; }, 0);
    discount = total >= 500 ? 50 : total >= 300 ? 20 : 0;
    document.getElementById('sumCount').textContent = count + ' 件';
    document.getElementById('sumTotal').textContent = '¥' + UI.money(total);
    document.getElementById('sumDiscount').textContent = '-¥' + UI.money(discount);
    document.getElementById('sumPay').textContent = '¥' + UI.money(total - discount);
  }

  function openAddressModal(addr) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-row">' +
      '<div class="form-item"><label class="form-label"><span class="req">*</span>收货人</label>' +
      '<input class="form-control" id="mReceiver" value="' + UI.escapeHtml(addr ? addr.receiver : '') + '" placeholder="请输入姓名"/></div>' +
      '<div class="form-item"><label class="form-label"><span class="req">*</span>联系电话</label>' +
      '<input class="form-control" id="mPhone" value="' + UI.escapeHtml(addr ? addr.phone : '') + '" placeholder="11 位手机号"/></div>' +
      '</div>' +
      '<div class="form-item"><label class="form-label"><span class="req">*</span>所在地区</label>' +
      '<input class="form-control" id="mRegion" value="' + UI.escapeHtml(addr ? addr.region : '') + '" placeholder="如：广东省 广州市 天河区"/></div>' +
      '<div class="form-item"><label class="form-label"><span class="req">*</span>详细地址</label>' +
      '<input class="form-control" id="mDetail" value="' + UI.escapeHtml(addr ? addr.detail : '') + '" placeholder="街道、门牌号、楼层"/></div>' +
      '<label class="text-sm"><input type="checkbox" id="mDefault" ' + (addr && addr.is_default ? 'checked' : '') + ' /> 设为默认地址</label>' +
      '<div class="form-error" id="mError"></div>';

    UI.modal(addr ? '编辑地址' : '新增收货地址', form, {
      okText: '保存',
      onOk: function (close) {
        var payload = {
          receiver: document.getElementById('mReceiver').value.trim(),
          phone: document.getElementById('mPhone').value.trim(),
          region: document.getElementById('mRegion').value.trim(),
          detail: document.getElementById('mDetail').value.trim(),
          is_default: document.getElementById('mDefault').checked ? 1 : 0,
        };
        if (!payload.receiver || !payload.phone || !payload.region || !payload.detail) {
          document.getElementById('mError').textContent = '请完整填写收货信息';
          return;
        }
        var req = addr ? window.API.put('/addresses/' + addr.id, payload) : window.API.post('/addresses', payload);
        req
          .then(function () {
            UI.toast('地址已保存', 'success');
            close();
            loadAddresses();
          })
          .catch(function (err) {
            document.getElementById('mError').textContent = UI.firstError(err);
          });
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;

    Promise.all([loadAddresses(), loadGoods()]).catch(function (err) {
      UI.toast(err.message, 'error');
    });

    document.getElementById('addressList').addEventListener('click', function (e) {
      if (e.target.closest('[data-edit]')) {
        var id = Number(e.target.closest('[data-edit]').getAttribute('data-edit'));
        var addr = addresses.filter(function (a) { return a.id === id; })[0];
        openAddressModal(addr);
        return;
      }
      if (e.target.closest('[data-del]')) {
        var delId = Number(e.target.closest('[data-del]').getAttribute('data-del'));
        UI.confirm('确定删除该地址吗？').then(function (ok) {
          if (ok) window.API.del('/addresses/' + delId).then(loadAddresses);
        });
        return;
      }
      var card = e.target.closest('[data-id]');
      if (card) {
        selectedAddrId = Number(card.getAttribute('data-id'));
        renderAddresses();
      }
    });

    document.getElementById('addAddrBtn').addEventListener('click', function () {
      openAddressModal(null);
    });

    document.getElementById('submitOrder').addEventListener('click', function () {
      if (!selectedAddrId) {
        UI.toast('请选择收货地址', 'error');
        return;
      }
      if (!goods.length) {
        UI.toast('没有待结算的商品', 'error');
        return;
      }
      var payload = {
        addressId: selectedAddrId,
        remark: document.getElementById('remarkInput').value.trim(),
      };
      if (mode === 'buyNow' && buyNow) {
        payload.buyNow = { flowerId: buyNow.flowerId, quantity: buyNow.quantity };
      } else {
        payload.cartIds = cartIds ? cartIds.cartIds : [];
      }
      var btn = this;
      btn.disabled = true;
      window.API.post('/orders', payload)
        .then(function (data) {
          sessionStorage.removeItem('buyNow');
          sessionStorage.removeItem('checkout');
          UI.toast('下单成功，请尽快完成支付', 'success');
          location.href = 'pay.html?orderNo=' + data.orderNo;
        })
        .catch(function (err) {
          btn.disabled = false;
          UI.toast(err.message, 'error');
        });
    });
  });
})();
