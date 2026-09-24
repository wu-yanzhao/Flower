/* =========================================================
   后台分类管理：列表、新增、编辑、删除
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;

  function loadList() {
    window.API.get('/categories')
      .then(function (list) {
        document.getElementById('tbody').innerHTML = list.length
          ? list
              .map(function (c) {
                return (
                  '<tr>' +
                  '<td>' + c.id + '</td>' +
                  '<td><b>' + UI.escapeHtml(c.name) + '</b></td>' +
                  '<td>' + UI.escapeHtml(c.description || '-') + '</td>' +
                  '<td>' + (c.sort || 0) + '</td>' +
                  '<td><span class="badge badge-primary">' + (c.flower_count || 0) + ' 款</span></td>' +
                  '<td><div class="row-actions">' +
                  '<button class="link-btn" data-edit="' + c.id + '">编辑</button>' +
                  '<button class="link-btn danger" data-del="' + c.id + '">删除</button>' +
                  '</div></td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="6">' + UI.empty('暂无分类') + '</td></tr>';
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function openForm(cat) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-item"><label class="form-label">分类名称 *</label>' +
      '<input class="form-control" id="cName" value="' + UI.escapeHtml(cat ? cat.name : '') + '"/></div>' +
      '<div class="form-item"><label class="form-label">分类描述</label>' +
      '<input class="form-control" id="cDesc" value="' + UI.escapeHtml(cat ? cat.description : '') + '"/></div>' +
      '<div class="form-item"><label class="form-label">排序值（越小越靠前）</label>' +
      '<input class="form-control" id="cSort" type="number" value="' + (cat ? cat.sort || 0 : 0) + '"/></div>' +
      '<div class="form-error" id="cError"></div>';

    UI.modal(cat ? '编辑分类' : '新增分类', form, {
      okText: '保存',
      onOk: function (close) {
        var payload = {
          name: document.getElementById('cName').value.trim(),
          description: document.getElementById('cDesc').value.trim(),
          sort: Number(document.getElementById('cSort').value) || 0,
        };
        var req = cat ? window.API.put('/categories/' + cat.id, payload) : window.API.post('/categories', payload);
        req
          .then(function () {
            UI.toast('分类已保存', 'success');
            close();
            loadList();
          })
          .catch(function (err) {
            document.getElementById('cError').textContent = UI.firstError(err);
          });
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadList();

    document.getElementById('addBtn').addEventListener('click', function () {
      openForm(null);
    });

    document.getElementById('tbody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-edit],[data-del]');
      if (!t) return;
      if (t.hasAttribute('data-edit')) {
        var id = Number(t.getAttribute('data-edit'));
        window.API.get('/categories').then(function (list) {
          openForm(list.filter(function (c) { return c.id === id; })[0]);
        });
      } else if (t.hasAttribute('data-del')) {
        var delId = t.getAttribute('data-del');
        UI.confirm('删除分类前需确保该分类下没有商品。确认删除？').then(function (ok) {
          if (!ok) return;
          window.API.del('/categories/' + delId)
            .then(function () {
              UI.toast('分类已删除', 'success');
              loadList();
            })
            .catch(function (err) {
              UI.toast(err.message, 'error');
            });
        });
      }
    });
  });
})();
