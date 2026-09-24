# -*- coding: utf-8 -*-
"""
鲜花商品图片生成脚本
生成 18 张风格统一的 SVG 花束插画（无外部依赖、可离线使用）
运行：python scripts/gen_images.py
"""
import os
import math

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'assets', 'images')
FLOWER_DIR = os.path.join(OUT, 'flowers')
os.makedirs(FLOWER_DIR, exist_ok=True)

# (主色, 辅色, 中心色, 背景色1, 背景色2, 变体)
PALETTES = [
    ('#E23A4C', '#F26D78', '#FFD66B', '#FFF1F2', '#FFD9DD', 'rose'),      # 红玫瑰
    ('#E9A66B', '#F3C89B', '#8C5A2B', '#FFF7EE', '#F7E3CC', 'rose'),      # 香槟玫瑰
    ('#F27BA0', '#F9A8C0', '#FFE08A', '#FFF3F7', '#FBD8E4', 'daisy'),     # 粉玫瑰
    ('#7B6BE8', '#A79CF5', '#FFE9A8', '#F3F1FF', '#DED8FB', 'rose'),      # 蓝玫瑰
    ('#F5B324', '#FFD66B', '#7A4A12', '#FFF9E8', '#FFEFC2', 'daisy'),     # 向日葵
    ('#C9A7E8', '#E3D1F5', '#FFF0B8', '#FAF6FF', '#EADFFA', 'spray'),     # 满天星
    ('#F06FA6', '#C6A6F0', '#FFE6A8', '#FFF4F9', '#F3E0FA', 'bouquet'),   # 粉紫混搭
    ('#F2637E', '#F89BAB', '#FFE08A', '#FFF2F4', '#FBD9DF', 'carnation'), # 康乃馨
    ('#D8354A', '#EE7A83', '#FFD86B', '#FFF1F1', '#FBD5D7', 'carnation'),
    ('#EF7C8E', '#F8B6A0', '#FFE7A6', '#FFF5F3', '#FBDCD5', 'bouquet'),
    ('#F6F1E4', '#E9DFC7', '#F0B429', '#FBFAF5', '#EFEADF', 'lily'),      # 白百合
    ('#F4707A', '#F8B24C', '#FFE08A', '#FFF4F3', '#FCE0D5', 'tulip'),     # 郁金香
    ('#F2F0EB', '#DAD5C9', '#C9A227', '#FBFAF7', '#EDEAE3', 'lily'),
    ('#E4577A', '#F29BB0', '#FFE3A8', '#FFF3F6', '#FADCE5', 'rose'),
    ('#8FD1C2', '#BEE9DF', '#FFE7A8', '#F2FBFA', '#D9F2EC', 'bouquet'),
    ('#E8453C', '#F5A623', '#FFE08A', '#FFF3EE', '#FBDCC8', 'bouquet'),   # 开业花篮
    ('#3F8F5B', '#7BC49A', '#FFDF7A', '#F1FBF5', '#D8EFE3', 'spray'),
    ('#F3C1CF', '#E9E4F0', '#FFE9B0', '#FCFAFB', '#EFE6F0', 'tulip'),
]


def header(w, h, bg1, bg2, idx):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f'<defs>'
        f'<radialGradient id="bg{idx}" cx="50%" cy="35%" r="75%">'
        f'<stop offset="0%" stop-color="#FFFFFF"/><stop offset="55%" stop-color="{bg1}"/>'
        f'<stop offset="100%" stop-color="{bg2}"/></radialGradient>'
        f'<radialGradient id="core{idx}" cx="50%" cy="45%" r="60%">'
        f'<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".85"/>'
        f'<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>'
        f'</defs>'
        f'<rect width="{w}" height="{h}" fill="url(#bg{idx})"/>'
    )


def petal_ellipse(cx, cy, rx, ry, angle, fill, opacity=1.0, stroke=None):
    s = f' stroke="{stroke}" stroke-width="1.5"' if stroke else ''
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" '
            f'opacity="{opacity}"{s} transform="rotate({angle} {cx} {cy})"/>')


def rose(idx, main, sub, core):
    cx, cy = 200, 185
    parts = []
    for i in range(5):
        r = 92 - i * 16
        op = 0.55 + i * 0.09
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{main}" opacity="{op*0.35}"/>')
    # 螺旋花瓣
    for i in range(9):
        ang = i * 40
        rr = 78 - i * 7
        px = cx + rr * 0.55 * math.cos(math.radians(ang))
        py = cy + rr * 0.55 * math.sin(math.radians(ang))
        parts.append(petal_ellipse(px, py, 44 - i * 3, 34 - i * 2.5, ang, main if i % 2 == 0 else sub, 0.9))
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="26" fill="{core}"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="26" fill="url(#core{idx})"/>')
    return ''.join(parts)


def daisy(idx, main, sub, core):
    cx, cy = 200, 185
    parts = []
    n = 12
    for i in range(n):
        ang = i * (360 / n)
        px = cx + 62 * math.cos(math.radians(ang))
        py = cy + 62 * math.sin(math.radians(ang))
        parts.append(petal_ellipse(px, py, 30, 15, ang, main if i % 2 == 0 else sub, 0.95))
    for i in range(n):
        ang = i * (360 / n) + 15
        px = cx + 44 * math.cos(math.radians(ang))
        py = cy + 44 * math.sin(math.radians(ang))
        parts.append(petal_ellipse(px, py, 26, 12, ang, sub, 0.8))
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="30" fill="{core}"/>')
    for i in range(8):
        ang = i * 45
        px = cx + 16 * math.cos(math.radians(ang))
        py = cy + 16 * math.sin(math.radians(ang))
        parts.append(f'<circle cx="{px}" cy="{py}" r="3" fill="#FFFFFF" opacity=".6"/>')
    return ''.join(parts)


def lily(idx, main, sub, core):
    cx, cy = 200, 185
    parts = []
    n = 6
    for i in range(n):
        ang = i * (360 / n)
        pts = []
        for t in range(0, 101, 10):
            k = t / 100
            w = 30 * (1 - abs(2 * k - 1))
            length = 92
            x = cx + math.cos(math.radians(ang)) * length * k
            y = cy + math.sin(math.radians(ang)) * length * k
            nx = -math.sin(math.radians(ang)) * w
            ny = math.cos(math.radians(ang)) * w
            pts.append(f'{x+nx:.1f},{y+ny:.1f}')
        for t in range(100, -1, -10):
            k = t / 100
            w = 30 * (1 - abs(2 * k - 1))
            length = 92
            x = cx + math.cos(math.radians(ang)) * length * k
            y = cy + math.sin(math.radians(ang)) * length * k
            nx = -math.sin(math.radians(ang)) * w
            ny = math.cos(math.radians(ang)) * w
            pts.append(f'{x-nx:.1f},{y-ny:.1f}')
        color = main if i % 2 == 0 else sub
        parts.append(f'<polygon points="{" ".join(pts)}" fill="{color}" opacity=".95" stroke="#FFFFFF" stroke-width="1"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="22" fill="{core}"/>')
    for i in range(6):
        ang = i * 60
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{cx+56*math.cos(math.radians(ang)):.1f}" '
                     f'y2="{cy+56*math.sin(math.radians(ang)):.1f}" stroke="{core}" stroke-width="2" opacity=".7"/>')
    return ''.join(parts)


def tulip(idx, main, sub, core):
    parts = []
    cx = 200
    parts.append(f'<path d="M{cx} 300 Q{cx-14} 240 {cx-6} 200" stroke="#5FA36B" stroke-width="8" fill="none" stroke-linecap="round"/>')
    parts.append(f'<path d="M{cx-6} 255 Q{cx-70} 235 {cx-58} 200 Q{cx-30} 215 {cx-8} 240 Z" fill="#6FB47C"/>')
    parts.append(f'<path d="M{cx-6} 235 Q{cx+60} 215 {cx+52} 180 Q{cx+26} 200 {cx-8} 222 Z" fill="#7FBE87"/>')
    # 花杯
    parts.append(f'<path d="M{cx-52} 120 Q{cx-46} 200 {cx} 214 Q{cx+46} 200 {cx+52} 120 '
                 f'Q{cx+30} 150 {cx+14} 132 Q{cx+4} 152 {cx-14} 134 Q{cx-30} 152 {cx-52} 120 Z" fill="{main}"/>')
    parts.append(f'<path d="M{cx-24} 126 Q{cx-20} 190 {cx} 206 Q{cx+20} 190 {cx+24} 126 Z" fill="{sub}" opacity=".75"/>')
    parts.append(f'<ellipse cx="{cx}" cy="126" rx="52" ry="12" fill="{core}" opacity=".5"/>')
    return ''.join(parts)


def carnation(idx, main, sub, core):
    cx, cy = 200, 180
    parts = []
    for layer in range(3):
        r = 40 + layer * 26
        n = 8 + layer * 4
        for i in range(n):
            ang = i * (360 / n) + layer * 12
            px = cx + r * 0.6 * math.cos(math.radians(ang))
            py = cy + r * 0.6 * math.sin(math.radians(ang))
            color = main if i % 2 == 0 else sub
            parts.append(petal_ellipse(px, py, 22, 16, ang + 20, color, 0.85))
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="18" fill="{core}"/>')
    return ''.join(parts)


def spray(idx, main, sub, core):
    parts = []
    cx, cy = 200, 190
    for i in range(7):
        ang = -70 + i * 24
        length = 110 - abs(i - 3) * 12
        ex = cx + length * math.cos(math.radians(ang))
        ey = cy + length * math.sin(math.radians(ang))
        parts.append(f'<line x1="{cx}" y1="300" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#7FB48C" stroke-width="4" stroke-linecap="round"/>')
        for j in range(5):
            k = 0.35 + j * 0.16
            px = cx + (ex - cx) * k
            py = 300 + (ey - 300) * k
            r = 10 - j * 1.2
            for d in range(5):
                a = d * 72
                parts.append(f'<circle cx="{px + r*math.cos(math.radians(a)):.1f}" cy="{py + r*math.sin(math.radians(a)):.1f}" '
                             f'r="{r*0.55:.1f}" fill="{main if (i+j)%2==0 else sub}"/>')
            parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r*0.4:.1f}" fill="{core}"/>')
    return ''.join(parts)


def bouquet(idx, main, sub, core):
    parts = []
    # 包装纸
    parts.append('<path d="M120 340 L150 200 L250 200 L280 340 Z" fill="#FFFFFF" opacity=".55"/>')
    parts.append('<path d="M132 336 L158 208 L242 208 L268 336 Z" fill="#F7F2EC"/>')
    parts.append(f'<path d="M132 336 Q200 372 268 336 L268 300 Q200 336 132 300 Z" fill="{sub}" opacity=".65"/>')
    centers = [(168, 168, 40), (232, 158, 36), (200, 200, 44)]
    for i, (bx, by, br) in enumerate(centers):
        color = [main, sub, core][i % 3]
        for j in range(8):
            ang = j * 45 + i * 10
            px = bx + br * 0.62 * math.cos(math.radians(ang))
            py = by + br * 0.62 * math.sin(math.radians(ang))
            parts.append(petal_ellipse(px, py, br * 0.5, br * 0.36, ang, color, 0.92))
        parts.append(f'<circle cx="{bx}" cy="{by}" r="{br*0.28:.1f}" fill="#FFF6D8"/>')
        parts.append(f'<line x1="{bx}" y1="{by+br*0.5:.1f}" x2="{bx}" y2="300" stroke="#6FB47C" stroke-width="5" stroke-linecap="round"/>')
    parts.append(f'<path d="M170 300 Q200 316 230 300" stroke="{main}" stroke-width="8" fill="none" stroke-linecap="round"/>')
    return ''.join(parts)


VARIANTS = {'rose': rose, 'daisy': daisy, 'lily': lily, 'tulip': tulip,
            'carnation': carnation, 'spray': spray, 'bouquet': bouquet}


def stem_and_leaves(main):
    return (
        '<path d="M200 300 Q196 340 200 372" stroke="#5FA36B" stroke-width="7" fill="none" stroke-linecap="round"/>'
        '<path d="M200 330 Q150 320 138 286 Q180 292 200 322 Z" fill="#6FB47C"/>'
        '<path d="M200 348 Q252 340 262 306 Q220 312 200 340 Z" fill="#7FBE87"/>'
    )


def build(idx, palette):
    main, sub, core, bg1, bg2, variant = palette
    svg = [header(400, 400, bg1, bg2, idx)]
    svg.append(f'<g>{VARIANTS[variant](idx, main, sub, core)}</g>')
    if variant not in ('bouquet', 'spray', 'tulip'):
        svg.append(stem_and_leaves(main))
    # 装饰光点
    for i in range(6):
        ang = i * 60 + idx * 7
        px = 200 + 150 * math.cos(math.radians(ang))
        py = 190 + 150 * math.sin(math.radians(ang))
        svg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{2 + (i % 3)}" fill="{core}" opacity=".45"/>')
    svg.append('</svg>')
    return ''.join(svg)


for i, palette in enumerate(PALETTES, start=1):
    name = f'flower-{i:02d}.svg'
    with open(os.path.join(FLOWER_DIR, name), 'w', encoding='utf-8') as f:
        f.write(build(i, palette))

print(f'已生成 {len(PALETTES)} 张鲜花插画 -> {FLOWER_DIR}')
