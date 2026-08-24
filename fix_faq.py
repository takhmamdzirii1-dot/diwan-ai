import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

new_faq = """.faq-item {
  background: var(--glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.25s ease;
}"""

content = re.sub(r'\.faq-item \{.*?\n\}', new_faq, content, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
