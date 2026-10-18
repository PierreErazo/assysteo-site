"""Teste outils/verifier_site.py : introduit une erreur à la fois dans une copie du site
et vérifie que l'outil la signale. Usage : python3 outils/tester_verificateur.py"""
import shutil, subprocess, pathlib, re
import tempfile
SRC = pathlib.Path(__file__).resolve().parent.parent; TMP = pathlib.Path(tempfile.mkdtemp()) / 'site'
MUT = [
 ('prix JSON-LD métier', 'installateurs-energie.html', '"minPrice":"490"', '"minPrice":"79"'),
 ('priceRange', 'index.html', '"priceRange":"À partir de 490 €', '"priceRange":"À partir de 590 €'),
 ('Croissance JSON-LD', 'index.html', '"minPrice":"1900"', '"minPrice":"1800"'),
 ('places total', 'config.js', 'var PLACES_PILOTE_TOTAL = 3;', 'var PLACES_PILOTE_TOTAL = 5;'),
 ('URL réservation', 'courtiers.html', 'href="https://n8n.assysteo.be/form/9b2f6c1e-4d7a-4e3b-8a51-3c0d2e7f9a64" data-cfg-href', 'href="https://n8n.assysteo.be/form/autre" data-cfg-href'),
 ('og:url', 'comptables.html', '<meta property="og:url" content="https://assysteo.be/comptables.html">', '<meta property="og:url" content="https://assysteo.be/courtiers.html">'),
 ('fil d\'Ariane www', 'courtiers.html', '"item":"https://assysteo.be/courtiers.html"', '"item":"https://www.assysteo.be/courtiers.html"'),
 ('question en plus au tiroir', 'agences-immobilieres.html', '<details class="question"><summary>Combien ça coûte', '<details class="question"><summary>Question ajoutée ?</summary><div><p>Oui.</p></div></details>\n<details class="question"><summary>Combien ça coûte'),
 ('défaut diagnostic.js', 'diagnostic.js', "val(P, 'essentiel_mois', 79)", "val(P, 'essentiel_mois', 89)"),
 ('ancre JS', 'diagnostic.js', "ancre: '#m-email'", "ancre: '#m-courriel'"),
 ('pastille libre', 'index.html', '<div class="places" aria-hidden="true"><i class="libre"></i><i class="libre"></i><i class="libre"></i></div>', '<div class="places" aria-hidden="true"><i class="libre"></i><i class="libre"></i><i></i></div>'),
 ('lien démo', 'index.html', 'href="/demo/4-certificat-peb.pdf"', 'href="/demo/5-absent.pdf"'),
 ('tiret', 'comptables.html', 'Une semaine pour faire votre vrai métier.', 'Une semaine — pour faire votre vrai métier.'),
]
ok = 0
for nom, f, a, b in MUT:
    if TMP.exists(): shutil.rmtree(TMP)
    shutil.copytree(SRC, TMP, ignore=shutil.ignore_patterns('.git'))
    s = (TMP / f).read_text(); assert a in s, (nom, a); (TMP / f).write_text(s.replace(a, b, 1))
    r = subprocess.run(['python3', str(TMP / 'outils/verifier_site.py')], capture_output=True, text=True)
    detecte = r.returncode == 1
    ok += detecte
    print(('DÉTECTÉ  ' if detecte else 'RATÉ     ') + nom + (' : ' + r.stdout.strip().split('\n')[0][:110] if detecte else ''))
print(f'{ok}/{len(MUT)} erreurs détectées')
