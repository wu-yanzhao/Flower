# -*- coding: utf-8 -*-
"""
鲜花商品图片准备脚本
=================================================================
原 scripts/gen_images.py 负责离线生成「花朵 SVG 插画」，现已改为
**直接使用项目根目录 image/ 下的真实花材照片**进行展示，因此所有
SVG 绘制逻辑（path / 渐变 / 装饰光点 / 动画样式）已整体移除，本脚本
不再生成任何 SVG 文件。

本脚本的作用：把根目录 image/ 下的实拍照片复制到后端统一静态资源目录
server/static/flowers/，并以 ASCII 安全文件名命名，供后端 /static 静态路由
（见 server/src/app.js 的 app.use('/static', ...)）按
`/static/flowers/<name>` 直接加载。

注意：image/ 为可选的设计源目录；若已删除，运行本脚本会提示缺失并跳过，
实际花材照片已随仓库提交在 server/static/flowers/。

运行：python scripts/gen_images.py
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'image')
DST = os.path.join(ROOT, 'server', 'static', 'flowers')
os.makedirs(DST, exist_ok=True)

# (源文件名, 目标文件名) —— 目标文件名使用 ASCII，避免 URL/中文编码问题
MAP = [
    ('红玫瑰.avif', 'rose-red.avif'),
    ('香槟玫瑰.avif', 'rose-champagne.avif'),
    ('粉玫瑰.jpg', 'rose-pink.jpg'),
    ('蓝玫瑰.jpg', 'rose-blue.jpg'),
    ('白玫瑰.jpg', 'rose-white.jpg'),
    ('向日葵.jpg', 'sunflower.jpg'),
    ('满天星.jpg', 'babybreath.jpg'),
    ('粉色康乃馨.jpg', 'carnation-pink.jpg'),
    ('红色康乃馨.jpg', 'carnation-red.jpg'),
    ('通用康乃馨.jpg', 'carnation-common.jpg'),
    ('白色香水百合.jpg', 'lily-white.jpg'),
    ('郁金香.jpg', 'tulip.jpg'),
    ('永生花.jpg', 'preserved.jpg'),
    ('尤加利叶.jpg', 'eucalyptus.jpg'),
    ('忘忧草.jpg', 'daylily.jpg'),
]

copied = 0
missing = []
for src_name, dst_name in MAP:
    src = os.path.join(SRC, src_name)
    dst = os.path.join(DST, dst_name)
    if not os.path.exists(src):
        missing.append(src_name)
        continue
    shutil.copyfile(src, dst)
    copied += 1

print('已复制 %d 张花材照片 -> %s' % (copied, DST))
if missing:
    print('警告：以下源文件在 image/ 中缺失，未复制：' + ', '.join(missing))
