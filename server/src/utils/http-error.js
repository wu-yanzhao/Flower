'use strict';

/**
 * 业务异常：控制器中直接 throw，由统一错误处理中间件捕获并输出标准 JSON
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message || '请求处理失败');
    this.name = 'HttpError';
    this.status = status || 500;
    this.details = details;
  }
}

module.exports = { HttpError };
