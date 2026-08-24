import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

new_root = """:root {
  /* VANTRA DESIGN SYSTEM */
  --bg: #08090C;
  --bg-soft: #0F1116;
  --glass: rgba(255,255,255,0.045);
  --glass-border: rgba(255,255,255,0.09);
  --teal: #1FD8B8;
  --teal-dim: #0EA98E;
  --gold: #F5B942;
  --violet: #6E6BFF;
  --text: #F5F6F8;
  --muted: rgba(245,246,248,0.6);

  --bg-base: var(--bg);
  --bg-surface: var(--bg-soft);
  --bg-surface-elevated: var(--glass);
  --bg-surface-hover: rgba(255,255,255,0.08);
  --bg-surface-active: rgba(255,255,255,0.12);
  --bg-subtle: var(--bg-soft);

  --petrol-50: #e0fbf6;
  --petrol-100: #b3f5e8;
  --petrol-300: var(--teal);
  --petrol-400: var(--teal);
  --petrol-500: var(--teal);
  --petrol-600: var(--teal-dim);
  --petrol-700: #0b806b;
  --petrol-900: #04382f;
  --petrol-glow: rgba(31, 216, 184, 0.22);
  --petrol-glow-strong: rgba(31, 216, 184, 0.45);

  --gold-300: #fae29c;
  --gold-400: var(--gold);
  --gold-500: var(--gold);
  --gold-600: #d69922;
  --gold-700: #b07c16;
  --gold-glow: rgba(245, 185, 66, 0.25);

  --sand-50: #f7f7f7;
  --sand-100: #ededed;
  --sand-200: #e3e3e3;
  --sand-300: #d1d1d1;
  --sand-400: #b0b0b0;

  --text-primary: var(--text);
  --text-secondary: var(--muted);
  --text-muted: var(--muted);
  --text-petrol: var(--teal);
  --text-gold: var(--gold);
  --text-inverse: var(--bg);

  --border-subtle: var(--glass-border);
  --border-medium: rgba(255, 255, 255, 0.15);
  --border-strong: rgba(255, 255, 255, 0.24);
  --border-petrol: rgba(31, 216, 184, 0.4);
  --border-gold: rgba(245, 185, 66, 0.45);

  --font-display: "Cairo", sans-serif;
  --font-sans: "Cairo", sans-serif;
  --font-mono: "IBM Plex Mono", "Courier New", monospace;
  --font-latin: "Space Grotesk", sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 12px 32px -4px rgba(0, 0, 0, 0.6);
  --shadow-lg: 0 24px 48px -8px rgba(0, 0, 0, 0.8);
  --shadow-ticket: 0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--border-subtle);
  --shadow-ticket-gold: 0 24px 60px -10px rgba(245, 185, 66, 0.18), 0 0 0 1px var(--border-gold);
}"""

content = re.sub(r':root\s*\{.*?\n\}', new_root, content, flags=re.DOTALL)
with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
