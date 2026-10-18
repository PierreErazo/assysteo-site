"""Contrôle du site Assysteo avant publication. Usage : python3 outils/verifier_site.py

Vérifie, pour chaque page HTML à la racine :
  - valeurs de secours du HTML (prix, places pilotes, adresses des formulaires) = config.js ;
  - JSON-LD valide, et chaque prix rattaché au bon tarif de config.js (Essentiel, Croissance,
    diagnostic écrit, priceRange) ; nombre de places pilotes cité = PLACES_PILOTE_TOTAL ;
  - FAQPage = questions du tiroir « Tout savoir », dans les deux sens et dans le même ordre ;
  - un seul <h1>, lang="fr-BE", canonique = og:url = dernier élément du fil d'Ariane, présente dans
    sitemap.xml ; titres et descriptions uniques, de longueur raisonnable ; og:image présente ;
  - liens internes (pages, ancres, fichiers) et liens écrits par les scripts ; jamais « index.html »,
    « www. » ni « http:// » ;
  - valeurs par défaut des scripts (anim.js, diagnostic.js) = config.js ;
  - aucun tiret cadratin (—) ni demi-cadratin (–) dans le texte visible.
Sortie : la liste des problèmes (code de retour 1 s'il y en a), sinon « Tout est cohérent ».
Les avertissements (longueurs) ne bloquent pas.
"""
import html
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

RACINE = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://assysteo.be/"
NOMBRES = {"deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6}
VIDES = ("meta", "link", "img", "input", "br", "source", "hr")


class Page(HTMLParser):
    """Relève ids, liens, h1, métadonnées, JSON-LD, texte visible et questions du tiroir."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.liens, self.h1, self.jsonld, self.texte = set(), [], 0, [], []
        self.meta, self.lang, self.titre = {}, None, ""
        self.questions = []          # [question, réponse] des <details class="question">
        self.a_cfg = []              # (href, nom de la constante) des liens data-cfg-href
        self.a_demo = []             # href des liens data-demo-docs
        self.places = []             # [nombre de pastilles, dont libres] par bloc .places
        self._pile, self._jsonld, self._titre, self._q, self._prof = [], False, False, None, 0
        self._places_prof = None      # profondeur du bloc .places ouvert

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VIDES:
            self._prof += 1
        if tag == "html":
            self.lang = a.get("lang")
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and a.get("href"):
            self.liens.append(a["href"])
            if "data-cfg-href" in a:
                self.a_cfg.append((a["href"], a["data-cfg-href"]))
            if "data-demo-docs" in a:
                self.a_demo.append(a["href"])
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self._titre = True
        if tag == "link" and a.get("rel") == "canonical":
            self.meta["canonical"] = a.get("href")
        if tag == "meta":
            cle = a.get("name") or a.get("property")
            if cle:
                self.meta[cle] = a.get("content", "")
        if tag == "div" and "places" in (a.get("class") or "").split():
            self.places.append([0, 0])
            self._places_prof = self._prof
        if tag == "i" and self._places_prof is not None:
            self.places[-1][0] += 1
            if "libre" in (a.get("class") or "").split():
                self.places[-1][1] += 1
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
        if tag == "title":
            self._titre = False
        if tag in ("script", "style") and self._pile:
            self._pile.pop()
            self._jsonld = False
        if self._q and tag == "summary" and self._q["etat"] == "summary":
            self._q["etat"] = "reponse"
        if self._q and tag == "details" and self._prof == self._q["prof"]:
            self.questions.append([norm("".join(self._q["q"])), norm("".join(self._q["r"]))])
            self._q = None
        if tag == "div" and self._places_prof is not None and self._prof == self._places_prof:
            self._places_prof = None
        if tag not in VIDES:
            self._prof -= 1

    def handle_data(self, data):
        if self._titre:
            self.titre += data
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
    t = re.sub(r"\s+", " ", html.unescape(t).replace(" ", " ").replace(" ", " ")).strip()
    return re.sub(r" ([.,)])", r"\1", t)


def simple(t):
    return re.sub(r"\beuros?\b", "€", norm(t)).replace(" ?", "?").replace(" :", ":")


def chiffres(t):
    return re.sub(r"\D", "", t)


def lire_config():
    js = (RACINE / "config.js").read_text(encoding="utf-8")
    bloc = lambda nom: js.split(f"var {nom}", 1)[1].split("};", 1)[0]
    prix = {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", bloc("PRIX"))}
    calcul = {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", bloc("CALCUL"))}
    cfg = {k: int(v) for k, v in re.findall(r"var (PLACES_PILOTE_\w+)\s*=\s*(\d+)", js)}
    urls = dict(re.findall(r"var (URL_\w+)\s*=\s*'([^']*)'", js))
    return prix, calcul, cfg, urls


def objets(x):
    """Tous les objets d'un JSON, à toute profondeur."""
    if isinstance(x, dict):
        yield x
        for v in x.values():
            yield from objets(v)
    elif isinstance(x, list):
        for v in x:
            yield from objets(v)


def tarif(nom_offre):
    n = (nom_offre or "").lower()
    if "croissance" in n:
        return "croissance"
    if "diagnostic écrit" in n:
        return "diagnostic"
    if "audit" in n or "découverte" in n:
        return "gratuit"
    return "essentiel"            # offre d'un Service métier, ou « Essentiel »


def main():
    prix, calcul, cfg, urls = lire_config()
    problemes, avertissements = [], []
    pages = sorted(RACINE.glob("*.html"))
    analyses = {}
    for p in pages:
        src = p.read_text(encoding="utf-8")
        a = Page()
        a.feed(src)
        analyses[p.name] = (src, a)
    urls_sitemap = set(re.findall(r"<loc>([^<]+)</loc>", (RACINE / "sitemap.xml").read_text(encoding="utf-8")))
    titres, descriptions = {}, {}
    total = cfg.get("PLACES_PILOTE_TOTAL")

    def existe(chemin, ancre, nom_courant):
        """Vrai si le lien interne mène à une page (et une ancre) ou à un fichier existant."""
        cible = nom_courant if chemin == "" else ("index.html" if chemin == "/" else chemin.lstrip("/"))
        if cible in analyses:
            return not ancre or ancre == "ferme" or ancre in analyses[cible][1].ids
        return (RACINE / cible).is_file() and not ancre

    for nom, (src, a) in analyses.items():
        def pb(m):
            problemes.append(f"{nom} : {m}")
        sans_commentaires = re.sub(r"<!--.*?-->", "", src, flags=re.S)
        # 1. Valeurs de secours = config.js
        for cle, val in re.findall(r'data-prix="(\w+)">([^<]*)<', sans_commentaires):
            if cle not in prix:
                pb(f"prix inconnu data-prix=\"{cle}\"")
            elif chiffres(val) != str(int(prix[cle])):
                pb(f"prix {cle} = « {val} » dans le HTML, {int(prix[cle])} dans config.js")
        for cle, val in re.findall(r'data-cfg="(PLACES_PILOTE_\w+)">([^<]*)<', sans_commentaires):
            if cle in cfg and chiffres(val) != str(cfg[cle]):
                pb(f"{cle} = « {val} » dans le HTML, {cfg[cle]} dans config.js")
        for n, t in re.findall(r"<b>(\d+) places pilotes sur (\d+)</b>", sans_commentaires):
            if int(n) != cfg.get("PLACES_PILOTE_RESTANTES") or int(t) != total:
                pb(f"texte pilote « {n} places sur {t} » différent de config.js")
        for n_total, n_libres in a.places:
            if n_total != total or n_libres != cfg.get("PLACES_PILOTE_RESTANTES"):
                pb(f"pastilles pilotes : {n_libres} libres sur {n_total}, config.js dit {cfg.get('PLACES_PILOTE_RESTANTES')} sur {total}")
        for href, nom_cfg in a.a_cfg:
            if nom_cfg not in urls:
                pb(f"data-cfg-href=\"{nom_cfg}\" absent de config.js")
            elif urls[nom_cfg] and href != urls[nom_cfg]:
                pb(f"lien {nom_cfg} = {href}, config.js dit {urls[nom_cfg]}")
        for href in a.a_demo:
            if urls.get("URL_DEMO_DOCUMENTS") and href != urls["URL_DEMO_DOCUMENTS"]:
                pb(f"lien de la démo = {href}, config.js dit {urls['URL_DEMO_DOCUMENTS']}")
        # 2. JSON-LD : valide, prix au bon tarif, places pilotes
        for bloc_ld in a.jsonld:
            try:
                donnees = json.loads(bloc_ld)
            except json.JSONDecodeError as e:
                pb(f"JSON-LD invalide : {e}")
                continue
            texte = json.dumps(donnees, ensure_ascii=False)
            for mauvais in ("www.", "http://", "index.html"):
                if mauvais in texte:
                    pb(f"JSON-LD : forme d'URL concurrente « {mauvais} »")
            for o in objets(donnees):
                if o.get("@type") != "Offer":
                    continue
                famille = tarif(o.get("name"))
                specs = o.get("priceSpecification")
                specs = specs if isinstance(specs, list) else ([specs] if specs else [])
                if "price" in o:
                    specs = specs + [{"@type": "PriceSpecification", "price": o["price"]}]
                for sp in specs:
                    valeur = sp.get("minPrice", sp.get("price"))
                    if valeur is None:
                        continue
                    if famille == "gratuit":
                        attendu = 0
                    elif famille == "diagnostic":
                        attendu = prix.get("diagnostic_ecrit")
                    else:
                        attendu = prix.get(f"{famille}_{'mois' if sp.get('@type') == 'UnitPriceSpecification' else 'installation'}")
                    if attendu is None or float(valeur) != float(attendu):
                        pb(f"JSON-LD : offre « {o.get('name', famille)} » à {valeur}, config.js dit {attendu}")
                if "itemOffered" in o and not specs:
                    pass
            for o in objets(donnees):
                if "priceRange" in o:
                    n = [int(x) for x in re.findall(r"\d+", o["priceRange"].replace(" ", ""))]
                    if n[:2] != [int(prix["essentiel_installation"]), int(prix["essentiel_mois"])]:
                        pb(f"JSON-LD : priceRange « {o['priceRange']} » différent de config.js")
            for mot in re.findall(r"(\d+|deux|trois|quatre|cinq|six) (?:premières )?entreprises du programme pilote", texte):
                n = int(mot) if mot.isdigit() else NOMBRES[mot]
                if n != total:
                    pb(f"JSON-LD : « {mot} entreprises du programme pilote », config.js dit {total}")
            # 3. FAQPage = tiroir, dans les deux sens
            faq = [x for x in objets(donnees) if x.get("@type") == "FAQPage"]
            if faq:
                attendu = [[q["name"], q["acceptedAnswer"]["text"]] for q in faq[0]["mainEntity"]]
                affiche = a.questions
                if [simple(q) for q, _ in attendu] != [simple(q) for q, _ in affiche]:
                    pb(f"FAQ : questions du JSON-LD ({len(attendu)}) et du tiroir ({len(affiche)}) différentes ou dans un autre ordre")
                for (q, r), (_, r_aff) in zip(attendu, affiche):
                    reste = simple(r_aff).replace(simple(r), "", 1).strip()
                    if simple(r) not in simple(r_aff) or reste not in ("", "Détails dans la politique de confidentialité."):
                        pb(f"FAQ : réponse différente entre JSON-LD et tiroir pour « {norm(q)} »")
        # 4. Tête de page
        canon = SITE if nom == "index.html" else SITE + nom
        if a.h1 != 1:
            pb(f"{a.h1} balises <h1> (il en faut une)")
        if a.lang != "fr-BE":
            pb(f"lang=« {a.lang} », attendu « fr-BE »")
        if a.meta.get("canonical") != canon:
            pb(f"canonique « {a.meta.get('canonical')} », attendu « {canon} »")
        if a.meta.get("og:url") != canon:
            pb(f"og:url « {a.meta.get('og:url')} », attendu « {canon} »")
        if not a.meta.get("og:image"):
            pb("og:image manquante")
        if canon not in urls_sitemap:
            pb(f"{canon} absent de sitemap.xml")
        for bloc_ld in a.jsonld:
            try:
                for o in objets(json.loads(bloc_ld)):
                    if o.get("@type") == "BreadcrumbList" and o["itemListElement"][-1]["item"] != canon:
                        pb("dernier élément du fil d'Ariane différent de la canonique")
            except (json.JSONDecodeError, KeyError, IndexError):
                pass
        titre, desc = norm(a.titre), a.meta.get("description", "")
        titres.setdefault(titre, []).append(nom)
        descriptions.setdefault(desc, []).append(nom)
        if len(titre) > 70:
            avertissements.append(f"{nom} : titre de {len(titre)} caractères (70 au plus)")
        if not 140 <= len(desc) <= 160:
            avertissements.append(f"{nom} : description de {len(desc)} caractères (140 à 160)")
        # 5. Liens internes
        for href in a.liens:
            if href.startswith(("mailto:", "tel:")):
                continue
            if href.startswith("http"):
                if href.startswith(SITE) or "www.assysteo" in href or href.startswith("http://"):
                    pb(f"lien absolu ou non sécurisé vers le site : {href} (utiliser un chemin /…)")
                continue
            if "index.html" in href:
                pb(f"lien vers index.html : {href}")
            chemin, _, ancre = href.partition("#")
            if not existe(chemin, ancre, nom):
                pb(f"lien cassé : {href}")
        # 6. Tirets interdits dans le texte visible
        visible = "".join(a.texte)
        for m in re.finditer(r"[—–]", visible):
            pb(f"tiret interdit : « …{visible[max(0, m.start() - 30): m.end() + 30]}… »".replace("\n", " "))

    for valeur, noms in list(titres.items()) + list(descriptions.items()):
        if len(noms) > 1:
            problemes.append(f"titre ou description identique sur {', '.join(noms)} : « {valeur[:60]}… »")
    for url in urls_sitemap:
        fichier = "index.html" if url == SITE else url.replace(SITE, "")
        if fichier not in analyses:
            problemes.append(f"sitemap.xml : {url} ne correspond à aucun fichier")

    # 7. Scripts : liens qu'ils écrivent et valeurs par défaut
    for script in ("anim.js", "diagnostic.js", "chat.js"):
        js = (RACINE / script).read_text(encoding="utf-8")
        for chemin in set(re.findall(r"""['"](/[\w-]+\.html)(?:#[\w-]+)?['"]""", js)):
            if chemin.lstrip("/") not in analyses:
                problemes.append(f"{script} : lien vers une page absente {chemin}")
        for ancre in set(re.findall(r"""['"]#(m-[\w-]+|info-[\w-]+|diagnostic|tarifs)['"]""", js)):
            if ancre not in analyses["index.html"][1].ids:
                problemes.append(f"{script} : ancre absente de l'accueil #{ancre}")
        for cle, defaut in re.findall(r"val\([A-Z]\w*, '(\w+)', ([\d.]+)\)", js):
            reference = prix.get(cle, calcul.get(cle))
            if reference is not None and float(defaut) != float(reference):
                problemes.append(f"{script} : valeur par défaut de {cle} = {defaut}, config.js dit {reference}")
        m = re.search(r"window\.URL_RESERVATION \|\| '([^']+)'", js)
        if m and m.group(1) != urls.get("URL_RESERVATION"):
            problemes.append(f"{script} : adresse de réservation de secours différente de config.js")

    for w in avertissements:
        print("Avertissement :", w)
    if problemes:
        print("\n".join(problemes))
        print(f"\n{len(problemes)} problème(s).")
        sys.exit(1)
    print(f"Tout est cohérent ({len(pages)} pages).")


if __name__ == "__main__":
    main()
