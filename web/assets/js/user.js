/* =========================================================
   个人中心：资料、收货地址、收藏、修改密码
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var addresses = [];

  function setError(field, msg) {
    var node = document.querySelector('[data-error="' + field + '"]');
    if (node) node.textContent = msg || '';
  }

  function switchTab(tab) {
    UI.$$('#userNav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === tab);
    });
    ['profile', 'addresses', 'favorites', 'security'].forEach(function (name) {
      document.getElementById('pane-' + name).style.display = name === tab ? 'block' : 'none';
    });
    if (tab === 'addresses') loadAddresses();
    if (tab === 'favorites') loadFavorites();
  }

  function loadProfile() {
    window.API.get('/auth/profile')
      .then(function (u) {
        document.getElementById('uAvatar').textContent = (u.nickname || u.username || '花').slice(0, 1);
        document.getElementById('uNickname').textContent = u.nickname || u.username;
        document.getElementById('uAccount').textContent = '账号：' + u.username + '　注册时间：' + UI.date(u.created_at);
        document.getElementById('sOrder').textContent = u.orderCount || 0;
        document.getElementById('sFav').textContent = u.favCount || 0;
        document.getElementById('sCart').textContent = u.cartCount || 0;
        document.getElementById('sRole').textContent = u.role === 'admin' ? '管理员' : '顾客';
        document.getElementById('pNickname').value = u.nickname || '';
        document.getElementById('pUsername').value = u.username || '';
        document.getElementById('pPhone').value = u.phone || '';
        document.getElementById('pEmail').value = u.email || '';
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function loadAddresses() {
    window.API.get('/addresses')
      .then(function (list) {
        addresses = list;
        var box = document.getElementById('addrList');
        box.innerHTML = list.length
          ? list
              .map(function (a) {
                return (
                  '<div class="address-card' + (a.is_default ? ' active' : '') + '">' +
                  '<div class="ops"><span data-edit="' + a.id + '">编辑</span><span data-del="' + a.id + '">删除</span>' +
                  (a.is_default ? '' : '<span data-default="' + a.id + '">设为默认</span>') + '</div>' +
                  '<div class="name">' + UI.escapeHtml(a.receiver) + ' <span class="muted">' + UI.escapeHtml(a.phone) + '</span>' +
                  (a.is_default ? ' <span class="badge badge-primary">默认</span>' : '') + '</div>' +
                  '<div class="muted text-sm">' + UI.escapeHtml(a.region) + ' ' + UI.escapeHtml(a.detail) + '</div>' +
                  '</div>'
                );
              })
              .join('')
          : UI.empty('还没有收货地址，点击右上角新增', '📍');
      })
      .catch(function () {});
  }

  function loadFavorites() {
    window.API.get('/favorites')
      .then(function (list) {
        document.getElementById('favGrid').innerHTML = list.length
          ? list
              .map(function (f) {
                return window.Components.flowerCard(Object.assign({}, f, { favorited: true }));
              })
              .join('')
          : UI.empty('还没有收藏的鲜花', '💗');
      })
      .catch(function () {});
  }

  function addressModal(addr) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-row"><div class="form-item"><label class="form-label">收货人</label>' +
      '<input class="form-control" id="aReceiver" value="' + UI.escapeHtml(addr ? addr.receiver : '') + '"/></div>' +
      '<div class="form-item"><label class="form-label">联系电话</label>' +
      '<input class="form-control" id="aPhone" value="' + UI.escapeHtml(addr ? addr.phone : '') + '"/></div></div>' +
      '<div class="form-item"><label class="form-label">所在地区</label>' +
      '<input class="form-control" id="aRegion" value="' + UI.escapeHtml(addr ? addr.region : '') + '" placeholder="如：广东省 广州市 天河区"/></div>' +
      '<div class="form-item"><label class="form-label">详细地址</label>' +
      '<input class="form-control" id="aDetail" value="' + UI.escapeHtml(addr ? addr.detail : '') + '"/></div>' +
      '<label class="text-sm"><input type="checkbox" id="aDefault" ' + (addr && addr.is_default ? 'checked' : '') + '/> 设为默认地址</label>' +
      '<div class="form-error" id="aError"></div>';

    UI.modal(addr ? '编辑地址' : '新增收货地址', form, {
      okText: '保存',
      onOk: function (close) {
        var payload = {
          receiver: document.getElementById('aReceiver').value.trim(),
          phone: document.getElementById('aPhone').value.trim(),
          region: document.getElementById('aRegion').value.trim(),
          detail: document.getElementById('aDetail').value.trim(),
          is_default: document.getElementById('aDefault').checked ? 1 : 0,
        };
        var req = addr ? window.API.put('/addresses/' + addr.id, payload) : window.API.post('/addresses', payload);
        req
          .then(function () {
            UI.toast('地址已保存', 'success');
            close();
            loadAddresses();
          })
          .catch(function (err) {
            document.getElementById('aError').textContent = UI.firstError(err);
          });
      },
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.Layout.requireLogin()) return;

    loadProfile();
    switchTab(UI.qs('tab') || 'profile');

    document.getElementById('userNav').addEventListener('click', function (e) {
      var a = e.target.closest('[data-tab]');
      if (a) switchTab(a.getAttribute('data-tab'));
    });

    document.getElementById('logoutBtn2').addEventListener('click', function () {
      window.Auth.clear();
      UI.toast('已退出登录');
      setTimeout(function () {
        location.href = 'index.html';
      }, 400);
    });

    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      window.API.put('/auth/profile', {
        nickname: document.getElementById('pNickname').value.trim(),
        phone: document.getElementById('pPhone').value.trim(),
        email: document.getElementById('pEmail').value.trim(),
      })
        .then(function (user) {
          var old = window.Auth.getUser() || {};
          window.Auth.setUser(Object.assign({}, old, user));
          UI.toast('资料已更新', 'success');
          loadProfile();
          window.Layout.renderHeader();
        })
        .catch(function (err) {
          var detail = err.details || {};
          Object.keys(detail).forEach(function (k) {
            setError(k, detail[k]);
          });
          UI.toast(err.message, 'error');
        });
    });

    document.getElementById('pwdForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var oldPwd = document.getElementById('oldPwd').value;
      var newPwd = document.getElementById('newPwd').value;
      var confirmPwd = document.getElementById('confirmPwd').value;
      UI.$$('[data-error]').forEach(function (n) {
        n.textContent = '';
      });
      if (newPwd.length < 6 || newPwd.length > 20) {
        setError('newPassword', '新密码长度需为 6-20 位');
        return;
      }
      if (newPwd !== confirmPwd) {
        setError('confirm', '两次输入的新密码不一致');
        return;
      }
      window.API.put('/auth/password', { oldPassword: oldPwd, newPassword: newPwd })
        .then(function () {
          UI.toast('密码修改成功，请牢记新密码', 'success');
          document.getElementById('pwdForm').reset();
        })
        .catch(function (err) {
          var detail = err.details || {};
          Object.keys(detail).forEach(function (k) {
            setError(k, detail[k]);
          });
          UI.toast(err.message, 'error');
        });
    });

    document.getElementById('addAddressBtn').addEventListener('click', function () {
      addressModal(null);
    });

    document.getElementById('addrList').addEventListener('click', function (e) {
      var edit = e.target.closest('[data-edit]');
      var del = e.target.closest('[data-del]');
      var def = e.target.closest('[data-default]');
      if (edit) {
        var id = Number(edit.getAttribute('data-edit'));
        addressModal(addresses.filter(function (a) { return a.id === id; })[0]);
      } else if (del) {
        var delId = del.getAttribute('data-del');
        UI.confirm('确定删除该地址？').then(function (ok) {
          if (ok) window.API.del('/addresses/' + delId).then(loadAddresses);
        });
      } else if (def) {
        window.API.put('/addresses/' + def.getAttribute('data-default') + '/default').then(loadAddresses);
      }
    });
  });
})();
