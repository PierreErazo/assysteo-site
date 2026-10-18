"""Contrôle du site Assysteo avant publication. Usage : python3 outils/verifier_site.py

Vérifie, pour chaque page HTML à la racine :
  - prix et places pilotes écrits dans le HTML (valeurs de secours) = ceux de config.js ;
  - prix des données structurées (JSON-LD) = ceux de config.js, JSON-LD valide ;
  - questions et réponses du FAQPage = celles affichées dans le tiroir « Tout savoir » (la réponse affichée peut ajouter un lien) ;
  - un seul <h1>, une URL canonique en https://assysteo.be/… présente dans sitemap.xml ;
  - liens internes : le fichier et l'ancre existent, jamais « index.html » ;
  - aucun tiret cadratin (—) ni demi-cadratin (–) dans le texte visible.
Sortie : la liste des problèmes (code de retour 1 s'il y en a), sinon « Tout est cohérent ».
"""
import html
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://assysteo.be/"


class Page(HTMLParser):
    """Relève ids, liens, h1, JSON-LD, texte visible et questions du tiroir."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.liens, self.h1, self.jsonld, self.texte = set(), [], 0, [], []
        self.canonique = None
        self.questions = []          # [question, réponse] lues dans les <details class="question">
        self._pile = []              # balises ouvertes ignorées (script, style)
        self._jsonld = False
        self._q = None               # question en cours : {"etat": "summary"|"reponse", "q": [], "r": [], "prof": n}
        self._prof = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in ("meta", "link", "img", "input", "br", "source", "hr"):
            self._prof += 1
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and a.get("href"):
            self.liens.append(a["href"])
        if tag == "h1":
            self.h1 += 1
        if tag == "link" and a.get("rel") == "canonical":
            self.canonique = a.get("href")
        if tag == "script":
            self._pile.append(tag)
            self._jsonld = a.get("type") == "application/ld+json"
        if tag == "style":
            self._pile.append(tag)
        if tag == "details" and "question" in (a.get("class") or "").split():
            self._q = {"etat": "attente", "q": [], "r": [], "prof": self._prof}
        if self._q and tag == "summary" and self._q["etat"] == "attente":
            self._q["etat"] = "summary"

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._pile:
            self._pile.pop()
            self._jsonld = False
        if self._q and tag == "summary" and self._q["etat"] == "summary":
            self._q["etat"] = "reponse"
        if self._q and tag == "details" and self._prof == self._q["prof"]:
            self.questions.append([norm("".join(self._q["q"])), norm("".join(self._q["r"]))])
            self._q = None
        if tag not in ("meta", "link", "img", "input", "br", "source", "hr"):
            self._prof -= 1

    def handle_data(self, data):
        if self._pile:
            if self._jsonld:
                self.jsonld.append(data)
            return
        self.texte.append(data)
        if self._q and self._q["etat"] == "summary":
            self._q["q"].append(data)
        elif self._q and self._q["etat"] == "reponse":
            self._q["r"].append(" " + data)


def norm(t):
    t = re.sub(r"\s+", " ", html.unescape(t).replace("\u00a0", " ").replace("\u202f", " ")).strip()
    return re.sub(r" ([.,)])", r"\1", t)


def chiffres(t):
    return re.sub(r"\D", "", t)


def lire_config():
    js = (RACINE / "config.js").read_text(encoding="utf-8")
    prix = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", js.split("var PRIX", 1)[1].split("};", 1)[0])}
    cfg = {k: int(v) for k, v in re.findall(r"var (PLACES_PILOTE_\w+)\s*=\s*(\d+)", js)}
    return prix, cfg


def main():
    prix, cfg = lire_config()
    problemes = []
    pages = sorted(p for p in RACINE.glob("*.html"))
    analyses = {}
    for p in pages:
        src = p.read_text(encoding="utf-8")
        a = Page()
        a.feed(src)
        analyses[p.name] = (src, a)
    sitemap = (RACINE / "sitemap.xml").read_text(encoding="utf-8")
    urls_sitemap = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))

    for nom, (src, a) in analyses.items():
        def pb(m):
            problemes.append(f"{nom} : {m}")
        sans_commentaires = re.sub(r"<!--.*?-->", "", src, flags=re.S)
        # 1. Valeurs de secours = config.js
        for cle, val in re.findall(r'data-prix="(\w+)">([^<]*)<', sans_commentaires):
            if cle not in prix:
                pb(f"prix inconnu data-prix=\"{cle}\"")
            elif chiffres(val) != str(prix[cle]):
                pb(f"prix {cle} = « {val} » dans le HTML, {prix[cle]} dans config.js")
        for cle, val in re.findall(r'data-cfg="(PLACES_PILOTE_\w+)">([^<]*)<', sans_commentaires):
            if cle in cfg and chiffres(val) != str(cfg[cle]):
                pb(f"{cle} = « {val} » dans le HTML, {cfg[cle]} dans config.js")
        for n, t in re.findall(r"<b>(\d+) places pilotes sur (\d+)</b>", sans_commentaires):
            if int(n) != cfg.get("PLACES_PILOTE_RESTANTES") or int(t) != cfg.get("PLACES_PILOTE_TOTAL"):
                pb(f"texte pilote « {n} places sur {t} » différent de config.js")
        # 2. JSON-LD valide, prix connus
        valeurs_prix = set(prix.values()) | {0}
        for bloc in a.jsonld:
            try:
                donnees = json.loads(bloc)
            except json.JSONDecodeError as e:
                pb(f"JSON-LD invalide : {e}")
                continue
            texte = json.dumps(donnees, ensure_ascii=False)
            for k, v in re.findall(r'"(price|minPrice)": "(\d+)"', texte):
                if int(v) not in valeurs_prix:
                    pb(f"JSON-LD : {k} {v} absent de config.js")
            # 3. FAQPage = tiroir
            faq = [x for x in donnees.get("@graph", [donnees]) if x.get("@type") == "FAQPage"]
            if faq:
                attendu = [[norm(q["name"]), norm(q["acceptedAnswer"]["text"])] for q in faq[0]["mainEntity"]]
                affiche = a.questions
                def simple(t):
                    return re.sub(r"euros?", "€", t).replace(" ?", "?")
                for q, r in attendu:
                    trouve = [x for x in affiche if simple(x[0]) == simple(q)]
                    if not trouve:
                        pb(f"FAQ JSON-LD : question absente du tiroir : « {q} »")
                    elif simple(r) not in simple(trouve[0][1]):
                        pb(f"FAQ JSON-LD : réponse différente du tiroir pour « {q} »")
        # 4. Un seul h1, canonique
        if a.h1 != 1:
            pb(f"{a.h1} balises <h1> (il en faut une)")
        attendu = SITE if nom == "index.html" else SITE + nom
        if a.canonique != attendu:
            pb(f"canonique « {a.canonique} », attendu « {attendu} »")
        if attendu not in urls_sitemap:
            pb(f"{attendu} absent de sitemap.xml")
        # 5. Liens internes
        for href in a.liens:
            if href.startswith(("http", "mailto:", "tel:")):
                if href.startswith(SITE) or href.startswith("https://www.assysteo"):
                    pb(f"lien absolu vers le site lui-même : {href} (utiliser un chemin /…)")
                continue
            if "index.html" in href:
                pb(f"lien vers index.html : {href}")
            chemin, _, ancre = href.partition("#")
            if chemin in ("", None):
                cible = nom
            else:
                cible = "index.html" if chemin == "/" else chemin.lstrip("/")
            if cible not in analyses:
                pb(f"lien cassé : {href}")
                continue
            if ancre and ancre not in ("ferme",) and ancre not in analyses[cible][1].ids:
                pb(f"ancre introuvable : {href}")
        # 6. Tirets interdits dans le texte visible
        visible = "".join(a.texte)
        for m in re.finditer(r"[—–]", visible):
            extrait = visible[max(0, m.start() - 30): m.end() + 30].replace("\n", " ")
            pb(f"tiret interdit : « …{extrait}… »")

    for url in urls_sitemap:
        fichier = "index.html" if url == SITE else url.replace(SITE, "")
        if fichier not in analyses:
            problemes.append(f"sitemap.xml : {url} ne correspond à aucun fichier")

    if problemes:
        print("\n".join(problemes))
        print(f"\n{len(problemes)} problème(s).")
        sys.exit(1)
    print(f"Tout est cohérent ({len(pages)} pages).")


if __name__ == "__main__":
    main()
