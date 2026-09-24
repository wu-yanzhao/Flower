'use strict';

const express = require('express');
const categoryController = require('../controllers/category.controller');
const flowerController = require('../controllers/flower.controller');
const { authOptional, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

/* ------------------------- 商品分类 ------------------------- */
/** 前台：分类列表 */
router.get('/categories', asyncHandler(categoryController.list));
/** 后台：新增 / 修改 / 删除分类 */
router.post('/categories', adminOnly, asyncHandler(categoryController.create));
router.put('/categories/:id', adminOnly, asyncHandler(categoryController.update));
router.delete('/categories/:id', adminOnly, asyncHandler(categoryController.remove));

/* ------------------------- 鲜花商品 ------------------------- */
/** 首页推荐位（必须放在 /flowers/:id 之前） */
router.get('/flowers/recommend', asyncHandler(flowerController.recommend));
/** 商品列表（支持搜索、筛选、排序、分页） */
router.get('/flowers', asyncHandler(flowerController.list));
/** 商品详情（登录可选，用于显示收藏状态） */
router.get('/flowers/:id', authOptional, asyncHandler(flowerController.detail));
/** 商品评价 */
router.get('/flowers/:id/reviews', asyncHandler(flowerController.reviews));

module.exports = router;
