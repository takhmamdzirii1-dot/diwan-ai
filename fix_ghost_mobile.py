import re
with open('styles.css', 'r') as f:
    content = f.read()

# Replace the wrong block inside the media query
wrong_block = """.header-actions .btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 10px 22px;
  border-radius: var(--radius-full);
  background: var(--glass);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}"""

correct_block = """.header-actions .btn-ghost {
    display: none;
  }"""

content = content.replace(wrong_block, correct_block)

with open('styles.css', 'w') as f:
    f.write(content)
