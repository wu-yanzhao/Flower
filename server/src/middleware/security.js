'use strict';

const { HttpError } = require('../utils/http-error');

/**
 * 轻量安全中间件（零外部依赖，与项目"不引入第三方安全库"的设计保持一致）
 * - securityHeaders：补充基础安全响应头
 * - createRateLimit：固定窗口限流工厂（登录接口防暴力破解）
 *
 * 说明：此处未设置严格的 Content-Security-Policy——本项目前端大量使用
 * 内联 <script> / <style> 与内联 SVG，过严的 CSP 会直接导致页面无法渲染；
 * 若后续前端改为外链资源，可再补充 CSP。
 */

/** 基础安全响应头 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

/**
 * 固定窗口限流工厂：同一 IP 在 windowMs 内累计「失败」请求达到 max 次后，返回 429。
 * 仅统计失败（状态码 ≥ 400）的请求，成功请求不占用额度——既能抵御暴力破解，
 * 又不会误伤正常登录与自动化接口测试。计数保存在进程内存（Map），
 * 规模较大时惰性清理过期键，避免无限增长。
 */
function createRateLimit(options) {
  const windowMs = (options && options.windowMs) || 60 * 1000;
  const max = (options && options.max) || 10;
  const message = (options && options.message) || '操作过于频繁，请稍后再试';
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    const record = hits.get(key);
    if (record && now - record.start < windowMs && record.count >= max) {
      res.setHeader('Retry-After', String(Math.ceil((record.start + windowMs - now) / 1000)));
      return next(new HttpError(429, message));
    }
    // 响应结束后按结果累计：仅失败请求计入额度
    res.on('finish', () => {
      if (res.statusCode < 400) return;
      const t = Date.now();
      const rec = hits.get(key);
      if (!rec || t - rec.start >= windowMs) {
        hits.set(key, { start: t, count: 1 });
        clean(t);
      } else {
        rec.count += 1;
      }
    });
    return next();
  };

  function clean(now) {
    if (hits.size < 1000) return; // 仅在规模较大时清理，避免每次请求都遍历
    hits.forEach((rec, k) => {
      if (now - rec.start >= windowMs) hits.delete(k);
    });
  }
}

module.exports = { securityHeaders, createRateLimit };
