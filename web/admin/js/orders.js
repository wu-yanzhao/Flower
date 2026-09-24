/* =========================================================
   后台订单管理：筛选、详情、发货、状态流转、取消
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var state = { keyword: '', status: '', startDate: '', endDate: '', page: 1, pageSize: 10 };

  function loadStats() {
    window.API.get('/admin/stats/status')
      .then(function (list) {
        var map = {};
        list.forEach(function (i) {
          map[i.status] = i.count;
        });
        var items = [
          { key: 'pending', label: '待付款', cls: '' },
          { key: 'paid', label: '待发货', cls: 'c3' },
          { key: 'shipped', label: '待收货', cls: 'c4' },
          { key: 'completed', label: '已完成', cls: 'c2' },
          { key: 'canceled', label: '已取消', cls: 'c3' },
        ];
        document.getElementById('orderStats').innerHTML = items
          .map(function (i) {
            return (
              '<div class="stat-card ' + i.cls + '" style="padding:14px"><div class="ico">' +
              (i.key === 'completed' ? '✅' : i.key === 'canceled' ? '✖️' : '⏳') + '</div>' +
              '<div><div class="num">' + (map[i.key] || 0) + '</div><div class="lbl">' + i.label + '</div></div></div>'
            );
          })
          .join('');
      })
      .catch(function () {});
  }

  function loadList() {
    window.API.get('/admin/orders', {
      keyword: state.keyword,
      status: state.status,
      startDate: state.startDate,
      endDate: state.endDate,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        document.getElementById('tbody').innerHTML = data.list.length
          ? data.list
              .map(function (o) {
                return (
                  '<tr>' +
                  '<td><b>' + o.order_no + '</b><div class="muted text-sm">' + o.item_count + ' 件商品</div></td>' +
                  '<td>' + UI.escapeHtml(o.nickname || o.username || '') + '</td>' +
                  '<td>' + UI.escapeHtml(o.receiver_name) + ' ' + UI.escapeHtml(o.receiver_phone) +
                  '<div class="muted text-sm">' + UI.escapeHtml(o.receiver_address) + '</div></td>' +
                  '<td class="price" style="font-size:14px">¥' + UI.money(o.pay_amount) + '</td>' +
                  '<td>' + UI.statusBadge(o.status) + '</td>' +
                  '<td>' + UI.date(o.created_at, true) + '</td>' +
                  '<td><div class="row-actions">' +
                  '<button class="link-btn" data-detail="' + o.id + '">详情</button>' +
                  (o.status === 'paid' ? '<button class="link-btn" data-ship="' + o.id + '">发货</button>' : '') +
                  (o.status === 'pending' || o.status === 'paid' || o.status === 'shipped'
                    ? '<button class="link-btn danger" data-cancel="' + o.id + '">取消</button>'
                    : '') +
                  (o.status !== 'completed' && o.status !== 'canceled'
                    ? '<button class="link-btn gray" data-next="' + o.id + '" data-status="' + o.status + '">推进状态</button>'
                    : '') +
                  '</div></td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="7">' + UI.empty('没有找到订单') + '</td></tr>';

        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          loadList();
        });
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function openDetail(id) {
    window.API.get('/admin/orders/' + id).then(function (o) {
      var box = UI.el('div');
      box.innerHTML =
        '<div class="alert" style="margin-bottom:12px">订单号：' + o.order_no + '　状态：' + UI.statusBadge(o.status) +
        '　客户：' + UI.escapeHtml((o.user && o.user.nickname) || '') + '</div>' +
        '<table class="table"><thead><tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>' +
        (o.items || [])
          .map(function (it) {
            return (
              '<tr><td>' + UI.escapeHtml(it.flower_name) + '</td><td>¥' + UI.money(it.price) + '</td>' +
              '<td>×' + it.quantity + '</td><td>¥' + UI.money(it.subtotal) + '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>' +
        '<div style="margin-top:14px;line-height:2">' +
        '<div><b>收货人：</b>' + UI.escapeHtml(o.receiver_name) + '　<b>电话：</b>' + UI.escapeHtml(o.receiver_phone) + '</div>' +
        '<div><b>地址：</b>' + UI.escapeHtml(o.receiver_address) + '</div>' +
        '<div><b>物流：</b>' + (o.express_company || '—') + ' ' + (o.express_no || '') + '</div>' +
        '<div><b>金额：</b>商品 ¥' + UI.money(o.total_amount) + '，优惠 -¥' + UI.money(o.discount_amount) +
        '，实付 <b style="color:#e4577a">¥' + UI.money(o.pay_amount) + '</b></div>' +
        '</div>' +
        '<h4 style="margin:14px 0 8px;font-size:14px">订单跟踪</h4>' +
        (o.timeline || [])
          .map(function (t) {
            return '<div class="log-line">' + t.label + '：' + (t.time || '待处理') + ' · ' + UI.escapeHtml(t.desc || '') + '</div>';
          })
          .join('');

      UI.modal('订单详情', box, { size: 'modal-lg', footer: false });
    });
  }

  function openShip(id) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-item"><label class="form-label">物流公司</label>' +
      '<select class="form-control" id="sCompany"><option>顺丰速运</option><option>京东物流</option>' +
      '<option>中通快递</option><option>圆通速递</option><option>花艺同城专送</option></select></div>' +
      '<div class="form-item"><label class="form-label">物流单号</label>' +
      '<input class="form-control" id="sNo" placeholder="请输入运单号"/></div>' +
      '<div class="form-error" id="sError"></div>';
    UI.modal('订单发货', form, {
      okText: '确认发货',
      onOk: function (close) {
        window.API.post('/admin/orders/' + id + '/ship', {
          expressCompany: document.getElementById('sCompany').value,
          expressNo: document.getElementById('sNo').value.trim(),
        })
          .then(function () {
            UI.toast('发货成功', 'success');
            close();
            loadList();
            loadStats();
          })
          .catch(function (err) {
            document.getElementById('sError').textContent = UI.firstError(err);
          });
      },
    });
  }

  var NEXT_STATUS = { pending: 'paid', paid: 'shipped', shipped: 'completed' };

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadStats();
    loadList();

    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('kw').value.trim();
      state.status = document.getElementById('statusSel').value;
      state.startDate = document.getElementById('startDate').value;
      state.endDate = document.getElementById('endDate').value;
      state.page = 1;
      loadList();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      state = { keyword: '', status: '', startDate: '', endDate: '', page: 1, pageSize: 10 };
      document.getElementById('kw').value = '';
      document.getElementById('statusSel').value = '';
      document.getElementById('startDate').value = '';
      document.getElementById('endDate').value = '';
      loadList();
    });

    document.getElementById('tbody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-detail],[data-ship],[data-cancel],[data-next]');
      if (!t) return;

      if (t.hasAttribute('data-detail')) {
        openDetail(t.getAttribute('data-detail'));
      } else if (t.hasAttribute('data-ship')) {
        openShip(t.getAttribute('data-ship'));
      } else if (t.hasAttribute('data-cancel')) {
        var cid = t.getAttribute('data-cancel');
        UI.confirm('确认取消该订单？库存将自动回滚。').then(function (ok) {
          if (!ok) return;
          window.API.put('/admin/orders/' + cid + '/status', { status: 'canceled' }).then(function () {
            UI.toast('订单已取消', 'success');
            loadList();
            loadStats();
          });
        });
      } else if (t.hasAttribute('data-next')) {
        var nid = t.getAttribute('data-next');
        var cur = t.getAttribute('data-status');
        var next = NEXT_STATUS[cur] || 'completed';
        UI.confirm('将订单状态推进为「' + UI.statusText(next) + '」？').then(function (ok) {
          if (!ok) return;
          window.API.put('/admin/orders/' + nid + '/status', { status: next }).then(function () {
            UI.toast('状态已更新', 'success');
            loadList();
            loadStats();
          });
        });
      }
    });
  });
})();
