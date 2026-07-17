import os

root = r'C:\Users\Syed Emio\Desktop\FleksiTaskJobMarketPlace\frontend\web\src\pages'
for f in sorted(os.listdir(root)):
    if not f.endswith('.jsx') or f == 'Login.jsx':
        continue
    path = os.path.join(root, f)
    with open(path, 'r', encoding='utf-8') as fp:
        content = fp.read()
    if 'useAutoRefresh' in content:
        print(f'  SKIP {f}')
        continue
    # Add import after 'from react'
    content = content.replace(
        "from 'react'",
        "from 'react'\nimport { useAutoRefresh } from '../utils/useAutoRefresh'"
    )
    lines = content.split('\n')
    new_lines = []
    hook_added = False
    for line in lines:
        new_lines.append(line)
        if not hook_added and 'useEffect' in line and 'load()' in line:
            new_lines.append('')
            new_lines.append('  // Auto-refresh every 30 seconds')
            new_lines.append('  useAutoRefresh(load)')
            hook_added = True
    with open(path, 'w', encoding='utf-8') as fp:
        fp.write('\n'.join(new_lines))
    print(f'  DONE {f}')