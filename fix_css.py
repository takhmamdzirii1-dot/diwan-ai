with open('styles.css', 'r') as f:
    content = f.read()
content = content.replace("  100% { transform: translateY(-8px); }\n}\n", "")
with open('styles.css', 'w') as f:
    f.write(content)
