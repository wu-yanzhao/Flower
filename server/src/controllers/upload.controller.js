'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { HttpError } = require('../utils/http-error');
const { ok } = require('../utils/response');

/**
 * 商品图片上传（管理员）
 * ------------------------------------------------------------
 * 请求：POST /api/admin/uploads  { name: 原始文件名, data: base64 文件内容 }
 * 响应：{ url: '/static/uploads/img-xxx.jpg' }（可直接写入 flowers.image）
 *
 * 校验策略（前端已筛一道，这里做服务端最终校验）：
 * 1. 扩展名白名单：JPEG / PNG / AVIF / RAW（大小写不敏感）
 * 2. MIME 复核：按文件头魔数判定真实类型，拒绝伪装扩展名的文件
 * 3. 大小限制：解码后 <= 10MB
 */

/** 扩展名白名单（小写） */
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.avif', '.raw'];

/** 允许的最大文件体积（解码后） */
const MAX_SIZE = 10 * 1024 * 1024;

/** 上传文件保存目录（后端统一静态目录内，/static 路由可直接访问） */
const UPLOAD_DIR = path.join(config.staticDir, 'uploads');

/** 上传后的对外 URL 前缀 */
const UPLOAD_URL_PREFIX = '/static/uploads/';

/**
 * 按文件头魔数识别真实类型（MIME 复核）
 * 说明：JPEG/PNG/AVIF 有明确魔数；RAW 为相机原始格式族，无统一魔数，
 * 仅按扩展名放行（主流 RAW 容器多为 TIFF 衍生，此处不做强校验，避免误杀）。
 */
function detectKind(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png';
  }
  // AVIF：ISO BMFF 容器，offset 4..8 为 "ftyp"，major brand 为 avif/avis/mif1
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') return 'avif';
  }
  return null;
}

/** 扩展名 -> 期望的真实类型（null 表示无魔数强校验，如 RAW） */
const EXPECTED_KIND = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.avif': 'avif',
  '.raw': null,
};

/**
 * 保存上传的图片
 */
exports.save = (req, res) => {
  const rawName = req.body && req.body.name;
  const rawData = req.body && req.body.data;

  // 0. 显式参数校验（缺失/类型错误给出明确提示，避免落到后续分支产生误导信息）
  if (typeof rawName !== 'string' || !rawName.trim()) {
    throw new HttpError(400, '参数缺失：name（原始文件名）为必填');
  }
  if (typeof rawData !== 'string' || !rawData) {
    throw new HttpError(400, '参数缺失：data（base64 文件内容）为必填');
  }

  // 1. 扩展名白名单（大小写不敏感）
  const ext = path.extname(rawName).toLowerCase();
  if (!ext || ALLOWED_EXT.indexOf(ext) === -1) {
    throw new HttpError(400, '不支持的图片类型，仅允许 JPG、PNG、AVIF、RAW 格式');
  }

  // 2. base64 解码并复核大小
  let buf;
  try {
    buf = Buffer.from(rawData, 'base64');
  } catch (err) {
    throw new HttpError(400, '图片数据无效，请重新选择文件');
  }
  if (!buf.length) throw new HttpError(400, '图片内容为空，请重新选择文件');
  if (buf.length > MAX_SIZE) {
    throw new HttpError(400, '图片过大（上限 10MB），请压缩后再上传');
  }

  // 3. MIME 复核：真实类型必须与扩展名声明一致，防止伪装文件
  const kind = detectKind(buf);
  const expected = EXPECTED_KIND[ext];
  if (expected && kind !== expected) {
    throw new HttpError(400, '文件内容与扩展名不符，已拒绝上传（疑似伪造的图片文件）');
  }

  // 4. 安全命名：随机名 + 白名单扩展名，杜绝原始文件名中的路径/特殊字符风险；
  //    极小概率的时间戳+随机数碰撞也用 existsSync 兜底重试，避免覆盖已有文件
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  let filename = '';
  for (let i = 0; i < 3; i += 1) {
    const candidate = 'img-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
    if (!fs.existsSync(path.join(UPLOAD_DIR, candidate))) {
      filename = candidate;
      break;
    }
  }
  if (!filename) throw new HttpError(500, '图片保存失败，请稍后重试');

  // 5. 落盘：失败时记录日志（不含用户数据内容）、返回统一业务错误，并清理可能残留的半写文件
  const target = path.join(UPLOAD_DIR, filename);
  try {
    fs.writeFileSync(target, buf);
  } catch (err) {
    console.error('[upload] 写入失败:', err.code || '', err.message);
    try { fs.unlinkSync(target); } catch (cleanupErr) { /* 目标不存在则忽略 */ }
    throw new HttpError(500, '图片保存失败，请稍后重试');
  }

  return ok(res, { url: UPLOAD_URL_PREFIX + filename }, '上传成功');
};
