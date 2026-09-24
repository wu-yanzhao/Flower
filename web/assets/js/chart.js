/* =========================================================
   轻量图表库（纯 SVG，零依赖）：折线图 / 柱状图 / 环形图
   ========================================================= */
(function (global) {
  'use strict';

  var PALETTE = ['#e4577a', '#6fae7c', '#d9a441', '#5b8def', '#a97bd6', '#4fc3c7', '#ef7d5a', '#8d9db6'];

  function svgWrap(w, h, inner) {
    return (
      '<svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" style="font-family:inherit">' +
      inner +
      '</svg>'
    );
  }

  function niceMax(max) {
    if (max <= 0) return 10;
    var pow = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
    var n = Math.ceil(max / pow);
    if (n > 5) n = 5;
    return n * pow * 1.0 || max;
  }

  /** 折线 + 面积图 */
  function line(options) {
    var data = options.data || [];
    var w = options.width || 640;
    var h = options.height || 260;
    var padL = 46;
    var padB = 28;
    var padT = 16;
    var padR = 16;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return Number(d.value) || 0; }).concat([1])));
    var stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;

    var parts = [];
    // 网格与 Y 轴刻度
    for (var i = 0; i <= 4; i += 1) {
      var y = padT + (plotH / 4) * i;
      var val = Math.round((max / 4) * (4 - i));
      parts.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#f0e4e7" stroke-width="1"/>');
      parts.push('<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#a2959a">' + val + '</text>');
    }

    var coords = data.map(function (d, idx) {
      var x = padL + stepX * idx;
      var y = padT + plotH - (plotH * (Number(d.value) || 0)) / max;
      return { x: x, y: y, d: d };
    });

    if (coords.length) {
      var linePath = coords.map(function (c, i) { return (i ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1); }).join(' ');
      var areaPath = linePath + ' L' + coords[coords.length - 1].x.toFixed(1) + ' ' + (padT + plotH) + ' L' + coords[0].x.toFixed(1) + ' ' + (padT + plotH) + ' Z';
      parts.push('<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + (options.color || PALETTE[0]) + '" stop-opacity=".28"/>' +
        '<stop offset="100%" stop-color="' + (options.color || PALETTE[0]) + '" stop-opacity="0"/></linearGradient></defs>');
      parts.push('<path d="' + areaPath + '" fill="url(#areaGrad)"/>');
      parts.push('<path d="' + linePath + '" fill="none" stroke="' + (options.color || PALETTE[0]) + '" stroke-width="2.5" stroke-linejoin="round"/>');
      coords.forEach(function (c) {
        parts.push('<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="3.6" fill="#fff" stroke="' + (options.color || PALETTE[0]) + '" stroke-width="2.4"/>');
        parts.push('<text x="' + c.x.toFixed(1) + '" y="' + (padT + plotH + 18) + '" text-anchor="middle" font-size="11" fill="#a2959a">' + (c.d.label || '') + '</text>');
        if (options.showValue !== false) {
          parts.push('<text x="' + c.x.toFixed(1) + '" y="' + (c.y - 10).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#6f6367">' + (Number(c.d.value) || 0) + '</text>');
        }
      });
    } else {
      parts.push('<text x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle" font-size="13" fill="#a2959a">暂无数据</text>');
    }
    return svgWrap(w, h, parts.join(''));
  }

  /** 柱状图（横向更适合中文长标签） */
  function bar(options) {
    var data = options.data || [];
    var rowH = 34;
    var h = Math.max(120, data.length * rowH + 30);
    var w = options.width || 640;
    var labelW = options.labelWidth || 150;
    var max = Math.max.apply(null, data.map(function (d) { return Number(d.value) || 0; }).concat([1]));
    var barW = w - labelW - 70;

    var parts = [];
    data.forEach(function (d, i) {
      var y = 14 + i * rowH;
      var value = Number(d.value) || 0;
      var bw = Math.max(2, (barW * value) / max);
      var color = PALETTE[i % PALETTE.length];
      parts.push('<text x="0" y="' + (y + 16) + '" font-size="12" fill="#6f6367">' + shortText(d.label, 14) + '</text>');
      parts.push('<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + barW + '" height="18" rx="9" fill="#f7eff1"/>');
      parts.push('<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + bw.toFixed(1) + '" height="18" rx="9" fill="' + color + '"/>');
      parts.push('<text x="' + (labelW + barW + 8) + '" y="' + (y + 16) + '" font-size="12" fill="#6f6367">' + (options.unit || '') + value + '</text>');
    });
    if (!data.length) {
      parts.push('<text x="' + w / 2 + '" y="60" text-anchor="middle" font-size="13" fill="#a2959a">暂无数据</text>');
    }
    return svgWrap(w, h, parts.join(''));
  }

  /** 环形图 */
  function pie(options) {
    var data = (options.data || []).filter(function (d) { return Number(d.value) > 0; });
    var size = options.size || 260;
    var cx = size / 2;
    var cy = size / 2;
    var r = size / 2 - 14;
    var inner = r * 0.58;
    var total = data.reduce(function (s, d) { return s + Number(d.value); }, 0);
    var parts = [];

    if (!total) {
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#f7eff1"/>');
      parts.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="13" fill="#a2959a">暂无数据</text>');
      return svgWrap(size, size, parts.join(''));
    }

    var angle = -Math.PI / 2;
    data.forEach(function (d, i) {
      var ratio = Number(d.value) / total;
      var next = angle + ratio * Math.PI * 2;
      var large = ratio > 0.5 ? 1 : 0;
      var x1 = cx + r * Math.cos(angle);
      var y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(next);
      var y2 = cy + r * Math.sin(next);
      var ix2 = cx + inner * Math.cos(next);
      var iy2 = cy + inner * Math.sin(next);
      var ix1 = cx + inner * Math.cos(angle);
      var iy1 = cy + inner * Math.sin(angle);
      var path =
        'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
        ' L' + ix2.toFixed(1) + ' ' + iy2.toFixed(1) +
        ' A' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + ix1.toFixed(1) + ' ' + iy1.toFixed(1) + ' Z';
      parts.push('<path d="' + path + '" fill="' + PALETTE[i % PALETTE.length] + '"/>');
      angle = next;
    });
    parts.push('<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="13" fill="#a2959a">' + (options.centerLabel || '总量') + '</text>');
    parts.push('<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="18" font-weight="700" fill="#3a2f33">' + total + '</text>');

    // 图例
    var legend = data
      .map(function (d, i) {
        var pct = Math.round((Number(d.value) / total) * 100);
        return '<span><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + d.name + ' ' + pct + '%</span>';
      })
      .join('');
    return {
      svg: svgWrap(size, size, parts.join('')),
      legend: '<div class="chart-legend">' + legend + '</div>',
    };
  }

  function shortText(text, len) {
    var s = String(text || '');
    return s.length > len ? s.slice(0, len) + '…' : s;
  }

  global.Chart = { line: line, bar: bar, pie: pie, PALETTE: PALETTE };
})(window);
