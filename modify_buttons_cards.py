import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace btn-ghost
btn_ghost_pattern = re.compile(r'\.btn-ghost \{.*?\n\}', re.DOTALL)
btn_ghost_hover_pattern = re.compile(r'\.btn-ghost:hover \{.*?\n\}', re.DOTALL)

new_btn_ghost = """.btn-ghost {
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

new_btn_ghost_hover = """.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-medium);
  transform: translateY(-2px);
}"""

if btn_ghost_pattern.search(content):
    content = btn_ghost_pattern.sub(new_btn_ghost, content)
else:
    content += '\n' + new_btn_ghost

if btn_ghost_hover_pattern.search(content):
    content = btn_ghost_hover_pattern.sub(new_btn_ghost_hover, content)
else:
    content += '\n' + new_btn_ghost_hover

# Add general glass card style
glass_card = """
.feature-card, .model-card, .step-card, .pricing-card, .payment-option-card, .ticket-card, .ledger-table-wrapper {
  background: var(--glass);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}
.feature-card:hover, .model-card:hover, .step-card:hover, .pricing-card:hover, .payment-option-card:hover, .ticket-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-medium);
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}
.ticket-card.popular {
  border-color: var(--border-petrol);
  box-shadow: 0 12px 32px var(--petrol-glow);
}
.ticket-card.popular:hover {
  border-color: var(--petrol-500);
  box-shadow: 0 16px 40px var(--petrol-glow-strong);
}
"""
content += '\n' + glass_card

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
