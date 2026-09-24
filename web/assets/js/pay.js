/* =========================================================
   支付页（模拟支付）：金额展示、支付方式选择、倒计时、确认支付
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var orderNo = UI.qs('orderNo');
  var order = null;
  var method = '微信支付';

  function startCountdown() {
    var left = 30 * 60;
    var timer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        document.getElementById('countdown').textContent = '00:00（已超时）';
        return;
      }
      var m = String(Math.floor(left / 60)).padStart(2, '0');
      var s = String(left % 60).padStart(2, '0');
      document.getElementById('countdown').textContent = m + ':' + s;
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;
    if (!orderNo) {
      document.querySelector('.pay-box').innerHTML = UI.empty('缺少订单号');
      return;
    }

    window.API.get('/orders/' + orderNo)
      .then(function (data) {
        order = data;
        document.getElementById('payOrderNo').textContent = data.order_no;
        document.getElementById('payAmount').textContent = '¥' + UI.money(data.pay_amount);
        if (data.status !== 'pending') {
          document.getElementById('confirmPay').disabled = true;
          document.getElementById('confirmPay').textContent = '该订单无需支付';
        }
        startCountdown();
      })
      .catch(function (err) {
        document.querySelector('.pay-box').innerHTML = UI.empty(err.message || '订单不存在');
      });

    document.getElementById('payMethods').addEventListener('click', function (e) {
      var item = e.target.closest('[data-method]');
      if (!item) return;
      UI.$$('#payMethods .pay-method').forEach(function (m) {
        m.classList.remove('active');
      });
      item.classList.add('active');
      method = item.getAttribute('data-method');
    });

    document.getElementById('confirmPay').addEventListener('click', function () {
      if (!order) return;
      var btn = this;
      btn.disabled = true;
      btn.textContent = '支付处理中…';
      window.API.post('/orders/' + order.id + '/pay', { payMethod: method })
        .then(function () {
          UI.toast('支付成功！商家将尽快发货', 'success');
          setTimeout(function () {
            location.href = 'order.html?id=' + order.id;
          }, 800);
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = '确认支付';
          UI.toast(err.message, 'error');
        });
    });
  });
})();
