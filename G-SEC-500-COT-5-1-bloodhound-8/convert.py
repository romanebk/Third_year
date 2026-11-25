import pypdf

# Remplacez "document.pdf" par le nom exact de votre fichier PDF
reader = pypdf.PdfReader("Dangerous_Services.pdf")
text = ""

for i, page in enumerate(reader.pages):
    text += f"--- Page {i+1} ---\n" + (page.extract_text() or "") + "\n\n"

with open("texte_extrait.txt", "w", encoding="utf-8") as f:
    f.write(text)

print("Extraction terminée ! Le fichier texte_extrait.txt a été créé.")
