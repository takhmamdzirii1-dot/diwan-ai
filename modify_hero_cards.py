import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

floating_cards_html = """
          <!-- 3 Floating Glassmorphic Preview Cards -->
          <div class="hero-floating-cards reveal-on-scroll stagger-4">
            <div class="floating-card float-1">
              <i class="fa-solid fa-message" style="color: var(--teal); font-size: 24px;"></i>
              <span>Claude 3.5 Sonnet</span>
            </div>
            <div class="floating-card float-2">
              <i class="fa-solid fa-image" style="color: var(--violet); font-size: 24px;"></i>
              <span>Flux.1 Pro</span>
            </div>
            <div class="floating-card float-3">
              <i class="fa-solid fa-play" style="color: var(--gold); font-size: 24px;"></i>
              <span>Kling AI 1.5</span>
            </div>
          </div>
"""

# Insert floating cards after hero-cta-group (before hero-guarantee)
pattern = re.compile(r'(<div class="hero-cta-group.*?>.*?</div>)', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(r'\1' + '\n' + floating_cards_html, content, count=1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
