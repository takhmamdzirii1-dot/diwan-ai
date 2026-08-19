import re
with open('styles.css', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "/* ==========================================================================" in line and "2. HERO SECTION & INTERACTIVE CREDIT LEDGER" in lines[i+1]:
        lines.insert(i, "}\n\n")
        break

with open('styles.css', 'w') as f:
    f.writelines(lines)
