/* =========================================================
   订单详情：物流时间轴、商品清单、收货信息、状态操作
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var orderId = UI.qs('id');

  function render(order) {
    document.getElementById('orderStatusTip').innerHTML =
      '订单号 ' + order.order_no + ' · 当前状态 ' + UI.statusBadge(order.status);

    // 时间轴
    document.getElementById('timeline').innerHTML = (order.timeline || [])
      .map(function (t) {
        return (
          '<div class="timeline-item' + (t.done ? ' done' : '') + '">' +
          '<b>' + t.label + (t.done ? ' ✓' : '') + '</b>' +
          '<span>' + (t.time ? UI.date(t.time, true) : '待处理') + ' · ' + UI.escapeHtml(t.desc || '') + '</span>' +
          '</div>'
        );
      })
      .join('');

    // 商品清单
    document.getElementById('goodsBody').innerHTML = (order.items || [])
      .map(function (it) {
        return (
          '<tr><td><div style="display:flex;gap:10px;align-items:center">' +
          '<img class="thumb" src="' + (it.flower_image || 'assets/images/ui/no-image.svg') + '" alt=""/>' +
          '<div><div>' + UI.escapeHtml(it.flower_name) + '</div>' +
          '<a class="muted text-sm" href="flower.html?id=' + it.flower_id + '">查看商品</a></div></div></td>' +
          '<td>¥' + UI.money(it.price) + '</td><td>×' + it.quantity + '</td>' +
          '<td><b class="price" style="font-size:15px">¥' + UI.money(it.subtotal) + '</b></td></tr>'
        );
      })
      .join('');

    document.getElementById('shippingInfo').innerHTML =
      '<div style="line-height:2">' +
      '<div><b>收货人：</b>' + UI.escapeHtml(order.receiver_name) + '　<b>联系电话：</b>' + UI.escapeHtml(order.receiver_phone) + '</div>' +
      '<div><b>收货地址：</b>' + UI.escapeHtml(order.receiver_address) + '</div>' +
      '<div><b>物流公司：</b>' + (order.express_company || '待发货') + '　<b>运单号：</b>' + (order.express_no || '—') + '</div>' +
      '<div><b>订单备注：</b>' + UI.escapeHtml(order.remark || '无') + '</div>' +
      '</div>';

    document.getElementById('orderMeta').innerHTML =
      '<div class="line"><span>商品总额</span><span>¥' + UI.money(order.total_amount) + '</span></div>' +
      '<div class="line"><span>优惠减免</span><span style="color:#e4577a">-¥' + UI.money(order.discount_amount) + '</span></div>' +
      '<div class="line"><span>支付方式</span><span>' + (order.pay_method || '未支付') + '</span></div>' +
      '<div class="line"><span>下单时间</span><span>' + UI.date(order.created_at, true) + '</span></div>' +
      '<div class="line total"><span>实付金额</span><b>¥' + UI.money(order.pay_amount) + '</b></div>';

    var actions = '';
    if (order.status === 'pending') {
      actions += '<a class="btn btn-primary btn-block" href="pay.html?orderNo=' + order.order_no + '">立即支付</a>' +
        '<button class="btn btn-ghost btn-block" id="cancelBtn" style="margin-top:8px">取消订单</button>';
    }
    if (order.status === 'shipped') {
      actions += '<button class="btn btn-primary btn-block" id="receiveBtn">确认收货</button>';
    }
    if (order.status === 'completed') {
      actions += '<button class="btn btn-outline btn-block" id="reviewBtn">评价晒单</button>';
    }
    document.getElementById('orderActions').innerHTML = actions;

    var cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        UI.confirm('确认取消该订单？库存将自动回滚。').then(function (ok) {
          if (!ok) return;
          window.API.post('/orders/' + order.id + '/cancel').then(function () {
            UI.toast('订单已取消', 'success');
            location.reload();
          });
        });
      });
    }
    var receiveBtn = document.getElementById('receiveBtn');
    if (receiveBtn) {
      receiveBtn.addEventListener('click', function () {
        UI.confirm('确认已收到鲜花？').then(function (ok) {
          if (!ok) return;
          window.API.post('/orders/' + order.id + '/receive').then(function () {
            UI.toast('已确认收货', 'success');
            location.reload();
          });
        });
      });
    }
    var reviewBtn = document.getElementById('reviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function () {
        location.href = 'orders.html?review=' + order.id;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;
    if (!orderId) {
      document.querySelector('.checkout-layout').innerHTML = UI.empty('缺少订单参数');
      return;
    }
    window.API.get('/orders/' + orderId)
      .then(render)
      .catch(function (err) {
        document.querySelector('.checkout-layout').innerHTML = UI.empty(err.message || '订单不存在');
      });
  });
})();
