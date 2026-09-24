'use strict';

const express = require('express');
const controller = require('../controllers/cart.controller');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

router.use(authRequired);

/** 购物车列表与金额汇总 */
router.get('/', asyncHandler(controller.list));
/** 加入购物车 */
router.post('/', asyncHandler(controller.add));
/** 数量徽标 */
router.get('/count', asyncHandler(controller.count));
/** 全选 / 取消全选 */
router.put('/check-all', asyncHandler(controller.checkAll));
/** 修改数量 */
router.put('/:id', asyncHandler(controller.update));
/** 勾选单个商品 */
router.put('/:id/check', asyncHandler(controller.check));
/** 删除单个商品 */
router.delete('/:id', asyncHandler(controller.remove));
/** 清空购物车 */
router.delete('/', asyncHandler(controller.clear));

module.exports = router;
