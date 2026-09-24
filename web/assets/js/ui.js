/* =========================================================
   前端通用工具：DOM、提示、弹窗、格式化、分页、状态映射
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- DOM ---------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str).replace(/[&<>"']/g, function (s) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
    });
  }

  /* ---------- Toast ---------- */
  function toast(message, type, duration) {
    var box = $('#toastBox');
    if (!box) {
      box = el('div', { id: 'toastBox' });
      document.body.appendChild(box);
    }
    var node = el('div', { class: 'toast ' + (type || '') }, [message]);
    box.appendChild(node);
    setTimeout(function () {
      node.style.transition = 'opacity .3s';
      node.style.opacity = '0';
      setTimeout(function () {
        node.remove();
      }, 300);
    }, duration || 2000);
  }

  /* ---------- 确认弹窗 ---------- */
  function confirm(message, title) {
    return new Promise(function (resolve) {
      var mask = el('div', { class: 'modal-mask' });
      var modal = el('div', { class: 'modal', style: 'max-width:400px' }, [
        el('div', { class: 'modal-head' }, [title || '操作确认']),
        el('div', { class: 'modal-body', html: '<div style="font-size:14px;line-height:1.8">' + escapeHtml(message) + '</div>' }),
        (function () {
          var foot = el('div', { class: 'modal-foot' });
          var cancel = el('button', { class: 'btn btn-ghost', onclick: function () { close(false); } }, ['取消']);
          var sure = el('button', { class: 'btn btn-primary', onclick: function () { close(true); } }, ['确定']);
          foot.appendChild(cancel);
          foot.appendChild(sure);
          return foot;
        })(),
      ]);
      function close(result) {
        mask.remove();
        resolve(result);
      }
      mask.appendChild(modal);
      mask.addEventListener('click', function (e) {
        if (e.target === mask) close(false);
      });
      document.body.appendChild(mask);
    });
  }

  /** 打开自定义弹窗（返回容器，调用方自行填充内容） */
  function modal(title, contentNode, options) {
    options = options || {};
    var mask = el('div', { class: 'modal-mask' });
    var box = el('div', { class: 'modal ' + (options.size || '') });
    var head = el('div', { class: 'modal-head' }, [title]);
    var closeBtn = el('button', { class: 'modal-close', html: '&times;' });
    closeBtn.addEventListener('click', function () {
      close();
    });
    head.appendChild(closeBtn);
    var body = el('div', { class: 'modal-body' });
    body.appendChild(contentNode);
    box.appendChild(head);
    box.appendChild(body);
    if (options.footer !== false) {
      var foot = el('div', { class: 'modal-foot' });
      var cancel = el('button', { class: 'btn btn-ghost', onclick: function () { close(); } }, [options.cancelText || '取消']);
      var okBtn = el('button', { class: 'btn btn-primary', onclick: function () {
        if (options.onOk) options.onOk(close);
      } }, [options.okText || '保存']);
      foot.appendChild(cancel);
      foot.appendChild(okBtn);
      box.appendChild(foot);
      box._okBtn = okBtn;
    }
    function close() {
      mask.remove();
      if (options.onClose) options.onClose();
    }
    mask.appendChild(box);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) close();
    });
    document.body.appendChild(mask);
    return { close: close, box: box };
  }

  /* ---------- 格式化 ---------- */
  function money(n) {
    var v = Number(n || 0);
    return v.toFixed(2).replace(/\.00$/, '');
  }
  function price(n) {
    return '¥' + money(n);
  }
  function date(str, withTime) {
    if (!str) return '-';
    var d = new Date(String(str).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return str;
    var p = function (x) {
      return String(x).padStart(2, '0');
    };
    var res = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return withTime ? res + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : res;
  }
  function stars(rating) {
    var html = '';
    for (var i = 1; i <= 5; i += 1) {
      html += '<span class="' + (i <= rating ? '' : 'off') + '">★</span>';
    }
    return '<span class="stars">' + html + '</span>';
  }

  /* ---------- 业务状态映射 ---------- */
  var STATUS = {
    pending: { text: '待付款', cls: 'badge-warning' },
    paid: { text: '待发货', cls: 'badge-info' },
    shipped: { text: '待收货', cls: 'badge-primary' },
    completed: { text: '已完成', cls: 'badge-success' },
    canceled: { text: '已取消', cls: 'badge-danger' },
  };
  function statusText(s) {
    return (STATUS[s] || { text: s }).text;
  }
  function statusBadge(s) {
    var item = STATUS[s] || { text: s, cls: '' };
    return '<span class="badge ' + item.cls + '">' + item.text + '</span>';
  }

  /* ---------- 分页 ---------- */
  function renderPagination(container, pageNum, totalPages, onChange) {
    container.innerHTML = '';
    if (totalPages <= 1) return;
    function btn(text, target, disabled, active) {
      var b = el('button', {}, [String(text)]);
      if (disabled) b.disabled = true;
      if (active) b.className = 'active';
      b.addEventListener('click', function () {
        if (!disabled && !active) onChange(target);
      });
      container.appendChild(b);
    }
    btn('上一页', pageNum - 1, pageNum <= 1, false);
    var start = Math.max(1, Math.min(pageNum - 2, totalPages - 4));
    var end = Math.min(totalPages, start + 4);
    if (start > 1) btn(1, 1, false, pageNum === 1);
    if (start > 2) container.appendChild(el('span', { class: 'muted' }, ['…']));
    for (var i = start; i <= end; i += 1) btn(i, i, false, i === pageNum);
    if (end < totalPages - 1) container.appendChild(el('span', { class: 'muted' }, ['…']));
    if (end < totalPages) btn(totalPages, totalPages, false, pageNum === totalPages);
    btn('下一页', pageNum + 1, pageNum >= totalPages, false);
  }

  function empty(text, icon) {
    return (
      '<div class="empty"><div class="empty-icon">' + (icon || '🌸') + '</div><div>' + escapeHtml(text || '暂无数据') + '</div></div>'
    );
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait || 300);
    };
  }

  /** 提取接口/表单校验错误的第一条提示（用于表单内联提示） */
  function firstError(err) {
    if (err && err.details) {
      var keys = Object.keys(err.details);
      if (keys.length) return err.details[keys[0]];
    }
    return err && err.message ? err.message : '操作失败';
  }

  global.UI = {
    $: $,
    $$: $$,
    el: el,
    escapeHtml: escapeHtml,
    toast: toast,
    confirm: confirm,
    modal: modal,
    money: money,
    price: price,
    date: date,
    stars: stars,
    statusText: statusText,
    statusBadge: statusBadge,
    STATUS: STATUS,
    renderPagination: renderPagination,
    empty: empty,
    qs: qs,
    debounce: debounce,
    firstError: firstError,
  };
})(window);
