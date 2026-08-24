import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

logo_pattern = re.compile(r'\.logo-badge \{.*?\n\}', re.DOTALL)
new_logo = """.logo-badge {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--teal), var(--violet));
  border: 1px solid var(--border-subtle);
  box-shadow: 0 0 16px var(--petrol-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-family: var(--font-latin);
  font-size: 24px;
  font-weight: 800;
}"""

if logo_pattern.search(content):
    content = logo_pattern.sub(new_logo, content)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
