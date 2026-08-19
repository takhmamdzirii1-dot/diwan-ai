with open('styles.css', 'r') as f:
    content = f.read()
content = content.replace("}\n\n/* ==========================================================================\n   VANTRA AMBIENT BACKGROUND", "}\n}\n\n/* ==========================================================================\n   VANTRA AMBIENT BACKGROUND")
with open('styles.css', 'w') as f:
    f.write(content)
