#!/usr/bin/env python3
"""给 src/index.html 注入「后端地址」功能。可重复执行（已打过补丁会跳过）。
用法: python3 scripts/patch_index.py [path/to/index.html]"""
import re, sys, pathlib

p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'src/index.html')
if not p.exists():
    sys.exit(f'找不到 {p}：请把你的网页文件放到 src/index.html')
s = p.read_text(encoding='utf-8-sig')
if 'shim.js' in s:
    print('已打过补丁，跳过'); sys.exit(0)
if '请用你自己的 index.html 覆盖本文件' in s or '<script' not in s:
    sys.exit('src/index.html 还是占位文件（或不是完整网页）：请在 GitHub 仓库里用你自己的网页文件覆盖 src/index.html 后重新运行')
print(f'读取 {p}，{len(s)} 字符')

def need(label, ok):
    if not ok:
        sys.exit(f'补丁失败：没找到「{label}」。网页开头 300 字符：\n{s[:300]!r}')

# 1) viewport：有则加 viewport-fit=cover，没有就插入
m = re.search(r"""<meta[^>]*name=["']viewport["'][^>]*>""", s, re.I)
if m:
    tag = m.group(0)
    if 'viewport-fit' not in tag:
        new = re.sub(r"""(content=["'])""", r"\1viewport-fit=cover, ", tag, count=1, flags=re.I)
        s = s.replace(tag, new, 1)
else:
    m2 = re.search(r'<head[^>]*>', s, re.I)
    need('<head>', m2)
    s = s[:m2.end()] + '\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + s[m2.end():]

# 2) 引入 shim.js
m = re.search(r'</head>', s, re.I)
need('</head>', m)
s = s[:m.start()] + '<script src="shim.js"></script>\n' + s[m.start():]

# 3) 后端按钮：优先放在刷新按钮前，其次 <header> 内，最后悬浮按钮
btn = '<button id="backend" title="设置后端地址">🔗 后端</button>\n  '
m = re.search(r"""<button[^>]*id=["']refresh["']""", s)
if m:
    s = s[:m.start()] + btn + s[m.start():]
else:
    m = re.search(r'<header[^>]*>', s, re.I)
    if m:
        s = s[:m.end()] + '\n  ' + btn + s[m.end():]
    else:
        m = re.search(r'<body[^>]*>', s, re.I)
        need('<body>', m)
        s = s[:m.end()] + '\n<button id="backend" style="position:fixed;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:20">🔗 后端</button>' + s[m.end():]

# 4) 下载链接补全后端地址（找不到只警告）
if 'a.href=await getFull()' in s:
    s = s.replace('a.href=await getFull()', 'a.href=window.absUrl(await getFull())', 1)
else:
    print('警告：没找到下载按钮代码，跳过')

# 5) 启动入口：最后一个 </script> 之前的独立 init();
ms = list(re.finditer(r'(^|\n)[ \t]*init\(\);[ \t]*(?=\s*</script>)', s))
need('init(); 启动语句', ms)
m = ms[-1]
s = s[:m.start()] + '\n(window.BACKEND&&!BACKEND.ready())?BACKEND.show():init();' + s[m.end():]

p.write_text(s, encoding='utf-8')
print('补丁完成:', p)
