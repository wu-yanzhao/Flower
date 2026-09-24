/* =========================================================
   后台用户管理：查询、新增、禁用/启用、重置密码
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var state = { keyword: '', role: '', status: '', page: 1, pageSize: 10 };

  function loadList() {
    window.API.get('/admin/users', {
      keyword: state.keyword,
      role: state.role,
      status: state.status,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        document.getElementById('tbody').innerHTML = data.list.length
          ? data.list
              .map(function (u) {
                return (
                  '<tr>' +
                  '<td>' + u.id + '</td>' +
                  '<td><b>' + UI.escapeHtml(u.username) + '</b><div class="muted text-sm">' + UI.date(u.created_at) + '</div></td>' +
                  '<td>' + UI.escapeHtml(u.nickname || '-') + '</td>' +
                  '<td>' + UI.escapeHtml(u.phone || '-') + '</td>' +
                  '<td>' + (u.role === 'admin' ? '<span class="badge badge-primary">管理员</span>' : '<span class="badge">顾客</span>') + '</td>' +
                  '<td>' + (u.order_count || 0) + '</td>' +
                  '<td class="price" style="font-size:14px">¥' + UI.money(u.consume) + '</td>' +
                  '<td>' + (u.status === 'active' ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-danger">已禁用</span>') + '</td>' +
                  '<td><div class="row-actions">' +
                  '<button class="link-btn" data-toggle="' + u.id + '" data-status="' + u.status + '">' +
                  (u.status === 'active' ? '禁用' : '启用') + '</button>' +
                  '<button class="link-btn gray" data-reset="' + u.id + '">重置密码</button>' +
                  '</div></td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="9">' + UI.empty('没有找到用户') + '</td></tr>';

        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          loadList();
        });
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function openAdd() {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-grid">' +
      '<div class="form-item"><label class="form-label">登录账号 *</label><input class="form-control" id="uName" placeholder="字母开头 3-20 位"/></div>' +
      '<div class="form-item"><label class="form-label">初始密码 *</label><input class="form-control" id="uPwd" value="123456"/></div>' +
      '<div class="form-item"><label class="form-label">用户昵称 *</label><input class="form-control" id="uNick"/></div>' +
      '<div class="form-item"><label class="form-label">角色</label><select class="form-control" id="uRole">' +
      '<option value="customer">普通顾客</option><option value="admin">管理员</option></select></div>' +
      '<div class="form-item"><label class="form-label">手机号</label><input class="form-control" id="uPhone"/></div>' +
      '<div class="form-item"><label class="form-label">邮箱</label><input class="form-control" id="uEmail"/></div>' +
      '<div class="form-error full" id="uError"></div></div>';

    UI.modal('新增用户', form, {
      okText: '确认新增',
      onOk: function (close) {
        window.API.post('/admin/users', {
          username: document.getElementById('uName').value.trim(),
          password: document.getElementById('uPwd').value,
          nickname: document.getElementById('uNick').value.trim(),
          phone: document.getElementById('uPhone').value.trim(),
          email: document.getElementById('uEmail').value.trim(),
          role: document.getElementById('uRole').value,
        })
          .then(function () {
            UI.toast('用户新增成功', 'success');
            close();
            loadList();
          })
          .catch(function (err) {
            document.getElementById('uError').textContent = UI.firstError(err);
          });
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadList();

    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('kw').value.trim();
      state.role = document.getElementById('roleSel').value;
      state.status = document.getElementById('statusSel').value;
      state.page = 1;
      loadList();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      state = { keyword: '', role: '', status: '', page: 1, pageSize: 10 };
      document.getElementById('kw').value = '';
      document.getElementById('roleSel').value = '';
      document.getElementById('statusSel').value = '';
      loadList();
    });
    document.getElementById('addBtn').addEventListener('click', openAdd);

    document.getElementById('tbody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-toggle],[data-reset]');
      if (!t) return;
      if (t.hasAttribute('data-toggle')) {
        var id = t.getAttribute('data-toggle');
        var nextStatus = t.getAttribute('data-status') === 'active' ? 'disabled' : 'active';
        UI.confirm('确认' + (nextStatus === 'disabled' ? '禁用' : '启用') + '该账号？').then(function (ok) {
          if (!ok) return;
          window.API.put('/admin/users/' + id + '/status', { status: nextStatus })
            .then(function () {
              UI.toast('操作成功', 'success');
              loadList();
            })
            .catch(function (err) {
              UI.toast(err.message, 'error');
            });
        });
      } else if (t.hasAttribute('data-reset')) {
        var rid = t.getAttribute('data-reset');
        UI.confirm('确认将该用户密码重置为 123456？').then(function (ok) {
          if (!ok) return;
          window.API.put('/admin/users/' + rid + '/password', { password: '123456' }).then(function () {
            UI.toast('密码已重置为 123456', 'success');
          });
        });
      }
    });
  });
})();
