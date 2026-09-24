/* =========================================================
   我的订单：状态筛选、搜索、支付 / 取消 / 确认收货 / 评价
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var state = { status: '', keyword: '', page: 1, pageSize: 8 };

  function orderCard(o) {
    var goodsHtml = (o.items || [])
      .slice(0, 3)
      .map(function (it) {
        return (
          '<div class="order-goods">' +
          '<img src="' + (it.flower_image || 'assets/images/ui/no-image.svg') + '" alt=""/>' +
          '<div style="flex:1"><div style="font-weight:600">' + UI.escapeHtml(it.flower_name) + '</div>' +
          '<div class="muted text-sm">¥' + UI.money(it.price) + ' × ' + it.quantity + '</div></div>' +
          '<b class="price" style="font-size:15px">¥' + UI.money(it.subtotal) + '</b>' +
          '</div>'
        );
      })
      .join('');

    var actions = '';
    if (o.status === 'pending') {
      actions += '<button class="btn btn-primary btn-sm" data-pay="' + o.id + '">立即支付</button>';
      actions += '<button class="btn btn-ghost btn-sm" data-cancel="' + o.id + '">取消订单</button>';
    }
    if (o.status === 'shipped') {
      actions += '<button class="btn btn-primary btn-sm" data-receive="' + o.id + '">确认收货</button>';
    }
    if (o.status === 'completed') {
      actions += '<button class="btn btn-outline btn-sm" data-review="' + o.id + '">评价晒单</button>';
    }
    if (o.status === 'canceled') {
      actions += '<button class="btn btn-ghost btn-sm" data-del="' + o.id + '">删除订单</button>';
    }
    actions += '<a class="btn btn-ghost btn-sm" href="order.html?id=' + o.id + '">订单详情</a>';

    return (
      '<div class="order-card">' +
      '<div class="order-head"><span class="no">订单号：' + o.order_no + '</span>' +
      '<span>下单时间：' + UI.date(o.created_at, true) + '</span>' +
      '<span>' + UI.statusBadge(o.status) + '</span></div>' +
      goodsHtml +
      '<div class="order-foot">' +
      '<div class="muted text-sm">' + UI.escapeHtml(o.receiver_name) + ' · ' + UI.escapeHtml(o.receiver_phone) +
      '<br/>' + UI.escapeHtml(o.receiver_address) + '</div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<span class="muted text-sm">共 ' + o.item_count + ' 件，实付</span>' +
      '<b class="price">¥' + UI.money(o.pay_amount) + '</b>' +
      '<span style="display:flex;gap:6px;flex-wrap:wrap">' + actions + '</span>' +
      '</div></div></div>'
    );
  }

  function load() {
    window.API.get('/orders', {
      status: state.status,
      keyword: state.keyword,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        var box = document.getElementById('orderList');
        box.innerHTML = data.list.length ? data.list.map(orderCard).join('') : UI.empty('暂无相关订单', '📦');
        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          load();
        });
      })
      .catch(function (err) {
        document.getElementById('orderList').innerHTML = UI.empty(err.message || '加载失败');
      });
  }

  function openReviewModal(orderId) {
    window.API.get('/orders/' + orderId).then(function (order) {
      var form = UI.el('div');
      form.innerHTML = (order.items || [])
        .map(function (it, idx) {
          return (
            '<div class="card" style="margin-bottom:12px;box-shadow:none">' +
            '<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">' +
            '<img src="' + (it.flower_image || 'assets/images/ui/no-image.svg') + '" style="width:46px;height:46px;border-radius:8px"/>' +
            '<b>' + UI.escapeHtml(it.flower_name) + '</b></div>' +
            '<div class="rate" data-flower="' + it.flower_id + '" data-idx="' + idx + '" style="margin-bottom:6px">' +
            [1, 2, 3, 4, 5].map(function (n) { return '<span data-star="' + n + '" style="font-size:22px;cursor:pointer;color:#e0d6d9">★</span>'; }).join('') +
            '</div>' +
            '<textarea class="form-control" data-content="' + idx + '" placeholder="说说这束花的体验吧～"></textarea>' +
            '</div>'
          );
        })
        .join('') + '<div class="form-error" id="rvError"></div>';

      UI.modal('订单评价', form, {
        size: 'modal-lg',
        okText: '提交评价',
        onOk: function (close) {
          var items = [];
          UI.$$('.rate', form).forEach(function (rateBox) {
            var idx = rateBox.getAttribute('data-idx');
            var star = UI.$('[data-star].on', rateBox);
            var content = UI.$('[data-content="' + idx + '"]', form).value.trim();
            items.push({
              flowerId: Number(rateBox.getAttribute('data-flower')),
              rating: star ? Number(star.getAttribute('data-star')) : 5,
              content: content || '默认好评，花很新鲜！',
            });
          });
          window.API.post('/reviews', { orderId: orderId, items: items })
            .then(function () {
              UI.toast('评价发布成功，感谢您的反馈！', 'success');
              close();
              load();
            })
            .catch(function (err) {
              document.getElementById('rvError').textContent = UI.firstError(err);
            });
        },
      });

      UI.$$('.rate [data-star]', form).forEach(function (star) {
        star.addEventListener('click', function () {
          var box = star.parentNode;
          var n = Number(star.getAttribute('data-star'));
          UI.$$('[data-star]', box).forEach(function (s) {
            var v = Number(s.getAttribute('data-star'));
            s.classList.toggle('on', v <= n);
            s.style.color = v <= n ? '#d9a441' : '#e0d6d9';
          });
        });
      });
      // 默认满分
      UI.$$('.rate', form).forEach(function (box) {
        UI.$$('[data-star]', box).forEach(function (s) {
          s.classList.add('on');
          s.style.color = '#d9a441';
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;
    load();

    document.getElementById('orderTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-status]');
      if (!btn) return;
      UI.$$('#orderTabs button').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      state.status = btn.getAttribute('data-status');
      state.page = 1;
      load();
    });

    var kw = document.getElementById('keyword');
    kw.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      state.keyword = kw.value.trim();
      state.page = 1;
      load();
    });

    document.getElementById('orderList').addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;

      if (t.hasAttribute('data-pay')) {
        var id = t.getAttribute('data-pay');
        UI.confirm('确认使用微信支付完成付款？').then(function (ok) {
          if (!ok) return;
          window.API.post('/orders/' + id + '/pay', { payMethod: '微信支付' })
            .then(function () {
              UI.toast('支付成功', 'success');
              load();
            })
            .catch(function (err) {
              UI.toast(err.message, 'error');
            });
        });
      } else if (t.hasAttribute('data-cancel')) {
        var cid = t.getAttribute('data-cancel');
        UI.confirm('取消后库存将回滚，确认取消该订单吗？').then(function (ok) {
          if (!ok) return;
          window.API.post('/orders/' + cid + '/cancel')
            .then(function () {
              UI.toast('订单已取消', 'success');
              load();
            })
            .catch(function (err) {
              UI.toast(err.message, 'error');
            });
        });
      } else if (t.hasAttribute('data-receive')) {
        var rid = t.getAttribute('data-receive');
        UI.confirm('确认已收到鲜花？确认后订单完成。').then(function (ok) {
          if (!ok) return;
          window.API.post('/orders/' + rid + '/receive')
            .then(function () {
              UI.toast('已确认收货', 'success');
              load();
            })
            .catch(function (err) {
              UI.toast(err.message, 'error');
            });
        });
      } else if (t.hasAttribute('data-review')) {
        openReviewModal(Number(t.getAttribute('data-review')));
      } else if (t.hasAttribute('data-del')) {
        var did = t.getAttribute('data-del');
        UI.confirm('删除后订单不可恢复，确认删除？').then(function (ok) {
          if (!ok) return;
          window.API.del('/orders/' + did).then(load);
        });
      }
    });
  });
})();
