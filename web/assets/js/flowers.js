/* =========================================================
   商品列表页：分类 / 价格 / 关键词 / 排序 / 分页
   ========================================================= */
(function () {
  'use strict';
  var UI = window.UI;

  var state = {
    keyword: UI.qs('keyword') || '',
    categoryId: Number(UI.qs('categoryId') || 0),
    minPrice: UI.qs('minPrice') || '',
    maxPrice: UI.qs('maxPrice') || '',
    sort: UI.qs('sort') || 'default',
    page: 1,
    pageSize: 12,
  };

  function loadCategories() {
    return window.API.get('/categories').then(function (list) {
      var box = document.getElementById('catFilter');
      box.innerHTML =
        '<button data-cat="0"' + (state.categoryId === 0 ? ' class="active"' : '') + '>全部</button>' +
        list
          .map(function (c) {
            return '<button data-cat="' + c.id + '"' + (state.categoryId === c.id ? ' class="active"' : '') + '>' + UI.escapeHtml(c.name) + '</button>';
          })
          .join('');
    });
  }

  function syncUI() {
    if (state.keyword) document.getElementById('keywordInput').value = state.keyword;
    if (state.minPrice) document.getElementById('minPrice').value = state.minPrice;
    if (state.maxPrice) document.getElementById('maxPrice').value = state.maxPrice;
    UI.$$('#sortTabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sort') === state.sort);
    });
  }

  function loadList() {
    var grid = document.getElementById('flowerGrid');
    grid.innerHTML = '<div class="loading">加载中…</div>';
    window.API.get('/flowers', {
      keyword: state.keyword,
      categoryId: state.categoryId || '',
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      sort: state.sort,
      page: state.page,
      pageSize: state.pageSize,
    })
      .then(function (data) {
        grid.innerHTML = data.list.length
          ? data.list.map(window.Components.flowerCard).join('')
          : UI.empty('没有找到符合条件的鲜花，试试其它关键词吧～', '🔍');

        document.getElementById('listSummary').textContent =
          '共 ' + data.total + ' 款花礼' + (state.keyword ? '（关键词：' + state.keyword + '）' : '');
        document.getElementById('pageInfo').textContent = '第 ' + data.page + ' / ' + data.totalPages + ' 页';
        UI.renderPagination(document.getElementById('pagination'), data.page, data.totalPages, function (p) {
          state.page = p;
          loadList();
          window.scrollTo({ top: 200, behavior: 'smooth' });
        });
      })
      .catch(function (err) {
        grid.innerHTML = UI.empty(err.message || '加载失败');
      });
  }

  function bindEvents() {
    document.getElementById('catFilter').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;
      UI.$$('#catFilter button').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      state.categoryId = Number(btn.getAttribute('data-cat'));
      state.page = 1;
      loadList();
    });

    document.getElementById('priceFilter').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-min]');
      if (!btn) return;
      UI.$$('#priceFilter button').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      state.minPrice = btn.getAttribute('data-min') || '';
      state.maxPrice = btn.getAttribute('data-max') || '';
      document.getElementById('minPrice').value = state.minPrice;
      document.getElementById('maxPrice').value = state.maxPrice;
      state.page = 1;
      loadList();
    });

    document.getElementById('priceBtn').addEventListener('click', function () {
      state.minPrice = document.getElementById('minPrice').value.trim();
      state.maxPrice = document.getElementById('maxPrice').value.trim();
      state.page = 1;
      loadList();
    });

    document.getElementById('keywordBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('keywordInput').value.trim();
      state.page = 1;
      loadList();
    });
    document.getElementById('keywordInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('keywordBtn').click();
    });

    document.getElementById('sortTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sort]');
      if (!btn) return;
      state.sort = btn.getAttribute('data-sort');
      syncUI();
      state.page = 1;
      loadList();
    });

    document.getElementById('resetFilter').addEventListener('click', function () {
      state.keyword = '';
      state.categoryId = 0;
      state.minPrice = '';
      state.maxPrice = '';
      state.sort = 'default';
      state.page = 1;
      document.getElementById('keywordInput').value = '';
      document.getElementById('minPrice').value = '';
      document.getElementById('maxPrice').value = '';
      syncUI();
      loadCategories().then(loadList);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadCategories().then(function () {
      syncUI();
      loadList();
    });
    bindEvents();
    window.Components.bindCards(document.body);
  });
})();
