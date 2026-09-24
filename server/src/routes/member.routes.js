'use strict';

const express = require('express');
const addressController = require('../controllers/address.controller');
const favoriteController = require('../controllers/favorite.controller');
const reviewController = require('../controllers/review.controller');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

/* ------------------------- 收货地址 ------------------------- */
router.get('/addresses', authRequired, asyncHandler(addressController.list));
router.post('/addresses', authRequired, asyncHandler(addressController.create));
router.put('/addresses/:id', authRequired, asyncHandler(addressController.update));
router.put('/addresses/:id/default', authRequired, asyncHandler(addressController.setDefault));
router.delete('/addresses/:id', authRequired, asyncHandler(addressController.remove));

/* ------------------------- 我的收藏 ------------------------- */
router.get('/favorites', authRequired, asyncHandler(favoriteController.list));
router.post('/favorites/toggle', authRequired, asyncHandler(favoriteController.toggle));
router.delete('/favorites/:id', authRequired, asyncHandler(favoriteController.remove));

/* ------------------------- 订单评价 ------------------------- */
router.post('/reviews', authRequired, asyncHandler(reviewController.create));
router.get('/reviews/mine', authRequired, asyncHandler(reviewController.mine));

module.exports = router;
