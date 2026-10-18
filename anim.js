/* Animations et interactions du site Assysteo. Aucune bibliothèque, aucun service tiers.
   Tout le contenu est déjà écrit dans le HTML : ce script l'anime et le rend interactif.
   Les réglages (prix, places pilotes, adresses, compteurs) viennent de config.js. */
(function () {
  'use strict';
  var doc = document, racine = doc.documentElement;
  var calme = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var telephone = window.matchMedia ? matchMedia('(max-width: 640px)') : { matches: false };
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function nombre(n) { return Math.round(n).toLocaleString('fr-BE'); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lire(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* stockage bloqué : sans effet */ } }
  function cfg(nom) { return window[nom]; }
  function quandVisible(el, f, seuil) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return f();
    var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { o.disconnect(); f(); } }, { threshold: seuil || .25 });
    o.observe(el);
  }
  function surChangement(mq, f) { if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }

  /* ---------- 1. Réglages de config.js ---------- */
  var PRIX = cfg('PRIX') || {};
  $$('[data-cfg]').forEach(function (el) {
    var v = cfg(el.getAttribute('data-cfg'));
    if (typeof v === 'number') el.textContent = nombre(v); else if (typeof v === 'string' && v) el.textContent = v;
  });
  $$('[data-prix]').forEach(function (el) { var v = PRIX[el.getAttribute('data-prix')]; if (typeof v === 'number') el.textContent = nombre(v); });
  $$('[data-cfg-href]').forEach(function (a) { var v = cfg(a.getAttribute('data-cfg-href')); if (v) a.href = v; });
  var demo = cfg('URL_DEMO_DOCUMENTS');
  $$('[data-demo-docs]').forEach(function (a) { if (demo) a.href = demo; else (a.closest('.actions') || a).hidden = true; });

  // Programme pilote : pastilles, texte, et « programme complet » à 0
  var restant = cfg('PLACES_PILOTE_RESTANTES'), total = cfg('PLACES_PILOTE_TOTAL');
  if (typeof restant === 'number' && typeof total === 'number') {
    restant = Math.max(0, Math.min(restant, total));
    $$('[data-pilote]').forEach(function (p) {
      var pts = $('.places', p), t = $('.pilote-texte', p);
      if (pts) {
        pts.innerHTML = '';
        for (var i = 0; i < total; i++) { var b = doc.createElement('i'); if (i < restant) b.className = 'libre'; pts.appendChild(b); }
      }
      if (!t) return;
      if (restant === 0) {
        p.classList.add('complet');
        t.innerHTML = '<b>Programme complet, liste d\'attente</b>. Écrivez-nous pour être prévenu de la prochaine place.';
      } else {
        t.innerHTML = '<b>' + (restant === 1 ? 'Dernière place pilote' : restant + ' places pilotes') + ' sur ' + total +
          '</b> : installation offerte, en échange d\'un retour d\'expérience honnête.';
      }
    });
    $$('[data-pilote-court]').forEach(function (el) {
      el.textContent = restant === 0 ? 'Programme complet, liste d\'attente.' : 'Places restantes : ' + restant + '.';
    });
  }

  // Compteurs « Assysteo tourne avec ses propres agents » : seulement les valeurs renseignées
  var STATS = cfg('STATS') || {}, zoneStats = $('#stats');
  var LIBELLES = { emails_tries: 'emails triés', relances: 'relances préparées', prospects: 'entreprises étudiées' };
  if (zoneStats) {
    var hs = '';
    Object.keys(LIBELLES).forEach(function (k) {
      if (typeof STATS[k] === 'number' && STATS[k] > 0) hs += '<div><b data-compte="' + STATS[k] + '">' + nombre(STATS[k]) + '</b>' + LIBELLES[k] + '</div>';
    });
    if (hs) { zoneStats.innerHTML = hs; zoneStats.hidden = false; }
  }
  $$('[data-compte]').forEach(function (b) {
    if (calme) return;
    var n = +b.getAttribute('data-compte');
    quandVisible(b, function () {
      var t0 = performance.now();
      (function pas(t) { var p = Math.min(1, (t - t0) / 1100); b.textContent = nombre(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(pas); })(t0);
    }, .6);
  });

  // Témoignages : bloc caché tant que la liste est vide
  var TEMOINS = cfg('TEMOIGNAGES'), zoneT = $('#temoignages');
  if (zoneT && TEMOINS && TEMOINS.length) {
    zoneT.innerHTML = TEMOINS.map(function (t) {
      return '<figure><blockquote><p>' + esc(t.texte) + '</p></blockquote><figcaption><b>' + esc(t.nom) + '</b>' +
        (t.fonction ? ', ' + esc(t.fonction) : '') + (t.entreprise ? ', ' + esc(t.entreprise) : '') + '</figcaption></figure>';
    }).join('');
    zoneT.hidden = false;
  }

  // Photo de Pierre (sinon, le portrait dessiné reste)
  var photo = cfg('PHOTO_PIERRE');
  if (photo) $$('[data-portrait]').forEach(function (p) {
    var img = new Image(480, 480); img.src = photo; img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
    p.textContent = ''; p.appendChild(img);
  });

  /* ---------- 2. La journée : sans agents, tout s'empile ; avec, chaque demande est traitée ---------- */
  var ICONES = {
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    devis: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    facture: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    rdv: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m9 15 2 2 4-4"/>'
  };
  // Par métier : [canal, heure, de, objet, état avec agents, état sans agents]. Noms fictifs.
  var JOURNEES = {
    energie: { lien: ['/installateurs-energie.html', 'Tout pour les installateurs'], ev: [
      ['email', '07:12', 'B. De Smet', 'Offerte warmtepomp voor ons huis', 'Brouillon prêt, en néerlandais', 'Pas encore lu'],
      ['devis', '09:15', 'Devis 2026-118', 'Panneaux solaires, envoyé il y a 7 jours', 'Relance prête', 'Jamais relancé'],
      ['facture', '11:40', 'Facture 2026-041', '1 250 €, échue depuis 12 jours', 'Rappel poli préparé', 'Toujours impayée'],
      ['doc', '16:05', 'Famille Collard', 'Photos pour le dossier de prime', '1 pièce redemandée', 'Il manque encore une pièce'],
      ['chat', '21:40', 'Visiteur du site', 'Une pompe à chaleur pour 140 m² ?', 'Qualifié, rendez-vous proposé', 'Personne ne répond']] },
    immo: { lien: ['/agences-immobilieres.html', 'Tout pour les agences immobilières'], ev: [
      ['email', '07:40', 'Sophie M.', 'Visite de la maison à Jambes ?', 'Brouillon prêt', 'Sans réponse'],
      ['rdv', '09:20', 'Sophie M.', 'Samedi matin, c\'est possible ?', 'Visite samedi 10 h posée', '3 emails pour un créneau'],
      ['doc', '12:30', 'Famille Lambert', 'Mise en vente : certificat PEB', '2 pièces redemandées', 'Le PEB manque toujours'],
      ['devis', '15:10', 'Proposition de mandat', 'Envoyée il y a 6 jours', 'Relance prête', 'Jamais relancée'],
      ['chat', '21:40', 'Visiteur du site', 'Estimation de mon appartement ?', 'Qualifié, transmis', 'Personne ne répond']] },
    courtier: { lien: ['/courtiers.html', 'Tout pour les courtiers'], ev: [
      ['email', '07:54', 'Thomas et Julie', 'Crédit hypothécaire, compromis signé', 'Brouillon prêt', 'Sans réponse'],
      ['doc', '10:20', 'Famille Lambert', 'Fiches de paie et extrait de rôle', 'Fiche trop ancienne signalée', 'Pas encore vérifiées'],
      ['rdv', '12:45', 'Thomas et Julie', 'Un rendez-vous cette semaine ?', 'Mardi 17 h posé', 'En attente'],
      ['devis', '15:30', 'Offre assurance habitation', 'Envoyée il y a 5 jours', 'Relance prête', 'Oubliée'],
      ['chat', '22:05', 'Visiteur du site', 'Un crédit pour une maison à Jambes ?', 'Qualifié, transmis', 'Personne ne répond']] },
    compta: { lien: ['/comptables.html', 'Tout pour les cabinets comptables'], ev: [
      ['email', '08:30', 'L. Marchal', 'Devenir indépendant complémentaire', 'Brouillon prêt', 'Sans réponse'],
      ['doc', '09:50', 'Boulangerie D.', 'Factures d\'achat du trimestre', '2 pièces redemandées', 'La TVA attend'],
      ['facture', '11:10', 'Honoraires 2026-212', 'Échus depuis 15 jours', 'Rappel poli préparé', 'Toujours impayés'],
      ['rdv', '15:00', 'L. Marchal', 'Premier rendez-vous ?', 'Jeudi 9 h posé', 'En attente'],
      ['chat', '21:15', 'Visiteur du site', 'Vous prenez des SRL ?', 'Qualifié, transmis', 'Personne ne répond']] },
    autre: { lien: ['#diagnostic', 'Faites le diagnostic pour votre métier'], ev: [
      ['email', '07:30', 'Nouveau client', 'Demande de prix', 'Brouillon prêt', 'Sans réponse'],
      ['devis', '10:00', 'Devis 2026-077', 'Envoyé il y a 8 jours', 'Relance prête', 'Jamais relancé'],
      ['facture', '13:20', 'Facture 2026-030', 'Échue depuis 10 jours', 'Rappel poli préparé', 'Toujours impayée'],
      ['rdv', '16:00', 'Mme Renard', 'Un rendez-vous la semaine prochaine ?', 'Lundi 11 h posé', '3 emails pour un créneau'],
      ['chat', '21:40', 'Visiteur du site', 'Vous êtes ouverts samedi ?', 'Répondu, transmis', 'Personne ne répond']] }
  };

  $$('.journee').forEach(function (journee) {
    var liste = $('.flux', journee), horloge = $('.horloge b', journee), bilan = $('.journee-bilan', journee), lien = $('.lien-metier', journee);
    var etat = { metier: journee.getAttribute('data-metier') || 'energie', mode: 'avec' }, minuteurs = [];
    if (!liste) return;
    if (journee.hasAttribute('data-fixe')) ecrire('assysteo-metier', etat.metier);
    function plus(f, ms) { minuteurs.push(setTimeout(f, ms)); }
    function stop() { minuteurs.forEach(clearTimeout); minuteurs = []; journee.classList.remove('travaille'); }
    function ligne(e) {
      var l = doc.createElement('li');
      l.className = 'ev'; l.setAttribute('data-canal', e[0]);
      l.innerHTML = '<span class="ev-ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICONES[e[0]] + '</svg></span>' +
        '<div class="ev-corps"><p class="ev-ligne"><time>' + e[1] + '</time><b>' + esc(e[2]) + '</b></p><p class="ev-objet">' + esc(e[3]) + '</p></div>' +
        '<span class="ev-etat"></span>';
      return l;
    }
    function traite(l, e) { l.classList.remove('vide', 'desordre', 'en-cours'); l.classList.add('traite'); $('.ev-etat', l).textContent = e[4]; }
    function enAttente(l, e) { l.classList.add('attente'); $('.ev-etat', l).textContent = e[5]; }
    function jouer(anime) {
      stop();
      var d = JOURNEES[etat.metier] || JOURNEES.energie, evs = d.ev.slice(0, telephone.matches ? 3 : 5), sans = etat.mode === 'sans';
      var bouge = anime && !calme;
      journee.classList.toggle('mode-sans', sans);
      if (lien) { lien.href = d.lien[0]; lien.firstChild.nodeValue = d.lien[1] + ' '; }
      liste.innerHTML = '';
      var items = evs.map(function (e) { var l = ligne(e); liste.appendChild(l); return l; });
      bilan.innerHTML = '<span>' + (sans ? 'Les demandes arrivent…' : 'Les agents trient…') + '</span>';   // garde la hauteur pendant l'animation
      if (sans) {
        // Sans agents : les demandes arrivent et s'empilent, de travers
        items.forEach(function (l, i) {
          if (!bouge) return enAttente(l, evs[i]);
          l.style.visibility = 'hidden';
          plus(function () { l.style.visibility = ''; l.classList.add('arrive'); enAttente(l, evs[i]); horloge.textContent = evs[i][1]; }, 200 * i);
        });
        plus(function () {
          horloge.textContent = '22:00';
          bilan.innerHTML = '<span class="rouge">' + evs.length + ' demandes en attente</span><span>Vos clients attendent.</span>';
        }, bouge ? 200 * items.length + 150 : 0);
        return;
      }
      // Avec agents : chaque demande arrive en désordre, le noyau la traite et la remet en ordre
      items.forEach(function (l) { l.classList.add('vide'); });
      if (!bouge) {
        items.forEach(function (l, i) { traite(l, evs[i]); });
        horloge.textContent = '22:00';
        bilan.innerHTML = fini(evs.length);
        return;
      }
      journee.classList.add('travaille');
      items.forEach(function (l, i) {
        l.classList.add('desordre'); l.style.visibility = 'hidden';
        plus(function () { l.style.visibility = ''; l.classList.add('arrive'); }, 130 * i);
      });
      var t0 = 130 * items.length + 350;
      items.forEach(function (l, i) {
        plus(function () { horloge.textContent = evs[i][1]; l.classList.add('en-cours'); }, t0 + i * 720);
        plus(function () { traite(l, evs[i]); l.classList.add('pop'); }, t0 + i * 720 + 430);
      });
      plus(function () { journee.classList.remove('travaille'); horloge.textContent = '22:00'; bilan.innerHTML = fini(evs.length); }, t0 + items.length * 720 + 150);
    }
    function fini(n) { return '<span class="vert">' + n + ' traités, 0 en attente</span><span>Vous relisez, vous envoyez.</span>'; }

    var pastilles = $$('.pastille[data-metier]', journee), boutons = $$('.bascule button', journee);
    function presse(liste, choisi) { liste.forEach(function (b) { b.setAttribute('aria-pressed', b === choisi ? 'true' : 'false'); }); }
    pastilles.forEach(function (p) {
      p.addEventListener('click', function () {
        presse(pastilles, p); etat.metier = p.getAttribute('data-metier'); ecrire('assysteo-metier', etat.metier);
        etat.mode = 'avec'; presse(boutons, boutons.filter(function (b) { return b.getAttribute('data-mode') === 'avec'; })[0]);
        jouer(true);
      });
    });
    boutons.forEach(function (b) {
      b.addEventListener('click', function () { presse(boutons, b); etat.mode = b.getAttribute('data-mode'); jouer(true); });
    });
    quandVisible(journee, function () { setTimeout(function () { jouer(true); }, calme ? 0 : 500); }, .3);
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && minuteurs.length) jouer(false); });
    surChangement(telephone, function () { jouer(false); });
  });

  /* ---------- 3. Calculateur : le prospect chiffre lui-même ce qui attend ---------- */
  var CALCUL = cfg('CALCUL') || { jours_par_semaine: 5, semaines_par_an: 46, devis_recuperes_par_relance: .1 };
  $$('[data-calc]').forEach(function (bloc) {
    var form = $('[data-calc-form]', bloc), champs = {}, affiche = {}, raf = 0;
    if (!form) return;
    $$('input[type="range"]', form).forEach(function (i) { champs[i.name] = i; });
    var cibles = {};
    ['mois', 'an', 'heures', 'temps', 'devis'].forEach(function (k) { cibles[k] = $$('[data-r="' + k + '"]', bloc); });
    function v(n, d) { return champs[n] ? +champs[n].value : d; }
    function valeurs() { var o = {}; Object.keys(champs).forEach(function (k) { o[k] = +champs[k].value; }); return o; }
    function sortie(i) {
      var o = $('[data-sortie="' + i.name + '"]', form);
      if (o) o.textContent = nombre(+i.value) + (i.getAttribute('data-unite') || '');
      i.style.setProperty('--p', ((i.value - i.min) / (i.max - i.min) * 100) + '%');
    }
    // Les formules sont rappelées en clair sous le résultat
    function calcule() {
      var heures = v('emails', 0) * v('minutes', 0) * CALCUL.jours_par_semaine * CALCUL.semaines_par_an / 12 / 60;
      var temps = heures * v('taux', 45);
      var devis = v('devis', 0) * v('part', 0) / 100 * v('valeur', 0) * CALCUL.devis_recuperes_par_relance;
      return { heures: heures, temps: temps, devis: devis, mois: temps + devis, an: (temps + devis) * 12 };
    }
    function montre(r, anime) {
      cancelAnimationFrame(raf);
      var cles = Object.keys(cibles), dep = {}, t0 = performance.now(), duree = anime && !calme ? 380 : 0;
      cles.forEach(function (k) { dep[k] = affiche[k] == null ? r[k] : affiche[k]; });
      (function pas(t) {
        var p = duree ? Math.min(1, (t - t0) / duree) : 1, e = 1 - Math.pow(1 - p, 3);
        cles.forEach(function (k) { affiche[k] = dep[k] + (r[k] - dep[k]) * e; cibles[k].forEach(function (el) { el.textContent = nombre(affiche[k]); }); });
        if (p < 1) raf = requestAnimationFrame(pas);
      })(t0);
      var tot = r.mois || 1, bt = $('[data-barre="temps"] i', bloc), bd = $('[data-barre="devis"] i', bloc);
      if (bt) bt.style.setProperty('--w', Math.round(r.temps / tot * 100) + '%');
      if (bd) bd.style.setProperty('--w', Math.round(r.devis / tot * 100) + '%');
    }
    function maj(touche, anime) {
      Object.keys(champs).forEach(function (k) { sortie(champs[k]); });
      var r = calcule();
      montre(r, anime);
      if (!touche) return;
      ecrire('assysteo-calcul', JSON.stringify({ valeurs: valeurs(), resultat: r }));
      $$('#rappel-cout, [data-rappel-bloc]').forEach(function (rap) { $$('[data-rappel]', rap).forEach(function (s) { s.textContent = nombre(r.mois); }); rap.hidden = false; });
    }
    form.addEventListener('input', function () { maj(true, true); });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('change', function () {
      var a = $('[data-annonce]', bloc), r = calcule();
      if (a) a.textContent = 'En jeu : ' + nombre(r.mois) + ' euros par mois, ' + nombre(r.an) + ' euros par an.';
    });
    // Les chiffres déjà saisis dans cet onglet sont repris (page métier, retour en arrière)
    var avant = null;
    try { avant = JSON.parse(lire('assysteo-calcul') || 'null'); } catch (e) { avant = null; }
    if (avant && avant.valeurs) Object.keys(avant.valeurs).forEach(function (k) { if (champs[k]) champs[k].value = avant.valeurs[k]; });
    maj(!!avant, false);
  });

  // Détail des formules : déplié d'office sur grand écran
  if (!telephone.matches) $$('[data-ouvert-bureau]').forEach(function (d) { d.open = true; });

  /* ---------- 4. Les 4 piliers : onglets, puis un module à la fois ---------- */
  function tape(el) {
    if (calme || !el) return;
    var plein = el.getAttribute('data-plein') || el.textContent;
    el.setAttribute('data-plein', plein);
    clearTimeout(el._minuteur);
    // Le texte restant est déjà là, transparent : la hauteur ne bouge pas pendant la frappe
    el.innerHTML = '<span class="tape-vu"></span><span class="tape-reste"></span>';
    var vu = el.firstChild, reste = el.lastChild, k = 0;
    reste.textContent = plein; el.classList.add('ecrit');
    (function suite() {
      k += 2; vu.textContent = plein.slice(0, k); reste.textContent = plein.slice(k);
      if (k < plein.length) el._minuteur = setTimeout(suite, 24);
      else el._minuteur = setTimeout(function () { el.classList.remove('ecrit'); }, 900);
    })();
  }
  var barreOnglets = $('[data-onglets]');
  if (barreOnglets) (function () {
    var onglets = $$('.onglet', barreOnglets);
    var panneaux = onglets.map(function (o) { return doc.getElementById(o.getAttribute('data-cible')); });
    barreOnglets.setAttribute('role', 'tablist');
    function choisirModule(p, m, sansAnim) {
      $$('.module', p).forEach(function (x) { x.classList.toggle('actif', x === m); });
      $$('.puce', p).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('aria-controls') === m.id ? 'true' : 'false'); });
      if (!sansAnim) $$('.tape', m).forEach(tape);
    }
    function choisir(i, focus) {
      onglets.forEach(function (o, j) {
        var oui = i === j;
        o.setAttribute('aria-selected', oui ? 'true' : 'false'); o.tabIndex = oui ? 0 : -1; panneaux[j].hidden = !oui;
      });
      if (focus) onglets[i].focus();
      var m = $('.module.actif', panneaux[i]);
      if (m) $$('.tape', m).forEach(tape);
    }
    onglets.forEach(function (o, i) {
      var p = panneaux[i];
      o.id = 'onglet-' + p.id; o.setAttribute('role', 'tab'); o.setAttribute('aria-controls', p.id);
      p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', o.id);
      var mods = $$('.module', p), puces = doc.createElement('div');
      puces.className = 'puces defile'; puces.setAttribute('role', 'group'); puces.setAttribute('aria-label', 'Modules : ' + $('.pilier-titre', p).textContent);
      mods.forEach(function (m) {
        var b = doc.createElement('button'), dem = m.classList.contains('sur-demande');
        b.type = 'button'; b.className = 'pastille claire puce' + (dem ? ' demande' : '');
        b.setAttribute('aria-controls', m.id); b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<span class="pt" aria-hidden="true"></span>' + esc($('h4', m).textContent) + (dem ? '<span class="sr"> (sur demande)</span>' : '');
        b.addEventListener('click', function () { choisirModule(p, m); });
        puces.appendChild(b);
      });
      p.insertBefore(puces, $('.modules', p));
      choisirModule(p, mods[0], true);
      o.addEventListener('click', function () { choisir(i, false); });
    });
    barreOnglets.addEventListener('keydown', function (e) {
      var i = onglets.indexOf(doc.activeElement);
      var n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: onglets.length - 1 }[e.key];
      if (i < 0 || n === undefined) return;
      e.preventDefault(); choisir((n + onglets.length) % onglets.length, true);
    });
    choisir(0, false);
    // Liens du menu « Solutions » (#trouver, #m-documents…) : ouvrent le bon onglet et le bon module
    function depuisAncre() {
      var id = decodeURIComponent(location.hash.slice(1)), cible = id && doc.getElementById(id);
      var p = cible && (cible.classList.contains('pilier') ? cible : cible.closest('.pilier'));
      if (!p) return;
      choisir(panneaux.indexOf(p), false);
      if (cible.classList.contains('module')) choisirModule(p, cible);
      var sec = $('#solutions');
      if (sec) requestAnimationFrame(function () { sec.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' }); });
    }
    addEventListener('hashchange', depuisAncre);
    depuisAncre();
  })();

  /* ---------- 5. Pages métier : la scène « sans / avec », le brouillon qui s'écrit ---------- */
  $$('.scene').forEach(function (s) {
    var bs = $$('.bascule button', s);
    $$('.frise li', s).forEach(function (li, i) { li.style.setProperty('--i', i); });
    bs.forEach(function (b) {
      b.addEventListener('click', function () {
        s.setAttribute('data-mode', b.getAttribute('data-mode'));
        bs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        s.classList.remove('rejoue'); void s.offsetWidth; s.classList.add('rejoue');
      });
    });
  });
  $$('.brouillon .tape').forEach(function (el) { quandVisible(el, function () { tape(el); }, .6); });

  /* ---------- 6. Tiroir « Tout savoir » ---------- */
  var tiroir = $('#infos');
  if (tiroir) (function () {
    var panneau = $('.tiroir-panneau', tiroir), avant = null;
    var menus = $$('.menu-btn');
    tiroir.setAttribute('role', 'dialog'); tiroir.setAttribute('aria-modal', 'true');
    menus.forEach(function (b) { b.setAttribute('role', 'button'); b.setAttribute('aria-expanded', 'false'); });
    function chemin(p) { return p.replace(/index\.html$/, ''); }
    function dedans(hash) {
      if (!hash || hash.length < 2) return null;
      var el = doc.getElementById(decodeURIComponent(hash.slice(1)));
      return el && tiroir.contains(el) || el === tiroir ? el : null;
    }
    function ouvert() { return tiroir.classList.contains('ouvert'); }
    function ouvrir(cible) {
      if (!ouvert()) {
        avant = doc.activeElement;
        tiroir.classList.add('ouvert'); racine.classList.add('tiroir-ouvert');
        menus.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      }
      var d = cible && cible !== tiroir ? (cible.tagName === 'DETAILS' ? cible : cible.closest('details')) : null;
      if (d) {
        d.open = true;
        requestAnimationFrame(function () { d.scrollIntoView({ block: 'start' }); var s = $('summary', d); if (s) s.focus({ preventScroll: true }); });
      } else {
        panneau.scrollTop = 0;
        $('.tiroir-fermer', tiroir).focus();
      }
    }
    function fermer() {
      tiroir.classList.remove('ouvert'); racine.classList.remove('tiroir-ouvert');
      menus.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (dedans(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      if (avant && avant.focus && doc.contains(avant)) avant.focus();
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a) return;
      if (a.classList.contains('tiroir-fermer')) { e.preventDefault(); return fermer(); }
      var url = new URL(a.getAttribute('href'), location.href);
      if (chemin(url.pathname) !== chemin(location.pathname)) return;
      var el = dedans(url.hash);
      if (el) { e.preventDefault(); return ouvrir(el); }
      if (ouvert() && tiroir.contains(a)) fermer();   // lien vers une section de la page : on ferme, puis la page défile
    });
    tiroir.addEventListener('click', function (e) { if (e.target === tiroir) fermer(); });
    doc.addEventListener('keydown', function (e) {
      if (!ouvert()) return;
      if (e.key === 'Escape') { e.preventDefault(); return fermer(); }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), summary, input', panneau).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    var auDepart = dedans(location.hash);
    if (auDepart) ouvrir(auDepart);
    addEventListener('hashchange', function () { var el = dedans(location.hash); if (el) ouvrir(el); });
  })();

  /* ---------- 7. Menus déroulants de l'en-tête ---------- */
  var deroules = $$('.deroule details');
  deroules.forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) deroules.forEach(function (x) { if (x !== d) x.open = false; }); });
    $$('a', d).forEach(function (a) { a.addEventListener('click', function () { d.open = false; }); });
  });
  doc.addEventListener('click', function (e) { deroules.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; }); });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    deroules.forEach(function (d) { if (d.open) { d.open = false; $('summary', d).focus(); } });
  });

  /* ---------- 8. Barre d'action mobile : cachée tant qu'un bouton principal est déjà à l'écran ---------- */
  var barre = $('[data-barre-mobile]');
  if (barre && 'IntersectionObserver' in window) {
    var reperes = $$('[data-cta-principal], #quiz, [data-pied]'), vus = [];
    if (reperes.length) {
      barre.classList.add('cachee');
      var ob = new IntersectionObserver(function (en) {
        en.forEach(function (x) { vus[reperes.indexOf(x.target)] = x.isIntersecting; });
        barre.classList.toggle('cachee', vus.some(Boolean));
      });
      reperes.forEach(function (r) { ob.observe(r); });
    }
  }

  /* ---------- 9. Boutons qui ouvrent le chat ---------- */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ouvrir-chat]');
    if (!b) return;
    e.preventDefault();
    if (window.assysteoOuvrirChat) window.assysteoOuvrirChat();
    else { var c = $('.ac-bouton'); if (c) c.click(); }
  });

  /* ---------- 10. Animations en boucle en pause hors de l'écran ---------- */
  if ('IntersectionObserver' in window) {
    var op = new IntersectionObserver(function (en) { en.forEach(function (x) { x.target.classList.toggle('hors-ecran', !x.isIntersecting); }); });
    $$('.hero, .sombre.halo').forEach(function (el) { op.observe(el); });
  }
})();
