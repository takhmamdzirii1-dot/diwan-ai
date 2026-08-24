import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

stats_html = """
          <div class="hero-stats reveal-on-scroll stagger-5">
            <div class="stat-item">
              <span class="stat-num">12+</span>
              <span class="stat-label">نموذج عالمي</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">100%</span>
              <span class="stat-label">دفع محلي</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">0s</span>
              <span class="stat-label">تفعيل فوري</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">99.9%</span>
              <span class="stat-label">جهوزية</span>
            </div>
          </div>
"""

pattern = re.compile(r'(<div class="hero-guarantee.*?>.*?</div>)', re.DOTALL)
if pattern.search(content) and '<div class="hero-stats' not in content:
    content = pattern.sub(r'\1' + '\n' + stats_html, content, count=1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
