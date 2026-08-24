import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

new_header = """.header {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
  background: rgba(8, 9, 12, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  transition: all 0.3s ease;
}"""

content = re.sub(r'\.header \{.*?transition: all 0\.3s ease;\n\}', new_header, content, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
