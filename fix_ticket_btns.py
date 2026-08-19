import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

new_ticket_btn = """.ticket-cta-btn {
  margin-top: auto;
  width: 100%;
  padding: 13px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--glass);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  transition: all 0.25s ease;
}

.ticket-cta-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.ticket-card.popular .ticket-cta-btn {
  background: linear-gradient(135deg, var(--teal), var(--teal-dim));
  color: #fff;
  border: none;
  box-shadow: 0 4px 18px var(--petrol-glow);
}

.ticket-card.popular .ticket-cta-btn:hover {
  background: linear-gradient(135deg, var(--teal-dim), var(--teal));
  box-shadow: 0 6px 24px var(--petrol-glow-strong);
}"""

content = re.sub(r'\.ticket-cta-btn \{.*?\.ticket-card\.popular \.ticket-cta-btn:hover \{.*?\}', new_ticket_btn, content, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
