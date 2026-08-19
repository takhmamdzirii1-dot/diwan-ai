import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Make html and body background transparent so ambient-bg shows through
content = re.sub(r'(html\s*\{[^}]*?background-color:\s*)var\(--bg-base\);', r'\1transparent;', content)
content = re.sub(r'(body\s*\{[^}]*?background-color:\s*)var\(--bg-base\);', r'\1transparent;', content)

# Make main header glassmorphic too if it isn't
header_glass = """
.main-header {
  background: rgba(8, 9, 12, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
}
"""
if "rgba(8, 9, 12, 0.6)" not in content:
    content += '\n' + header_glass

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
