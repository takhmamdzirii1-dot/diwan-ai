import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Update .ledger-device to have glassmorphic background
new_ledger_device = """.ledger-device {
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  position: relative;
}"""

content = re.sub(r'\.ledger-device \{.*?\n\}', new_ledger_device, content, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
