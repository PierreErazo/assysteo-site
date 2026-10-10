"""Génère les 4 documents FICTIFS de la démo « contrôle des documents » (site/demo/*.pdf).

À relancer tous les 2 à 3 mois : les dates sont calculées par rapport à aujourd'hui, pour que la
fiche de paie « correcte » reste récente et que l'ancienne reste trop ancienne.
Usage : python3 site/outils/generer_documents_demo.py
"""
import datetime as dt
import os

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "demo")
os.makedirs(SORTIE, exist_ok=True)
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def pdf(nom, pages):
    """pages : liste de pages ; une page = liste d'éléments (« t », x, y, taille, gras, texte) ou (« l », x1, y1, x2, y2)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"]
    kids = []
    for elements in pages:
        flux = []
        for e in elements:
            if e[0] == "t":
                _, x, y, taille, gras, texte = e
                t = texte.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                flux.append(f"BT /F{2 if gras else 1} {taille} Tf {x} {y} Td ({t}) Tj ET")
            else:
                _, x1, y1, x2, y2 = e
                flux.append(f"0.6 G 0.8 w {x1} {y1} m {x2} {y2} l S")
        contenu = "\n".join(flux).encode("cp1252")
        objs.append(b"<< /Length %d >>\nstream\n" % len(contenu) + contenu + b"\nendstream")
        n_contenu = len(objs)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {n_contenu} 0 R "
                    f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>")
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        corps = o if isinstance(o, bytes) else o.encode("cp1252")
        out += f"{i} 0 obj\n".encode() + corps + b"\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offs)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    open(os.path.join(SORTIE, nom), "wb").write(out)
    print(nom, len(out), "octets")


def pied(page_txt=""):
    return [("l", 50, 70, 545, 70),
            ("t", 50, 52, 8, False, "Exemple fictif pour la démonstration Assysteo (assysteo.be). Personnes, entreprises et numéros inventés."),
            ("t", 480, 52, 8, False, page_txt)]


def fiche_de_paie(nom_fichier, annee, mois):
    dernier = (dt.date(annee + (mois == 12), mois % 12 + 1, 1) - dt.timedelta(days=1))
    periode = f"{MOIS[mois - 1]} {annee}"
    e = [("t", 50, 790, 18, True, "FICHE DE PAIE"), ("t", 50, 770, 11, False, f"Période : du 01/{mois:02d}/{annee} au {dernier:%d/%m/%Y} ({periode})"),
         ("l", 50, 758, 545, 758),
         ("t", 50, 735, 10, True, "Employeur"), ("t", 50, 720, 10, False, "Boulangerie du Confluent SRL"),
         ("t", 50, 705, 10, False, "Rue de l'Exemple 12, 5000 Namur"),
         ("t", 50, 690, 10, False, "N° d'entreprise : 0000.000.000 (fictif)"),
         ("t", 340, 735, 10, True, "Travailleur"), ("t", 340, 720, 10, False, "Julie MARTIN"),
         ("t", 340, 705, 10, False, "Fonction : vendeuse, temps plein"),
         ("l", 50, 678, 545, 678),
         ("t", 50, 665, 10, True, "Rubrique"), ("t", 420, 665, 10, True, "Montant"),
         ("t", 50, 645, 10, False, "Salaire brut mensuel"), ("t", 420, 645, 10, False, "2.850,00 EUR"),
         ("t", 50, 627, 10, False, "Cotisations sociales personnelles (13,07 %)"), ("t", 420, 627, 10, False, "- 372,50 EUR"),
         ("t", 50, 609, 10, False, "Précompte professionnel"), ("t", 420, 609, 10, False, "- 410,20 EUR"),
         ("l", 50, 595, 545, 595),
         ("t", 50, 575, 11, True, "Salaire net à payer"), ("t", 420, 575, 11, True, "2.067,30 EUR"),
         ("t", 50, 545, 10, False, f"Date de paiement : {dernier:%d/%m/%Y}")] + pied("Page 1/1")
    pdf(nom_fichier, [e])


aujourdhui = dt.date.today()
m_recent = (aujourdhui.replace(day=1) - dt.timedelta(days=1))          # mois dernier
m_ancien = (aujourdhui.replace(day=1) - dt.timedelta(days=200)).replace(day=1)  # ~7 mois avant
fiche_de_paie("1-fiche-de-paie-recente.pdf", m_recent.year, m_recent.month)
fiche_de_paie("2-fiche-de-paie-trop-ancienne.pdf", m_ancien.year, m_ancien.month)

# 3. Extrait de compte : seule la page 1 sur 2 est fournie
debut = (aujourdhui.replace(day=1) - dt.timedelta(days=1)).replace(day=1)
fin = aujourdhui.replace(day=1) - dt.timedelta(days=1)
lignes = [("03", "Virement salaire Boulangerie du Confluent", "+ 2.067,30"), ("05", "Loyer appartement", "- 750,00"),
          ("08", "Supermarché", "- 86,40"), ("12", "Assurance auto", "- 64,90"), ("15", "Électricité et gaz", "- 118,00"),
          ("19", "Pharmacie", "- 23,15"), ("22", "Restaurant", "- 41,00"), ("26", "Retrait distributeur", "- 60,00")]
e = [("t", 50, 790, 18, True, "EXTRAIT DE COMPTE"), ("t", 50, 770, 10, False, "Banque Exemple, Namur (banque fictive)"),
     ("t", 50, 755, 10, False, f"Titulaire : Julie MARTIN    Période : {debut:%d/%m/%Y} au {fin:%d/%m/%Y}"),
     ("t", 50, 740, 10, False, "Compte : BE00 0000 0000 0000 (numéro fictif)"), ("l", 50, 728, 545, 728),
     ("t", 50, 710, 10, True, "Date"), ("t", 110, 710, 10, True, "Libellé"), ("t", 450, 710, 10, True, "Montant (EUR)")]
y = 690
for j, lib, mt in lignes:
    e += [("t", 50, y, 10, False, f"{j}/{debut:%m/%Y}"), ("t", 110, y, 10, False, lib), ("t", 450, y, 10, False, mt)]
    y -= 18
e += [("t", 50, y - 10, 10, True, "Suite des opérations et solde final : voir page 2")] + pied("Page 1/2")
pdf("3-extrait-de-compte-page-manquante.pdf", [e])

# 4. Certificat PEB
emis = aujourdhui - dt.timedelta(days=400)
e = [("t", 50, 790, 18, True, "CERTIFICAT PEB"), ("t", 50, 770, 10, False, "Performance énergétique d'un bâtiment résidentiel existant (Wallonie)"),
     ("l", 50, 758, 545, 758),
     ("t", 50, 735, 10, True, "Bâtiment"), ("t", 50, 720, 10, False, "Maison unifamiliale, rue des Exemples 8, 5100 Jambes"),
     ("t", 50, 705, 10, False, "Propriétaire : Marc DUBOIS"),
     ("t", 50, 680, 10, True, "Classe énergétique"), ("t", 50, 652, 30, True, "C"),
     ("t", 100, 660, 10, False, "Consommation spécifique : 245 kWh/m².an"),
     ("t", 100, 645, 10, False, "Consommation totale estimée : 32.400 kWh/an"),
     ("t", 50, 615, 10, False, f"Numéro du certificat : 00000000000000-0000 (fictif)    Établi le : {emis:%d/%m/%Y}"),
     ("t", 50, 600, 10, False, f"Valable jusqu'au : {emis.replace(year=emis.year + 10):%d/%m/%Y}"),
     ("t", 50, 585, 10, False, "Certificateur : Énergie Exemple SRL (agréé, fictif)")] + pied("Page 1/1")
pdf("4-certificat-peb.pdf", [e])
