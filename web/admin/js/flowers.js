/* =========================================================
   后台商品管理：查询、新增、编辑、上下架、库存调整、删除
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;
  var state = { keyword: '', categoryId: '', status: '', page: 1, pageSize: 10 };
  var categories = [];

  // 商品图片本地上传：扩展名白名单（大小写不敏感）与大小上限，
  // 与后端 upload.controller.js 的 ALLOWED_EXT / MAX_SIZE 保持一致
  var ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'avif', 'raw'];
  var MAX_IMG_SIZE = 10 * 1024 * 1024; // 10MB
  var uploading = false;

  function loadCategories() {
    return window.API.get('/categories').then(function (list) {
      categories = list;
      document.getElementById('catSel').innerHTML =
        '<option value="">全部分类</option>' +
        list.map(function (c) { return '<option value="' + c.id + '">' + UI.escapeHtml(c.name) + '</option>'; }).join('');
    });
  }

  function loadList() {
    window.API.get('/admin/flowers', {
      keyword: state.keyword,
      categoryId: state.categoryId,
      status: state.status,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        document.getElementById('tbody').innerHTML = data.list.length
          ? data.list
              .map(function (f) {
                return (
                  '<tr>' +
                  '<td>' + f.id + '</td>' +
                  '<td><img class="thumb" src="' + (f.image || '/assets/images/ui/no-image.svg') + '" alt=""/></td>' +
                  '<td><div style="font-weight:600">' + UI.escapeHtml(f.name) + '</div>' +
                  '<div class="muted text-sm">' + UI.escapeHtml(f.subtitle || '') + '</div></td>' +
                  '<td>' + UI.escapeHtml(f.category_name || '-') + '</td>' +
                  '<td class="price" style="font-size:14px">¥' + UI.money(f.price) + '</td>' +
                  '<td>' + (f.stock <= 10 ? '<b style="color:#e2564f">' + f.stock + '</b>' : f.stock) + '</td>' +
                  '<td>' + (f.sales || 0) + '</td>' +
                  '<td>' + (f.status === 'on' ? '<span class="badge badge-success">在售</span>' : '<span class="badge badge-danger">已下架</span>') +
                  (f.recommended ? ' <span class="badge badge-primary">推荐</span>' : '') + '</td>' +
                  '<td><div class="row-actions">' +
                  '<button class="link-btn" data-edit="' + f.id + '">编辑</button>' +
                  '<button class="link-btn" data-toggle="' + f.id + '" data-status="' + f.status + '">' +
                  (f.status === 'on' ? '下架' : '上架') + '</button>' +
                  '<button class="link-btn gray" data-stock="' + f.id + '">库存+10</button>' +
                  '<button class="link-btn danger" data-del="' + f.id + '">删除</button>' +
                  '</div></td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="9">' + UI.empty('没有找到商品') + '</td></tr>';

        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          loadList();
        });
      })
      .catch(function (err) {
        UI.toast(err.message, 'error');
      });
  }

  function openForm(flower) {
    var form = UI.el('div');
    form.innerHTML =
      '<div class="form-grid">' +
      '<div class="form-item"><label class="form-label">商品名称 *</label>' +
      '<input class="form-control" id="fName" value="' + UI.escapeHtml(flower ? flower.name : '') + '" placeholder="如：一生挚爱·红玫瑰 33 朵"/></div>' +
      '<div class="form-item"><label class="form-label">所属分类 *</label>' +
      '<select class="form-control" id="fCategory">' +
      categories.map(function (c) {
        return '<option value="' + c.id + '"' + (flower && flower.category_id === c.id ? ' selected' : '') + '>' + UI.escapeHtml(c.name) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="form-item"><label class="form-label">售价（元）*</label>' +
      '<input class="form-control" id="fPrice" type="number" step="0.01" value="' + (flower ? flower.price : '') + '"/></div>' +
      '<div class="form-item"><label class="form-label">原价（元）</label>' +
      '<input class="form-control" id="fOldPrice" type="number" step="0.01" value="' + (flower ? flower.original_price : '') + '"/></div>' +
      '<div class="form-item"><label class="form-label">库存 *</label>' +
      '<input class="form-control" id="fStock" type="number" value="' + (flower ? flower.stock : 100) + '"/></div>' +
      '<div class="form-item"><label class="form-label">状态</label>' +
      '<select class="form-control" id="fStatus"><option value="on"' + (flower && flower.status === 'off' ? '' : ' selected') + '>在售</option>' +
      '<option value="off"' + (flower && flower.status === 'off' ? ' selected' : '') + '>下架</option></select></div>' +
      '<div class="form-item full"><label class="form-label">副标题</label>' +
      '<input class="form-control" id="fSubtitle" value="' + UI.escapeHtml(flower ? flower.subtitle : '') + '"/></div>' +
      '<div class="form-item full"><label class="form-label">花语</label>' +
      '<input class="form-control" id="fLanguage" value="' + UI.escapeHtml(flower ? flower.flower_language : '') + '"/></div>' +
      '<div class="form-item full"><label class="form-label">花材</label>' +
      '<input class="form-control" id="fMaterial" value="' + UI.escapeHtml(flower ? flower.material : '') + '"/></div>' +
      '<div class="form-item full"><label class="form-label">包装方式</label>' +
      '<input class="form-control" id="fPacking" value="' + UI.escapeHtml(flower ? flower.packing : '') + '"/></div>' +
      '<div class="form-item full"><label class="form-label">商品描述</label>' +
      '<textarea class="form-control" id="fDesc">' + UI.escapeHtml(flower ? flower.description : '') + '</textarea></div>' +
      '<div class="form-item full"><label class="form-label">商品图片（本地上传）</label>' +
      '<input class="form-control" id="fFile" type="file" accept=".jpg,.jpeg,.png,.avif,.raw"/>' +
      '<input class="form-control" id="fImage" readonly placeholder="选择文件后自动上传并填入图片地址" value="' + (flower && flower.image ? flower.image : '') + '"/>' +
      '<div class="muted text-sm" id="fUploadStatus">支持 JPG / PNG / AVIF / RAW 格式，大小不超过 10MB</div>' +
      '<img class="preview-img" id="fPreview" src="' + (flower && flower.image ? flower.image : '') + '"' +
      (flower && flower.image ? '' : ' style="display:none"') + '/></div>' +
      '<div class="form-item full"><label class="text-sm"><input type="checkbox" id="fRecommend" ' +
      (flower && flower.recommended ? 'checked' : '') + '/> 首页推荐位展示</label></div>' +
      '<div class="form-error full" id="fError"></div>' +
      '</div>';

    var modalRef = UI.modal(flower ? '编辑商品（#' + flower.id + '）' : '新增商品', form, {
      size: 'modal-lg',
      okText: flower ? '保存修改' : '确认新增',
      onOk: function (close) {
        var payload = {
          category_id: Number(document.getElementById('fCategory').value),
          name: document.getElementById('fName').value.trim(),
          subtitle: document.getElementById('fSubtitle').value.trim(),
          price: Number(document.getElementById('fPrice').value),
          original_price: Number(document.getElementById('fOldPrice').value) || Number(document.getElementById('fPrice').value),
          stock: Number(document.getElementById('fStock').value),
          image: document.getElementById('fImage').value.trim(),
          description: document.getElementById('fDesc').value.trim(),
          material: document.getElementById('fMaterial').value.trim(),
          flower_language: document.getElementById('fLanguage').value.trim(),
          packing: document.getElementById('fPacking').value.trim(),
          status: document.getElementById('fStatus').value,
          recommended: document.getElementById('fRecommend').checked ? 1 : 0,
        };
        if (!payload.name) {
          document.getElementById('fError').textContent = '请填写商品名称';
          return;
        }
        if (!payload.price || payload.price <= 0) {
          document.getElementById('fError').textContent = '售价必须大于 0';
          return;
        }
        if (uploading) {
          document.getElementById('fError').textContent = '图片正在上传，请稍候再提交';
          return;
        }
        if (!payload.image) {
          document.getElementById('fError').textContent = '请先选择并上传商品图片';
          return;
        }
        var req = flower ? window.API.put('/admin/flowers/' + flower.id, payload) : window.API.post('/admin/flowers', payload);
        req
          .then(function () {
            UI.toast(flower ? '商品已更新' : '商品新增成功', 'success');
            close();
            loadList();
          })
          .catch(function (err) {
            document.getElementById('fError').textContent = UI.firstError(err);
          });
      },
    });

    // 本地文件上传：前端先做扩展名/大小筛选，非法类型直接报错、不发起请求；
    // 合法文件以 base64 随 JSON 提交到 /admin/uploads，由后端做最终校验并落盘
    document.getElementById('fFile').addEventListener('change', function () {
      var input = this;
      var file = input.files && input.files[0];
      var errEl = document.getElementById('fError');
      var statusEl = document.getElementById('fUploadStatus');
      errEl.textContent = '';
      if (!file) return;

      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ALLOWED_EXT.indexOf(ext) === -1) {
        errEl.textContent = '不支持的图片类型「' + ext + '」，仅允许 JPG、PNG、AVIF、RAW 格式';
        input.value = '';
        return;
      }
      if (file.size > MAX_IMG_SIZE) {
        errEl.textContent = '图片过大（' + Math.round(file.size / 1024 / 1024) + 'MB），上限 10MB，请压缩后再上传';
        input.value = '';
        return;
      }

      uploading = true;
      modalRef.box._okBtn.disabled = true;
      statusEl.textContent = '上传中…';
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = String(reader.result).replace(/^data:[^;]+;base64,/, '');
        window.API.post('/admin/uploads', { name: file.name, data: base64 })
          .then(function (d) {
            document.getElementById('fImage').value = d.url;
            var preview = document.getElementById('fPreview');
            preview.src = d.url;
            preview.style.display = '';
            statusEl.textContent = '上传成功';
          })
          .catch(function (err) {
            errEl.textContent = err.message || '上传失败，请重试';
            statusEl.textContent = '上传失败';
          })
          .then(function () {
            uploading = false;
            modalRef.box._okBtn.disabled = false;
            input.value = '';
          });
      };
      reader.onerror = function () {
        uploading = false;
        modalRef.box._okBtn.disabled = false;
        statusEl.textContent = '读取文件失败，请重试';
        input.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AdminLayout.guard()) return;
    loadCategories().then(loadList);

    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('kw').value.trim();
      state.categoryId = document.getElementById('catSel').value;
      state.status = document.getElementById('statusSel').value;
      state.page = 1;
      loadList();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      state = { keyword: '', categoryId: '', status: '', page: 1, pageSize: 10 };
      document.getElementById('kw').value = '';
      document.getElementById('catSel').value = '';
      document.getElementById('statusSel').value = '';
      loadList();
    });
    document.getElementById('addBtn').addEventListener('click', function () {
      openForm(null);
    });

    document.getElementById('tbody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-edit],[data-toggle],[data-stock],[data-del]');
      if (!t) return;

      if (t.hasAttribute('data-edit')) {
        var id = Number(t.getAttribute('data-edit'));
        window.API.get('/flowers/' + id).then(openForm);
      } else if (t.hasAttribute('data-toggle')) {
        var tid = t.getAttribute('data-toggle');
        var nextStatus = t.getAttribute('data-status') === 'on' ? 'off' : 'on';
        window.API.put('/admin/flowers/' + tid + '/status', { status: nextStatus }).then(function () {
          UI.toast(nextStatus === 'on' ? '商品已上架' : '商品已下架', 'success');
          loadList();
        });
      } else if (t.hasAttribute('data-stock')) {
        window.API.put('/admin/flowers/' + t.getAttribute('data-stock') + '/stock', { delta: 10 }).then(function (d) {
          UI.toast('库存已调整，当前库存 ' + d.stock, 'success');
          loadList();
        });
      } else if (t.hasAttribute('data-del')) {
        var delId = t.getAttribute('data-del');
        UI.confirm('删除后不可恢复（有历史订单的商品只能下架）。确认删除？').then(function (ok) {
          if (!ok) return;
          window.API.del('/admin/flowers/' + delId)
            .then(function () {
              UI.toast('商品已删除', 'success');
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
