'use strict';

const express = require('express');
const controller = require('../controllers/order.controller');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

router.use(authRequired);

/** 我的订单列表 */
router.get('/', asyncHandler(controller.list));
/** 提交订单（购物车结算 / 立即购买） */
router.post('/', asyncHandler(controller.create));
/** 订单详情 */
router.get('/:id', asyncHandler(controller.detail));
/** 模拟支付 */
router.post('/:id/pay', asyncHandler(controller.pay));
/** 取消订单 */
router.post('/:id/cancel', asyncHandler(controller.cancel));
/** 确认收货 */
router.post('/:id/receive', asyncHandler(controller.receive));
/** 删除订单（仅限已取消） */
router.delete('/:id', asyncHandler(controller.remove));

module.exports = router;
