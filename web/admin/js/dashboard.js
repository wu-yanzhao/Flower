/* =========================================================
   后台首页：经营指标 + 销售趋势 + 分类占比 + 热销榜 + 日志
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;

  function loadOverview() {
    window.API.get('/admin/stats/overview')
      .then(function (d) {
        document.getElementById('kpiSales').textContent = UI.money(d.sales);
        document.getElementById('kpiOrders').textContent = d.orderCount;
        document.getElementById('kpiShip').textContent = d.pendingCount + ' / ' + d.shippedCount;
        document.getElementById('kpiUsers').textContent = d.userCount;
        document.getElementById('todayTip').innerHTML =
          '今日新增销售额 <b>¥' + UI.money(d.todaySales) + '</b>，今日订单 <b>' + d.todayOrders + '</b> 笔，' +
          '客单价 <b>¥' + UI.money(d.avgOrder) + '</b>，在售商品 <b>' + d.flowerCount + '</b> 款，' +
          '评价 <b>' + d.reviewCount + '</b> 条，库存预警（≤10）<b style="color:#e2564f">' + d.lowStock + '</b> 款。';
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function loadTrend(days) {
    window.API.get('/admin/stats/trend', { days: days })
      .then(function (list) {
        document.getElementById('trendChart').innerHTML = window.Chart.line({
          data: list.map(function (d) {
            return { label: String(d.date).slice(5), value: d.sales };
          }),
          height: 250,
        });
      })
      .catch(function () {});
  }

  function loadCategory() {
    window.API.get('/admin/stats/category')
      .then(function (list) {
        var pie = window.Chart.pie({
          data: list.map(function (d) {
            return { name: d.name, value: d.quantity };
          }),
          centerLabel: '销量',
        });
        document.getElementById('categoryChart').innerHTML = pie.svg + pie.legend;
      })
      .catch(function () {});
  }

  function loadTop() {
    window.API.get('/admin/stats/top', { limit: 5 })
      .then(function (list) {
        document.getElementById('topChart').innerHTML = window.Chart.bar({
          data: list.map(function (d) {
            return { label: d.name, value: d.quantity };
          }),
        });
      })
      .catch(function () {});
  }

  function loadStatus() {
    window.API.get('/admin/stats/status')
      .then(function (list) {
        document.getElementById('statusChart').innerHTML = window.Chart.bar({
          data: list.map(function (d) {
            return { label: UI.statusText(d.status), value: d.count };
          }),
          labelWidth: 90,
        });
      })
      .catch(function () {});
  }

  function loadLatest() {
    window.API.get('/admin/stats/recent', { limit: 6 })
      .then(function (list) {
        document.getElementById('latestOrders').innerHTML = list.length
          ? list
              .map(function (o) {
                return (
                  '<div class="mini-item"><span class="badge ' + (UI.STATUS[o.status] || {}).cls + '">' +
                  UI.statusText(o.status) + '</span>' +
                  '<div class="ml"><b>' + o.order_no + '</b>' +
                  '<span class="muted">' + UI.escapeHtml(o.nickname || '') + ' · ' + UI.date(o.created_at, true) + '</span></div>' +
                  '<b class="price" style="font-size:15px">¥' + UI.money(o.pay_amount) + '</b></div>'
                );
              })
              .join('')
          : UI.empty('暂无订单');
      })
      .catch(function () {});
  }

  function loadLogs() {
    window.API.get('/admin/logs', { limit: 6 })
      .then(function (list) {
        document.getElementById('logList').innerHTML = list.length
          ? list
              .map(function (l) {
                return '<div class="log-line">【' + UI.escapeHtml(l.module) + '】' + UI.escapeHtml(l.admin_name) +
                  ' ' + UI.escapeHtml(l.action) + ' · <span class="muted">' + UI.date(l.created_at, true) + '</span></div>';
              })
              .join('')
          : UI.empty('暂无操作日志');
      })
      .catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadOverview();
    loadTrend(7);
    loadCategory();
    loadTop();
    loadStatus();
    loadLatest();
    loadLogs();

    document.getElementById('trendDays').addEventListener('change', function () {
      loadTrend(this.value);
    });
  });
})();
