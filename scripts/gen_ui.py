# -*- coding: utf-8 -*-
"""生成界面装饰素材：首页主视觉、登录页插画、默认头像、占位图、favicon"""
import os
import math

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'assets', 'images')
UI = os.path.join(BASE, 'ui')
os.makedirs(UI, exist_ok=True)


def ellipse(cx, cy, rx, ry, angle, fill, opacity=1.0):
    return (f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx}" ry="{ry}" fill="{fill}" '
            f'opacity="{opacity}" transform="rotate({angle} {cx:.1f} {cy:.1f})"/>')


def flower(cx, cy, r, main, sub, core, petals=8):
    out = []
    for i in range(petals):
        ang = i * (360 / petals)
        px = cx + r * 0.6 * math.cos(math.radians(ang))
        py = cy + r * 0.6 * math.sin(math.radians(ang))
        out.append(ellipse(px, py, r * 0.46, r * 0.34, ang, main if i % 2 == 0 else sub, 0.95))
    out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r*0.26:.1f}" fill="{core}"/>')
    return ''.join(out)


# ---------------- 首页主视觉：大花束 ----------------
def hero():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" width="420" height="420">']
    parts.append('<defs><radialGradient id="hg" cx="50%" cy="40%" r="65%">'
                 '<stop offset="0%" stop-color="#FFFFFF" stop-opacity=".9"/>'
                 '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>')
    # 包装纸
    parts.append('<path d="M120 400 L152 230 L268 230 L300 400 Z" fill="#FFFFFF" opacity=".7"/>')
    parts.append('<path d="M134 400 L164 244 L256 244 L286 400 Z" fill="#FDF3EC"/>')
    parts.append('<path d="M134 400 Q210 430 286 400 L286 350 Q210 380 134 350 Z" fill="#F3D9C6"/>')
    parts.append('<path d="M210 400 L164 250 L256 250 Z" fill="#FFFFFF" opacity=".35"/>')
    # 花茎
    for i, ang in enumerate([-26, -12, 0, 12, 26]):
        rad = math.radians(ang - 90)
        x2 = 210 + 110 * math.cos(rad)
        y2 = 250 + 110 * math.sin(rad)
        parts.append(f'<line x1="210" y1="380" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#6FB47C" stroke-width="6" stroke-linecap="round"/>')
        parts.append(f'<path d="M{x2:.1f} {y2:.1f} q-30 -12 -34 -40 q26 6 34 40 z" fill="#7FBE87" opacity=".9"/>')
    # 花朵
    bouquet = [
        (150, 168, 44, '#E4577A', '#F58AA4', '#FFE3A8'),
        (270, 158, 40, '#F5B324', '#FFD66B', '#8C5A2B'),
        (210, 128, 46, '#F27BA0', '#F9A8C0', '#FFE08A'),
        (168, 232, 34, '#C9A7E8', '#E3D1F5', '#FFF0B8'),
        (256, 230, 34, '#FF8F6B', '#FFB99E', '#FFE9B0'),
    ]
    for cx, cy, r, m, s, c in bouquet:
        parts.append(flower(cx, cy, r, m, s, c, petals=8))
    # 光斑
    parts.append('<circle cx="80" cy="90" r="6" fill="#FFD9A8" opacity=".7"/>')
    parts.append('<circle cx="340" cy="110" r="4" fill="#F9A8C0" opacity=".7"/>')
    parts.append('<circle cx="330" cy="300" r="5" fill="#BEE9DF" opacity=".8"/>')
    parts.append('<rect width="420" height="420" fill="url(#hg)"/>')
    parts.append('</svg>')
    return ''.join(parts)


# ---------------- 登录页插画 ----------------
def auth_art():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 300" width="320" height="300">']
    parts.append('<ellipse cx="160" cy="272" rx="120" ry="16" fill="#F3DCE3" opacity=".6"/>')
    # 礼盒
    parts.append('<rect x="96" y="176" width="128" height="92" rx="10" fill="#F58AA4"/>')
    parts.append('<rect x="88" y="160" width="144" height="28" rx="8" fill="#E4577A"/>')
    parts.append('<rect x="150" y="160" width="20" height="108" fill="#FFE3A8"/>')
    parts.append('<path d="M160 160 q-22 -30 -6 -44 q20 -4 26 22 z" fill="#FFD66B"/>')
    parts.append('<path d="M160 160 q22 -30 6 -44 q-20 -4 -26 22 z" fill="#F5B324"/>')
    # 花
    parts.append(flower(120, 120, 40, '#F27BA0', '#F9A8C0', '#FFE08A'))
    parts.append(flower(200, 108, 34, '#C9A7E8', '#E3D1F5', '#FFF0B8'))
    parts.append(flower(160, 78, 30, '#FF8F6B', '#FFB99E', '#FFE9B0'))
    parts.append('<circle cx="60" cy="70" r="5" fill="#FFD9A8"/>')
    parts.append('<circle cx="270" cy="60" r="4" fill="#F9A8C0"/>')
    parts.append('<circle cx="258" cy="212" r="6" fill="#BEE9DF"/>')
    parts.append('</svg>')
    return ''.join(parts)


def avatar():
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">'
            '<defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0%" stop-color="#FF9DB3"/><stop offset="100%" stop-color="#E4577A"/>'
            '</linearGradient></defs>'
            '<rect width="80" height="80" rx="40" fill="url(#ag)"/>'
            '<circle cx="40" cy="31" r="13" fill="#FFFFFF" opacity=".92"/>'
            '<path d="M14 74 q26 -26 52 0 z" fill="#FFFFFF" opacity=".92"/></svg>')


def no_image():
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
            '<rect width="200" height="200" rx="16" fill="#F7EFF1"/>'
            '<circle cx="100" cy="86" r="26" fill="#F3DCE3"/>'
            '<circle cx="100" cy="86" r="10" fill="#E9C6CF"/>'
            '<path d="M100 112 v46" stroke="#E9C6CF" stroke-width="8" stroke-linecap="round"/>'
            '<text x="100" y="182" text-anchor="middle" font-size="14" fill="#C9AEB4" '
            'font-family="Microsoft YaHei">暂无图片</text></svg>')


def favicon():
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">'
            '<circle cx="20" cy="20" r="19" fill="#E4577A"/>'
            '<g fill="#fff">'
            '<ellipse cx="20" cy="11" rx="5" ry="7"/><ellipse cx="29" cy="20" rx="7" ry="5"/>'
            '<ellipse cx="20" cy="29" rx="5" ry="7"/><ellipse cx="11" cy="20" rx="7" ry="5"/>'
            '</g><circle cx="20" cy="20" r="4.5" fill="#FFE9A8"/></svg>')


files = {
    'hero.svg': hero(),
    'auth-art.svg': auth_art(),
    'avatar-default.svg': avatar(),
    'no-image.svg': no_image(),
    'favicon.svg': favicon(),
}
for name, content in files.items():
    with open(os.path.join(UI, name), 'w', encoding='utf-8') as f:
        f.write(content)
print('UI 素材已生成：', ', '.join(files.keys()))
