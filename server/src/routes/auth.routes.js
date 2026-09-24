'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');

const router = express.Router();

/** 用户注册 */
router.post('/register', asyncHandler(controller.register));
/** 用户登录 */
router.post('/login', asyncHandler(controller.login));
/** 退出登录 */
router.post('/logout', authRequired, asyncHandler(controller.logout));
/** 获取当前登录用户信息 */
router.get('/profile', authRequired, asyncHandler(controller.profile));
/** 修改个人资料 */
router.put('/profile', authRequired, asyncHandler(controller.updateProfile));
/** 修改密码 */
router.put('/password', authRequired, asyncHandler(controller.changePassword));

module.exports = router;
