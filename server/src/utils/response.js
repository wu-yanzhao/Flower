'use strict';

/**
 * 统一响应格式封装
 * {
 *   code: 0 表示成功，非 0 为业务/HTTP 错误码
 *   message: 提示信息（前端 toast 直接展示）
 *   data: 数据体（列表接口为 { list, total, page, pageSize }）
 * }
 */

/** 成功响应 */
function ok(res, data, message) {
  return res.json({ code: 0, message: message || '操作成功', data: data === undefined ? null : data });
}

/** 分页响应 */
function page(res, list, total, pageNum, pageSize) {
  return res.json({
    code: 0,
    message: '查询成功',
    data: {
      list,
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/** 包装异步控制器，统一将异常交给错误处理中间件 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ok, page, asyncHandler };
