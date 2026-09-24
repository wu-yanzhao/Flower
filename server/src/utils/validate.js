'use strict';

/**
 * 通用数据校验器（零依赖）
 * ------------------------------------------------------------
 * 用法：
 *   const data = validate(req.body, {
 *     username: { required: '请输入账号', min: [3, '账号至少 3 个字符'], max: [20, '账号最多 20 个字符'] },
 *     phone:    { pattern: [/^1[3-9]\d{9}$/, '手机号格式不正确'] },
 *     price:    { type: 'number', min: [0, '价格不能为负数'] },
 *   });
 * 校验失败时抛出 HttpError(400, 第一条错误信息, errors 明细)
 */

const { HttpError } = require('./http-error');

const TYPE_MAP = {
  number: (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))),
  integer: (v) => Number.isInteger(Number(v)) && String(v).trim() !== '',
  string: (v) => typeof v === 'string',
  array: (v) => Array.isArray(v),
  boolean: (v) => typeof v === 'boolean' || v === 'true' || v === 'false' || v === 0 || v === 1,
};

function validate(source, rules) {
  const data = {};
  const errors = {};
  const input = source || {};

  Object.keys(rules).forEach((field) => {
    const rule = rules[field];
    let value = input[field];

    // 未传值：取默认或判必填
    if (value === undefined || value === null || value === '') {
      if (rule.required) {
        errors[field] = typeof rule.required === 'string' ? rule.required : `${field} 不能为空`;
        return;
      }
      if (rule.default !== undefined) value = rule.default;
      else if (!rule.keepEmpty) return; // 不传则不包含在结果中
    }

    // 类型校验
    if (rule.type && TYPE_MAP[rule.type]) {
      if (!TYPE_MAP[rule.type](value)) {
        errors[field] = rule.typeMessage || `${field} 数据类型不正确`;
        return;
      }
      if (rule.type === 'number' || rule.type === 'integer') {
        value = rule.type === 'integer' ? parseInt(value, 10) : Number(value);
      }
      if (rule.type === 'string') value = String(value).trim();
    } else if (typeof value === 'string') {
      value = value.trim();
    }

    // 长度 / 大小
    if (rule.min) {
      const [limit, msg] = rule.min;
      const actual = typeof value === 'string' ? value.length : Number(value);
      if (actual < limit) {
        errors[field] = msg || `${field} 不能小于 ${limit}`;
        return;
      }
    }
    if (rule.max) {
      const [limit, msg] = rule.max;
      const actual = typeof value === 'string' ? value.length : Number(value);
      if (actual > limit) {
        errors[field] = msg || `${field} 不能大于 ${limit}`;
        return;
      }
    }
    if (rule.pattern) {
      const [regex, msg] = rule.pattern;
      if (!regex.test(String(value))) {
        errors[field] = msg || `${field} 格式不正确`;
        return;
      }
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors[field] = rule.enumMessage || `${field} 取值不合法`;
      return;
    }
    if (rule.custom) {
      const result = rule.custom(value, input);
      if (result !== true) {
        errors[field] = result || `${field} 校验未通过`;
        return;
      }
    }

    data[field] = value;
  });

  if (Object.keys(errors).length) {
    throw new HttpError(400, Object.values(errors)[0], errors);
  }
  return data;
}

module.exports = { validate };
