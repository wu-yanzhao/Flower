/* =========================================================
   后台评价管理：查询、隐藏/展示、商家回复、删除
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var state = { keyword: '', status: '', page: 1, pageSize: 10 };

  function loadList() {
    window.API.get('/admin/reviews', {
      keyword: state.keyword,
      status: state.status,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        document.getElementById('tbody').innerHTML = data.list.length
          ? data.list
              .map(function (r) {
                return (
                  '<tr>' +
                  '<td>' + r.id + '</td>' +
                  '<td>' + UI.escapeHtml(r.nickname || '-') + '</td>' +
                  '<td>' + UI.escapeHtml(r.flower_name || '-') + '</td>' +
                  '<td><div>' + UI.escapeHtml(r.content) + '</div>' +
                  (r.reply ? '<div class="muted text-sm">商家回复：' + UI.escapeHtml(r.reply) + '</div>' : '') + '</td>' +
                  '<td>' + UI.stars(r.rating) + '</td>' +
                  '<td>' + (r.status === 'visible' ? '<span class="badge badge-success">已展示</span>' : '<span class="badge badge-danger">已隐藏</span>') + '</td>' +
                  '<td>' + UI.date(r.created_at) + '</td>' +
                  '<td><div class="row-actions">' +
                  '<button class="link-btn" data-reply="' + r.id + '">回复</button>' +
                  '<button class="link-btn gray" data-toggle="' + r.id + '" data-status="' + r.status + '">' +
                  (r.status === 'visible' ? '隐藏' : '展示') + '</button>' +
                  '<button class="link-btn danger" data-del="' + r.id + '">删除</button>' +
                  '</div></td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="8">' + UI.empty('暂无评价') + '</td></tr>';

        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          loadList();
        });
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function openReply(id, oldReply) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-item"><label class="form-label">商家回复内容</label>' +
      '<textarea class="form-control" id="rReply" placeholder="感谢您的支持，我们会继续努力！">' + UI.escapeHtml(oldReply || '') + '</textarea></div>' +
      '<div class="form-error" id="rError"></div>';
    UI.modal('回复评价', form, {
      okText: '提交回复',
      onOk: function (close) {
        window.API.put('/admin/reviews/' + id + '/reply', { reply: document.getElementById('rReply').value.trim() })
          .then(function () {
            UI.toast('回复成功', 'success');
            close();
            loadList();
          })
          .catch(function (err) {
            document.getElementById('rError').textContent = UI.firstError(err);
          });
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadList();

    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('kw').value.trim();
      state.status = document.getElementById('statusSel').value;
      state.page = 1;
      loadList();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      state = { keyword: '', status: '', page: 1, pageSize: 10 };
      document.getElementById('kw').value = '';
      document.getElementById('statusSel').value = '';
      loadList();
    });

    document.getElementById('tbody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-reply],[data-toggle],[data-del]');
      if (!t) return;
      if (t.hasAttribute('data-reply')) {
        var id = t.getAttribute('data-reply');
        window.API.get('/admin/reviews', { keyword: '', page: 1, pageSize: 50 }).then(function (data) {
          var cur = data.list.filter(function (r) { return String(r.id) === String(id); })[0];
          openReply(id, cur ? cur.reply : '');
        });
      } else if (t.hasAttribute('data-toggle')) {
        var tid = t.getAttribute('data-toggle');
        var next = t.getAttribute('data-status') === 'visible' ? 'hidden' : 'visible';
        window.API.put('/admin/reviews/' + tid + '/status', { status: next }).then(function () {
          UI.toast(next === 'hidden' ? '评价已隐藏' : '评价已展示', 'success');
          loadList();
        });
      } else if (t.hasAttribute('data-del')) {
        var did = t.getAttribute('data-del');
        UI.confirm('确认删除该评价？').then(function (ok) {
          if (!ok) return;
          window.API.del('/admin/reviews/' + did).then(function () {
            UI.toast('评价已删除', 'success');
            loadList();
          });
        });
      }
    });
  });
})();
