/* Mini-diagnostic du site Assysteo.
   8 questions, une par écran. Le résultat (1 à 3 modules, le gain estimé, la formule conseillée)
   est calculé ici, dans le navigateur, avec les règles lisibles ci-dessous : aucune IA, aucun envoi.
   Rien ne quitte l'appareil du visiteur tant qu'il ne remplit pas le formulaire final avec son accord.
   Envoi : POST JSON vers WEBHOOK_DIAGNOSTIC (config.js) ; s'il est vide, un email prérempli s'ouvre. */
(function () {
  'use strict';
  var zone = document.getElementById('quiz');
  if (!zone) return;
  var doc = document;
  var calme = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nombre(n) { return Math.round(n).toLocaleString('fr-BE'); }
  function lire(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* sans effet */ } }
  // Chaque réglage est lu à part : une valeur absente de config.js reprend sa valeur par défaut
  function val(o, k, d) { var v = o && o[k]; return typeof v === 'number' && isFinite(v) ? v : d; }
  var P = window.PRIX, C = window.CALCUL;
  var PRIX = { essentiel_installation: val(P, 'essentiel_installation', 490), essentiel_mois: val(P, 'essentiel_mois', 79),
    croissance_installation: val(P, 'croissance_installation', 1900), croissance_mois: val(P, 'croissance_mois', 190) };
  var CALCUL = { jours_par_semaine: val(C, 'jours_par_semaine', 5), semaines_par_an: val(C, 'semaines_par_an', 46),
    devis_recuperes_par_relance: val(C, 'devis_recuperes_par_relance', .1) };
  var PLACES = Math.max(0, Math.min(val(window, 'PLACES_PILOTE_RESTANTES', 0), val(window, 'PLACES_PILOTE_TOTAL', Infinity)));
  var RESERVATION = window.URL_RESERVATION || 'https://n8n.assysteo.be/form/9b2f6c1e-4d7a-4e3b-8a51-3c0d2e7f9a64';

  /* ── Les questions : [valeur, libellé, précision facultative] ── */
  var QUESTIONS = [
    { id: 'metier', q: 'Quel est votre métier ?', o: [['immo', 'Agence immobilière'], ['courtier', 'Courtier', 'crédit ou assurance'], ['energie', 'Installateur en énergie'], ['compta', 'Cabinet comptable'], ['autre', 'Autre PME', 'commerce, artisan, services']] },
    { id: 'emails', q: 'Combien d\'emails recevez-vous par jour ?', o: [['5', 'Moins de 10'], ['20', '10 à 30'], ['45', '30 à 60'], ['80', 'Plus de 60']] },
    { id: 'devis', q: 'Combien de devis envoyez-vous par mois ?', o: [['0', 'Aucun', 'pas de devis chez moi'], ['5', '1 à 10'], ['20', '10 à 30'], ['40', 'Plus de 30']] },
    { id: 'relance', q: 'Relancez-vous les devis restés sans réponse ?', o: [['0', 'Toujours'], ['50', 'Parfois'], ['80', 'Rarement'], ['100', 'Jamais']] },
    { id: 'documents', q: 'Devez-vous réclamer des documents à vos clients ?', o: [['jamais', 'Jamais'], ['parfois', 'Parfois'], ['souvent', 'Souvent'], ['toujours', 'Pour chaque dossier']] },
    { id: 'appels', q: 'Ratez-vous des appels quand vous êtes occupé ?', o: [['rare', 'Rarement'], ['semaine', 'Quelques-uns', 'par semaine'], ['jour', 'Tous les jours']] },
    { id: 'site', q: 'Que trouve un visiteur sur votre site ?', o: [['aucun', 'Je n\'ai pas de site'], ['vitrine', 'Un site vitrine', 'sans contact rapide'], ['formulaire', 'Un formulaire de contact'], ['chat', 'Un chat']] },
    { id: 'objectif', q: 'Votre priorité pour les 6 prochains mois ?', o: [['clients', 'Plus de clients'], ['admin', 'Moins d\'administratif'], ['piloter', 'Mieux piloter']] }
  ];
  var MODULES = {
    email: { nom: 'Assistant email', ancre: '#m-email' },
    accueil: { nom: 'Agent d\'accueil du site', ancre: '#m-accueil' },
    rdv: { nom: 'Prise de rendez-vous', ancre: '#m-rdv' },
    relances: { nom: 'Relance des devis et des factures', ancre: '#m-relances' },
    documents: { nom: 'Contrôle des documents reçus', ancre: '#m-documents' },
    prospection: { nom: 'Prospection locale', ancre: '#m-prospection' },
    linkedin: { nom: 'Publication LinkedIn assistée', ancre: '#m-linkedin' },
    resume: { nom: 'Résumé du matin', ancre: '#m-resume' }
  };
  var PAGES = {
    immo: ['/agences-immobilieres.html', 'Tout pour les agences immobilières'],
    courtier: ['/courtiers.html', 'Tout pour les courtiers'],
    energie: ['/installateurs-energie.html', 'Tout pour les installateurs'],
    compta: ['/comptables.html', 'Tout pour les cabinets comptables']
  };

  /* ── Règles de recommandation ──────────────────────────────────────────
     Chaque réponse donne des points aux modules disponibles. On garde les 3 meilleurs
     ayant au moins 3 points (au moins un module). Les modules « sur demande » ne sont
     jamais recommandés comme disponibles : ils sont seulement cités en fin de résultat. */
  function recommander(r) {
    var points = {}, raisons = {};
    function plus(m, n, raison) { points[m] = (points[m] || 0) + n; if (raison && !raisons[m]) raisons[m] = raison; }
    var emails = +r.emails, devis = +r.devis, relance = +r.relance;
    // 1. Volume d'emails : l'assistant email
    if (emails >= 45) plus('email', 4, 'Vous recevez plus de 30 emails par jour.');
    else if (emails >= 20) plus('email', 3, 'Vous recevez 10 à 30 emails par jour.');
    else plus('email', 1, 'Chaque demande reçue a sa réponse prête en brouillon.');
    // 2. Devis peu ou pas relancés : la relance des devis et des factures
    if (devis > 0 && relance >= 80) plus('relances', 5, 'Vos devis sont rarement ou jamais relancés.');
    else if (devis > 0 && relance >= 50) plus('relances', 3, 'Une partie de vos devis n\'est jamais relancée.');
    else if (devis >= 20) plus('relances', 1, 'Beaucoup de devis à suivre chaque mois.');
    // 3. Documents à réunir : le contrôle des documents
    if (r.documents === 'toujours') { plus('documents', 4, 'Vous réclamez des documents pour chaque dossier.'); plus('email', 1); }
    else if (r.documents === 'souvent') plus('documents', 3, 'Vous réclamez souvent des documents.');
    else if (r.documents === 'parfois') plus('documents', 1, 'Vous réclamez parfois des documents.');
    if (r.metier === 'courtier' || r.metier === 'compta') plus('documents', 1);
    // 4. Site sans contact rapide : l'agent d'accueil
    if (r.site === 'vitrine' || r.site === 'formulaire') plus('accueil', 3, 'Votre site ne répond pas aux visiteurs le soir et le week-end.');
    if ((r.metier === 'immo' || r.metier === 'energie') && r.site !== 'aucun') plus('accueil', 1, 'Vos clients cherchent souvent le soir et le week-end.');
    // 5. Appels manqués : la prise de rendez-vous (le SMS automatique est « sur demande »)
    if (r.appels === 'jour') plus('rdv', 3, 'Vous ratez des appels chaque jour : un lien de rendez-vous évite les allers-retours.');
    else if (r.appels === 'semaine') plus('rdv', 2, 'Moins d\'allers-retours pour fixer un rendez-vous.');
    if (r.metier === 'immo') plus('rdv', 1, 'Les visites se fixent sans échange d\'emails.');
    // 6. La priorité du dirigeant
    if (r.objectif === 'clients') { plus('prospection', 5, 'Votre priorité : trouver de nouveaux clients.'); plus('accueil', 1); plus('linkedin', 2, 'Une présence régulière sur LinkedIn, sans y passer vos soirées.'); }
    if (r.objectif === 'admin') { plus('relances', 1); plus('documents', 1); plus('email', 1); }
    if (r.objectif === 'piloter') plus('resume', 4, 'Votre priorité : voir chaque matin où en est l\'entreprise.');

    var ordre = Object.keys(points).filter(function (k) { return points[k] >= 3; })
      .sort(function (a, b) { return points[b] - points[a]; }).slice(0, 3);
    if (!ordre.length) ordre = ['email'];
    var extras = [];
    if (r.appels === 'jour' || r.appels === 'semaine') extras.push('un SMS automatique après un appel manqué');
    if (r.metier === 'energie' && devis > 0) extras.push('le pré-devis automatique');
    if (r.metier === 'compta' || r.documents === 'toujours') extras.push('l\'envoi des factures fournisseurs à la comptabilité');
    return {
      modules: ordre.map(function (k) { return { id: k, nom: MODULES[k].nom, raison: raisons[k] || '', ancre: MODULES[k].ancre }; }),
      extras: extras,
      formule: ordre.length >= 2 ? 'croissance' : 'essentiel'
    };
  }

  /* ── Estimation du gain, avec les formules du calculateur ──
     Les chiffres saisis dans le calculateur (minutes par email, valeur d'un devis, taux horaire)
     sont repris s'ils existent ; sinon, les valeurs par défaut du calculateur. */
  function calculateur() { try { return JSON.parse(lire('assysteo-calcul') || 'null'); } catch (e) { return null; } }
  function estimer(r) {
    var c = calculateur(), v = (c && c.valeurs) || {};
    var minutes = v.minutes || 3, taux = v.taux || 45, valeur = v.valeur || 2000;
    var heures = +r.emails * minutes * CALCUL.jours_par_semaine * CALCUL.semaines_par_an / 12 / 60;
    var devis = +r.devis * (+r.relance / 100) * valeur * CALCUL.devis_recuperes_par_relance;
    return { heures: heures, temps_euros: heures * taux, devis_euros: devis, total_mois: heures * taux + devis, avec_calculateur: !!c };
  }

  /* ── État et affichage ── */
  var reponses = {}, etape = 0, resultat = null, estimation = null, attente = 0;
  // Réponses préremplies (à confirmer) : métier choisi dans la page, chiffres du calculateur
  var metier = lire('assysteo-metier');
  if (metier) reponses.metier = metier;
  var c0 = calculateur();
  if (c0 && c0.valeurs) {
    var e = c0.valeurs.emails, d = c0.valeurs.devis, p = c0.valeurs.part;
    if (e != null) reponses.emails = e < 10 ? '5' : e <= 30 ? '20' : e <= 60 ? '45' : '80';
    if (d != null) reponses.devis = d === 0 ? '0' : d <= 10 ? '5' : d <= 30 ? '20' : '40';
    if (p != null) reponses.relance = p === 0 ? '0' : p <= 50 ? '50' : p <= 80 ? '80' : '100';
  }

  function libelle(id, val) {
    var q = QUESTIONS.filter(function (x) { return x.id === id; })[0], o = q && q.o.filter(function (x) { return x[0] === val; })[0];
    return o ? o[1] + (o[2] ? ' (' + o[2] + ')' : '') : '';
  }
  // Redessine la zone ; si le focus y était (clavier, lecteur d'écran), il va sur le nouveau titre.
  // Le haut du diagnostic est ramené à l'écran s'il est passé au-dessus.
  function vue(html, cibleFocus) {
    var dedans = zone.contains(doc.activeElement);
    zone.innerHTML = '<div class="quiz-vue">' + html + '</div>';
    if (zone.getBoundingClientRect().top < 60) zone.scrollIntoView({ block: 'start', behavior: calme ? 'auto' : 'smooth' });
    var el = doc.getElementById(cibleFocus || 'quiz-q');
    if (el && (dedans || cibleFocus)) el.focus({ preventScroll: true });
  }

  function question() {
    var q = QUESTIONS[etape], n = QUESTIONS.length, choisi = reponses[q.id];
    var opts = q.o.map(function (o) {
      return '<button type="button" class="quiz-opt" data-val="' + esc(o[0]) + '" aria-pressed="' + (choisi === o[0] ? 'true' : 'false') + '">' +
        esc(o[1]) + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</button>';
    }).join('');
    vue('<div class="quiz-haut"><span>Question ' + (etape + 1) + ' sur ' + n + '</span><span>Diagnostic gratuit</span></div>' +
      '<div class="quiz-progres" role="progressbar" aria-label="Progression du diagnostic" aria-valuemin="1" aria-valuemax="' + n + '" aria-valuenow="' + (etape + 1) + '"><i style="--p:' + Math.round(etape / n * 100) + '%"></i></div>' +
      '<h3 class="quiz-q" id="quiz-q" tabindex="-1">' + esc(q.q) + '</h3>' +
      '<div class="quiz-options' + (q.o.length === 3 ? ' une-col' : '') + '" role="group" aria-labelledby="quiz-q">' + opts + '</div>' +
      '<div class="quiz-nav"><button type="button" class="lien-btn" data-precedent' + (etape === 0 ? ' disabled' : '') + '>Précédent</button>' +
      '<button type="button" class="btn btn-nuit btn-petit" data-suivant' + (choisi ? '' : ' disabled') + '>' + (etape === n - 1 ? 'Voir mon résultat' : 'Suivant') + '</button></div>');
    // Barre de progression animée vers l'étape en cours
    var barre = zone.querySelector('.quiz-progres i');
    requestAnimationFrame(function () { barre.style.setProperty('--p', Math.round((etape + 1) / n * 100) + '%'); });
  }

  function avancer() {
    clearTimeout(attente);
    if (!reponses[QUESTIONS[etape].id]) return;          // pas de réponse : on reste sur la question
    if (etape < QUESTIONS.length - 1) { etape++; question(); return; }
    // Toutes les questions doivent avoir une réponse avant le résultat
    for (var i = 0; i < QUESTIONS.length; i++) if (!reponses[QUESTIONS[i].id]) { etape = i; return question(); }
    montrerResultat();
  }

  function montrerResultat() {
    resultat = recommander(reponses);
    estimation = estimer(reponses);
    ecrire('assysteo-diagnostic', JSON.stringify({ reponses: reponses, resultat: resultat, estimation: estimation }));
    var f = resultat.formule === 'croissance'
      ? '<p><b>Formule conseillée : Croissance</b><br>À partir de ' + nombre(PRIX.croissance_installation) + ' € HTVA, puis ' + nombre(PRIX.croissance_mois) + ' € HTVA par mois</p>'
      : '<p><b>Formule conseillée : Essentiel</b><br>À partir de ' + nombre(PRIX.essentiel_installation) + ' € HTVA, puis ' + nombre(PRIX.essentiel_mois) + ' € HTVA par mois</p>';
    var pilote = PLACES > 0
      ? '<span class="badge dispo">Installation offerte : ' + PLACES + ' place' + (PLACES > 1 ? 's' : '') + ' pilote' + (PLACES > 1 ? 's' : '') + '</span>' : '';
    var gain = '<div class="gain"><div><b>' + nombre(estimation.heures) + ' h</b>par mois passées sur vos emails</div>' +
      (estimation.devis_euros > 0
        ? '<div><b>' + nombre(estimation.devis_euros) + ' €</b>par mois de devis en jeu</div>'
        : '<div><b>' + nombre(estimation.temps_euros) + ' €</b>par mois : la valeur de ce temps</div>') + '</div>';
    var page = PAGES[reponses.metier];
    vue('<div class="quiz-haut"><span>Votre résultat</span><span>Diagnostic gratuit</span></div>' +
      '<div class="quiz-progres" aria-hidden="true"><i style="--p:100%"></i></div>' +
      '<h3 class="quiz-q" id="quiz-q" tabindex="-1">Par où commencer chez vous</h3>' +
      '<ol class="reco">' + resultat.modules.map(function (m) {
        return '<li><b>' + esc(m.nom) + '</b>' + esc(m.raison) + ' <a href="' + m.ancre + '">Voir</a></li>';
      }).join('') + '</ol>' + gain +
      '<div class="pack">' + f + pilote + '</div>' +
      '<p class="note">Estimation à partir de vos réponses' + (estimation.avec_calculateur ? ' et de votre calcul' : '') + ', avec les formules du calculateur.' +
      (resultat.extras.length ? ' Aussi possible, sur demande : ' + esc(resultat.extras.join(', ')) + '.' : '') +
      (page ? ' <a href="' + page[0] + '">' + page[1] + '</a>.' : '') + '</p>' +
      '<div class="quiz-nav"><button type="button" class="lien-btn" data-refaire>Recommencer</button>' +
      '<button type="button" class="btn btn-accent" data-vers-formulaire>Recevoir ce résultat <span class="fl" aria-hidden="true">→</span></button></div>');
    // Le rappel du coût en bas de page reprend cette estimation si le calculateur n'a pas servi
    doc.querySelectorAll('#rappel-cout, [data-rappel-bloc]').forEach(function (rap) {
      if (!rap.hidden) return;
      rap.querySelectorAll('[data-rappel]').forEach(function (s) { s.textContent = nombre(estimation.total_mois); });
      rap.hidden = false;
    });
  }

  function formulaire() {
    vue('<div class="quiz-haut"><span>Recevoir votre diagnostic</span><span>1 minute</span></div>' +
      '<h3 class="quiz-q" id="quiz-q" tabindex="-1">Pierre vous recontacte pour en parler</h3>' +
      '<form class="formulaire" novalidate>' +
        '<div class="deux-col"><div class="champ"><label for="d-nom">Votre nom</label><input id="d-nom" name="nom" autocomplete="name" required></div>' +
        '<div class="champ"><label for="d-entreprise">Entreprise (facultatif)</label><input id="d-entreprise" name="entreprise" autocomplete="organization"></div></div>' +
        '<div class="champ"><label for="d-contact">Email ou téléphone</label><input id="d-contact" name="contact" autocomplete="email" required></div>' +
        '<label class="consent"><input type="checkbox" name="accord" required><span>J\'accepte qu\'Assysteo utilise ces informations pour me recontacter au sujet de ce diagnostic. Pas de newsletter. <a href="/confidentialite.html#diagnostic">Confidentialité</a></span></label>' +
        '<p class="erreur-msg" id="d-erreur" role="alert"></p>' +
        '<div class="quiz-nav"><button type="button" class="lien-btn" data-retour-resultat>Revenir au résultat</button>' +
        '<button type="submit" class="btn btn-accent">Envoyer à Pierre</button></div>' +
      '</form>');
    doc.getElementById('d-nom').focus({ preventScroll: true });   // le formulaire est demandé : le focus y va
  }

  function verifier(form) {
    var nom = form.nom.value.trim(), contact = form.contact.value.trim();
    var email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact), tel = contact.replace(/\D/g, '').length >= 9;
    if (!nom) return ['Indiquez votre nom.', form.nom];
    if (!email && !tel) return ['Indiquez un email valide ou un numéro de téléphone.', form.contact];
    if (!form.accord.checked) return ['Cochez la case d\'accord pour que Pierre puisse vous recontacter.', form.accord];
    return null;
  }

  function donnees(form) {
    var libelles = {};
    QUESTIONS.forEach(function (q) { libelles[q.id] = libelle(q.id, reponses[q.id]); });
    var c = calculateur();
    return {
      source: 'assysteo.be', page: location.pathname, envoye_le: new Date().toISOString(),
      reponses: reponses, libelles: libelles,
      resultat: { modules: resultat.modules.map(function (m) { return { id: m.id, nom: m.nom, raison: m.raison }; }), sur_demande: resultat.extras, formule: resultat.formule },
      estimation: { heures_par_mois: Math.round(estimation.heures), devis_euros_par_mois: Math.round(estimation.devis_euros), temps_euros_par_mois: Math.round(estimation.temps_euros) },
      calculateur: c ? c.valeurs : null,
      contact: { nom: form.nom.value.trim(), entreprise: form.entreprise.value.trim(), email_ou_telephone: form.contact.value.trim() },
      consentement: true
    };
  }

  function texteEmail(d) {
    var l = ['Bonjour Pierre,', '', 'Voici mon diagnostic fait sur assysteo.be.', ''];
    QUESTIONS.forEach(function (q) { l.push(q.q + ' ' + d.libelles[q.id]); });
    l.push('', 'Modules conseillés :');
    d.resultat.modules.forEach(function (m, i) { l.push((i + 1) + '. ' + m.nom + (m.raison ? ' : ' + m.raison : '')); });
    l.push('Formule conseillée : ' + (d.resultat.formule === 'croissance' ? 'Croissance' : 'Essentiel'));
    l.push('Estimation : ' + d.estimation.heures_par_mois + ' h par mois sur les emails, ' + d.estimation.devis_euros_par_mois + ' € par mois de devis en jeu.');
    l.push('', 'Nom : ' + d.contact.nom, 'Entreprise : ' + (d.contact.entreprise || '-'), 'Contact : ' + d.contact.email_ou_telephone, '', 'Bien à vous,');
    return l.join('\n');
  }

  function succes(par) {
    var tel = '<a href="tel:+32472991485">0472 99 14 85</a>';
    vue('<div class="quiz-haut"><span>C\'est fait</span><span>Diagnostic gratuit</span></div>' +
      '<div class="quiz-progres" aria-hidden="true"><i style="--p:100%"></i></div>' +
      '<h3 class="quiz-q" id="quiz-q" tabindex="-1">' + (par === 'webhook' ? 'Merci, c\'est envoyé.' : 'Votre email est prêt.') + '</h3>' +
      (par === 'webhook'
        ? '<p>Pierre a bien reçu votre diagnostic et vous recontacte rapidement.</p>'
        : '<p>Votre logiciel d\'email s\'est ouvert avec le diagnostic prérempli : il ne reste qu\'à l\'envoyer. Rien ne s\'est ouvert ? Écrivez à <a href="mailto:contact@assysteo.be">contact@assysteo.be</a> ou appelez le ' + tel + '.</p>') +
      '<p>Pour aller plus vite, choisissez dès maintenant un créneau pour l\'audit gratuit de 30 minutes.</p>' +
      '<div class="actions"><a class="btn btn-accent" href="' + esc(RESERVATION) + '">Réserver l\'audit gratuit <span class="fl" aria-hidden="true">→</span></a></div>', 'quiz-q');
  }

  function envoyer(form) {
    var d = donnees(form), bouton = form.querySelector('[type="submit"]');
    var url = window.WEBHOOK_DIAGNOSTIC;
    function parEmail() {
      var lien = 'mailto:contact@assysteo.be?subject=' + encodeURIComponent('Mon diagnostic Assysteo : ' + (d.contact.entreprise || d.contact.nom)) + '&body=' + encodeURIComponent(texteEmail(d));
      window.location.href = lien;
      succes('email');
    }
    if (!url) return parEmail();
    bouton.disabled = true; bouton.textContent = 'Envoi…';
    var controle = window.AbortController ? new AbortController() : null;
    var minuterie = setTimeout(function () { if (controle) controle.abort(); }, 20000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), signal: controle ? controle.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); succes('webhook'); })
      .catch(function () { parEmail(); })   // serveur injoignable : on ne perd pas le diagnostic
      .then(function () { clearTimeout(minuterie); });
  }

  /* ── Événements (délégués : la zone est redessinée à chaque étape) ── */
  zone.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !zone.contains(t)) return;
    if (t.classList.contains('quiz-opt')) {
      reponses[QUESTIONS[etape].id] = t.getAttribute('data-val');
      zone.querySelectorAll('.quiz-opt').forEach(function (b) { b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
      var suivant = zone.querySelector('[data-suivant]'); if (suivant) suivant.disabled = false;
      clearTimeout(attente);
      var e0 = etape;
      attente = setTimeout(function () { if (etape === e0) avancer(); }, calme ? 0 : 260);
      return;
    }
    if (t.hasAttribute('data-suivant')) return avancer();
    if (t.hasAttribute('data-precedent')) { clearTimeout(attente); if (etape > 0) { etape--; question(); } return; }
    if (t.hasAttribute('data-refaire')) { clearTimeout(attente); etape = 0; question(); return; }
    if (t.hasAttribute('data-vers-formulaire')) return formulaire();
    if (t.hasAttribute('data-retour-resultat')) return montrerResultat();
  });
  zone.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, err = verifier(form), msg = form.querySelector('.erreur-msg');
    [form.nom, form.contact, form.accord].forEach(function (c) { c.removeAttribute('aria-invalid'); c.removeAttribute('aria-describedby'); });
    if (err) {
      msg.textContent = '';
      setTimeout(function () { msg.textContent = err[0]; }, 30);   // vidé puis rempli : la même erreur est annoncée à nouveau
      err[1].setAttribute('aria-invalid', 'true'); err[1].setAttribute('aria-describedby', 'd-erreur'); err[1].focus();
      return;
    }
    msg.textContent = '';
    if (form.dataset.envoi) return;                        // pas de double envoi
    form.dataset.envoi = '1';
    envoyer(form);
  });

  // Les liens « Voir » du résultat ouvrent le bon module dans les piliers (géré par anim.js via l'ancre)
  question();
})();
