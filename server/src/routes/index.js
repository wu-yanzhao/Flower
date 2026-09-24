'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const catalogRoutes = require('./catalog.routes');
const cartRoutes = require('./cart.routes');
const orderRoutes = require('./order.routes');
const memberRoutes = require('./member.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

/** 健康检查 & 系统信息 */
router.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: '服务运行正常',
    data: {
      name: '鲜花订购与管理系统',
      version: '1.0.0',
      time: new Date().toLocaleString('zh-CN'),
      driver: req.app.locals.driver,
    },
  });
});

router.use('/auth', authRoutes);
// 商品 / 分类（路由内部已带 /flowers、/categories 前缀）
router.use('/', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
// 地址 / 收藏 / 评价（路由内部已带各自前缀）
router.use('/', memberRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
