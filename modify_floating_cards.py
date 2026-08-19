import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

floating_cards_css = """
/* Floating Cards Enhancements */
.hero-floating-cards {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
  flex-wrap: wrap;
}

.floating-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--glass);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 24px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  width: 140px;
  height: 140px;
  text-align: center;
}

.floating-card i {
  font-size: 36px;
  margin-bottom: 4px;
}

.float-1 { animation: float-card 6s ease-in-out infinite alternate; }
.float-2 { animation: float-card 7s ease-in-out infinite alternate -2s; transform: translateY(-20px); }
.float-3 { animation: float-card 8s ease-in-out infinite alternate -4s; }

@keyframes float-card {
  0% { transform: translateY(0); }
  100% { transform: translateY(-20px); }
}

@media (max-width: 768px) {
  .hero-floating-cards {
    flex-direction: column;
    gap: var(--space-3);
  }
  .floating-card {
    width: 100%;
    height: auto;
    flex-direction: row;
    padding: 16px;
    justify-content: flex-start;
  }
  .floating-card i {
    font-size: 24px;
    margin-bottom: 0;
  }
  .float-1, .float-2, .float-3 {
    animation-name: float-card-mobile;
  }
}
"""

content = re.sub(r'\.hero-floating-cards \{.*?\@keyframes float-card-mobile \{.*?\}', floating_cards_css, content, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
