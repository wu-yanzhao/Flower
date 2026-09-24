'use strict';

const express = require('express');
const statsController = require('../controllers/stats.controller');
const flowerController = require('../controllers/flower.controller');
const orderController = require('../controllers/order.controller');
const userController = require('../controllers/user.controller');
const reviewController = require('../controllers/review.controller');
const { adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

// 后台所有接口均需管理员权限
router.use(adminOnly);

/* ------------------------- 数据概览 ------------------------- */
router.get('/stats/overview', asyncHandler(statsController.overview));
router.get('/stats/trend', asyncHandler(statsController.trend));
router.get('/stats/top', asyncHandler(statsController.top));
router.get('/stats/category', asyncHandler(statsController.category));
router.get('/stats/status', asyncHandler(statsController.status));
router.get('/stats/recent', asyncHandler(statsController.recent));
router.get('/logs', asyncHandler(statsController.logs));

/* ------------------------- 商品管理 ------------------------- */
router.get('/flowers', asyncHandler(flowerController.adminList));
router.post('/flowers', asyncHandler(flowerController.create));
router.put('/flowers/:id', asyncHandler(flowerController.update));
router.put('/flowers/:id/status', asyncHandler(flowerController.setStatus));
router.put('/flowers/:id/stock', asyncHandler(flowerController.adjustStock));
router.delete('/flowers/:id', asyncHandler(flowerController.remove));

/* ------------------------- 订单管理 ------------------------- */
router.get('/orders', asyncHandler(orderController.adminList));
router.get('/orders/:id', asyncHandler(orderController.adminDetail));
router.post('/orders/:id/ship', asyncHandler(orderController.ship));
router.put('/orders/:id/status', asyncHandler(orderController.adminSetStatus));

/* ------------------------- 用户管理 ------------------------- */
router.get('/users', asyncHandler(userController.adminList));
router.post('/users', asyncHandler(userController.create));
router.put('/users/:id/status', asyncHandler(userController.setStatus));
router.put('/users/:id/password', asyncHandler(userController.resetPassword));

/* ------------------------- 评价管理 ------------------------- */
router.get('/reviews', asyncHandler(reviewController.adminList));
router.put('/reviews/:id/status', asyncHandler(reviewController.setStatus));
router.put('/reviews/:id/reply', asyncHandler(reviewController.reply));
router.delete('/reviews/:id', asyncHandler(reviewController.remove));

module.exports = router;
