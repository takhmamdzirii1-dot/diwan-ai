import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# First, remove the injected hero-stats
content = re.sub(r'          <div class="hero-stats reveal-on-scroll stagger-5">.*?</div>\n          </div>', '', content, flags=re.DOTALL)

# Let's cleanly replace the entire hero-guarantee and add stats below it
new_guarantee = """          <div class="hero-guarantee reveal-on-scroll stagger-4">
            <div class="guarantee-item">
              <i class="fa-solid fa-circle-check"></i>
              <span>دفع آمن بالذهبية & CIB</span>
            </div>
            <div class="guarantee-item">
              <i class="fa-solid fa-shield-halved"></i>
              <span>نقاط غير منتهية الصلاحية</span>
            </div>
            <div class="guarantee-item">
              <i class="fa-solid fa-rotate"></i>
              <span>بدون أي التزام شهري</span>
            </div>
          </div>

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
          </div>"""

# Search for the starting of hero-guarantee until "بدون أي التزام شهري</span>\n            </div>\n          </div>"
pattern = re.compile(r'          <div class="hero-guarantee reveal-on-scroll stagger-4">.*?بدون أي التزام شهري</span>\n            </div>\n          </div>', re.DOTALL)
content = pattern.sub(new_guarantee, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
