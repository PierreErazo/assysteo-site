/* Animations et interactions du site Assysteo. Aucun service tiers, aucune bibliothèque. */
(function () {
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- 1. Boîte mail animée, selon le métier ---------- */
  var METIERS = {
    immo: [
      { de: 'Sophie M.', h: '08:12', obj: 'Visite de la maison à Jambes, samedi possible ?', tags: [['t-lead', 'Lead'], ['t-draft', 'Brouillon à relire']],
        draft: 'Bonjour Madame, merci pour votre message. Des visites sont possibles samedi à 10 h ou à 11 h. Quel horaire vous convient ?' },
      { de: 'Famille Lambert', h: 'Hier', obj: 'Mise en vente : titre de propriété et PEB', tags: [['t-docs', 'Documents en attente · 2/4']] },
      { de: 'J. Peeters', h: 'Hier', obj: 'Documenten voor de verkoop van ons huis', tags: [['t-done', 'Dossier complet']] },
      { de: 'M. Henrard', h: 'Lun.', obj: "Question sur l'offre reçue pour l'appartement", tags: [['t-todo', 'À traiter']] }
    ],
    courtier: [
      { de: 'Thomas et Julie', h: '07:54', obj: 'Crédit hypothécaire, compromis signé à Jambes', tags: [['t-lead', 'Lead'], ['t-draft', 'Brouillon à relire']],
        draft: 'Bonjour, félicitations pour le compromis ! Pour lancer votre dossier, voici la liste des documents à m’envoyer…' },
      { de: 'Famille Lambert', h: 'Hier', obj: 'Re : fiches de paie et extrait de rôle', tags: [['t-docs', 'Documents en attente · 3/5']] },
      { de: 'A. Dubois', h: 'Hier', obj: 'Dégât des eaux cette nuit, photos jointes', tags: [['t-todo', 'Urgent · à rappeler']] },
      { de: 'K. Janssens', h: 'Lun.', obj: 'Autoverzekering, documenten bijgevoegd', tags: [['t-done', 'Dossier complet']] }
    ],
    energie: [
      { de: 'B. De Smet', h: 'Dim. 21:47', obj: 'Offerte warmtepomp voor ons huis', tags: [['t-lead', 'Lead'], ['t-draft', 'Brouillon à relire']],
        draft: 'Goedendag, bedankt voor uw aanvraag. Kunt u ons enkele foto’s van uw huidige installatie en uw laatste energiefactuur sturen?' },
      { de: 'M. Henrard', h: 'Hier', obj: "Problème avec l'onduleur installé le mois passé", tags: [['t-todo', 'À traiter']] },
      { de: 'Famille Collard', h: 'Hier', obj: 'Prime : photos et facture finale', tags: [['t-docs', 'Documents en attente · 1/3']] },
      { de: 'S. Durand', h: 'Lun.', obj: 'Devis panneaux solaires signé', tags: [['t-done', 'Dossier complet']] }
    ],
    compta: [
      { de: 'L. Marchal', h: '08:30', obj: 'Devenir indépendant complémentaire : vous prenez ?', tags: [['t-lead', 'Lead'], ['t-draft', 'Brouillon à relire']],
        draft: 'Bonjour Monsieur, merci pour votre message. Je vous propose un premier rendez-vous mardi ou jeudi. Quel jour vous arrange ?' },
      { de: 'Boulangerie du Confluent', h: 'Hier', obj: 'Factures d’achat du trimestre', tags: [['t-docs', 'TVA T3 · 2 pièces manquantes']] },
      { de: 'Garage Martin', h: 'Hier', obj: 'Extraits de compte juillet à septembre', tags: [['t-done', 'Dossier complet']] },
      { de: 'C. Renard', h: 'Lun.', obj: 'Courrier du SPF Finances reçu ce matin', tags: [['t-todo', 'À traiter']] }
    ]
  };
  var liste = document.querySelector('#inbox-anim .mail');
  var compteur = document.querySelector('#inbox-anim .inbox-count');
  var timers = [];
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function stop() { timers.forEach(clearTimeout); timers = []; }
  function later(f, ms) { timers.push(setTimeout(f, calme ? 0 : ms)); }
  function jouer(cle) {
    if (!liste) return;
    stop();
    var mails = METIERS[cle] || METIERS.immo;
    liste.innerHTML = '';
    if (compteur) compteur.textContent = '0 trié';
    mails.forEach(function (m, i) {
      later(function () {
        var li = document.createElement('li');
        li.className = 'arrive';
        li.innerHTML = '<div class="mail-head"><b>' + esc(m.de) + '</b><time>' + esc(m.h) + '</time></div>' +
          '<div class="mail-subj">' + esc(m.obj) + '</div><div class="tags"></div>' + (m.draft ? '<div class="draft"><span class="caret"></span></div>' : '');
        liste.appendChild(li);
        requestAnimationFrame(function () { li.classList.add('in'); });
        var tags = li.querySelector('.tags');
        m.tags.forEach(function (t, j) {
          later(function () {
            var s = document.createElement('span');
            s.className = 'tag pop ' + t[0]; s.textContent = t[1];
            tags.appendChild(s);
            if (j === 0 && compteur) compteur.textContent = (i + 1) + ' trié' + (i ? 's' : '');
          }, 450 + j * 220);
        });
        if (m.draft) {
          var d = li.querySelector('.draft'), caret = d.querySelector('.caret'), k = 0;
          var txt = document.createTextNode(''); d.insertBefore(txt, caret);
          later(function tape() {
            if (calme) { txt.data = m.draft; caret.remove(); return; }
            txt.data = m.draft.slice(0, ++k);
            if (k < m.draft.length) timers.push(setTimeout(tape, 22)); else timers.push(setTimeout(function () { caret.remove(); }, 1200));
          }, 900);
        }
      }, i === 0 ? 150 : 900 + i * 650);
    });
  }
  var pills = document.querySelectorAll('.metier-pill');
  pills.forEach(function (p) {
    p.addEventListener('click', function () {
      pills.forEach(function (q) { q.setAttribute('aria-pressed', q === p ? 'true' : 'false'); });
      jouer(p.dataset.metier);
    });
  });
  var rejouer = document.querySelector('.inbox-replay');
  if (rejouer) rejouer.addEventListener('click', function () {
    var actif = document.querySelector('.metier-pill[aria-pressed="true"]');
    jouer(actif ? actif.dataset.metier : 'immo');
  });
  if (liste) jouer('immo');

  /* ---------- 2. Calculateur de temps ---------- */
  var nb = document.getElementById('calc-emails'), mn = document.getElementById('calc-minutes');
  var outH = document.getElementById('calc-h'), outJ = document.getElementById('calc-j');
  var vNb = document.getElementById('calc-emails-v'), vMn = document.getElementById('calc-minutes-v');
  var affiche = { h: 0, j: 0 }, anim;
  function fmt(x) { return Math.round(x).toLocaleString('fr-BE'); }
  function versValeurs(cibleH, cibleJ) {
    cancelAnimationFrame(anim);
    var depH = affiche.h, depJ = affiche.j, t0 = performance.now(), dur = calme ? 0 : 500;
    (function pas(t) {
      var p = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
      affiche.h = depH + (cibleH - depH) * e; affiche.j = depJ + (cibleJ - depJ) * e;
      outH.textContent = fmt(affiche.h); outJ.textContent = fmt(affiche.j);
      if (p < 1) anim = requestAnimationFrame(pas);
    })(t0);
  }
  function calcule() {
    var e = +nb.value, m = +mn.value;
    vNb.textContent = e; vMn.textContent = m;
    [nb, mn].forEach(function (r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); });
    var hSemaine = e * m * 5 / 60;
    versValeurs(hSemaine, hSemaine * 46 / 8);   // 46 semaines travaillées, journées de 8 h
  }
  if (nb && mn) {
    nb.addEventListener('input', calcule); mn.addEventListener('input', calcule);
    var calcVu = false;
    var oc = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && !calcVu) { calcVu = true; calcule(); oc.disconnect(); }
    }, { threshold: .35 }) : null;
    if (oc) oc.observe(nb.closest('section')); else calcule();
  }

  /* ---------- 3. Apparition au défilement ---------- */
  var cibles = document.querySelectorAll('main section h2, main .intro, .tile, .steps li, .ai-card, .trust .card, .price, .pilot, .faq details, .cta-box, .pain-chips li, .label-strip, .ai-cta, .stat-calc-box');
  if (!calme && 'IntersectionObserver' in window) {
    var oo = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('vu'); oo.unobserve(x.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    cibles.forEach(function (el) {
      if (el.closest('.hero')) return;
      var freres = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.tagName === el.tagName; });
      el.style.transitionDelay = Math.min(freres.indexOf(el), 5) * 90 + 'ms';
      el.classList.add('reveal'); oo.observe(el);
    });
  }

  /* ---------- 4. En-tête et barre de progression ---------- */
  var tete = document.querySelector('.site-header'), barre = document.querySelector('.progress');
  var enAttente = false, max = 0, etatTete = null;
  function mesure() { max = document.documentElement.scrollHeight - innerHeight; }
  function defile() {
    enAttente = false;
    var y = window.scrollY, haut = y > 10;
    if (tete && haut !== etatTete) { tete.classList.toggle('scrolled', haut); etatTete = haut; }
    if (barre) barre.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
  }
  // Une seule mise à jour par image affichée, quelle que soit la vitesse de défilement
  addEventListener('scroll', function () { if (!enAttente) { enAttente = true; requestAnimationFrame(defile); } }, { passive: true });
  addEventListener('resize', function () { mesure(); defile(); }, { passive: true });
  addEventListener('load', mesure);
  if ('ResizeObserver' in window) new ResizeObserver(mesure).observe(document.body);
  mesure(); defile();

  /* Animations en boucle mises en pause quand elles sortent de l'écran */
  if ('IntersectionObserver' in window) {
    var op = new IntersectionObserver(function (en) {
      en.forEach(function (x) { x.target.classList.toggle('hors-ecran', !x.isIntersecting); });
    });
    document.querySelectorAll('.hero, .marquee, section.ai').forEach(function (el) { op.observe(el); });
  }
  /* Onglet en arrière-plan : on arrête l'écriture de la boîte mail */
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

  /* ---------- 5. Cartes IA : léger effet 3D au survol (souris uniquement) ---------- */
  if (!calme && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.ai-card').forEach(function (c) {
      var r, ev, prevu = false;
      c.addEventListener('mouseenter', function () { r = c.getBoundingClientRect(); });
      c.addEventListener('mousemove', function (e) {
        ev = e; if (prevu) return; prevu = true;
        requestAnimationFrame(function () {
          prevu = false; if (!ev || !r) return;
          var x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5;
          c.style.transform = 'perspective(900px) rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg) translateY(-4px)';
          c.style.setProperty('--mx', (x + .5) * 100 + '%'); c.style.setProperty('--my', (y + .5) * 100 + '%');
        });
      });
      c.addEventListener('mouseleave', function () { ev = null; c.style.transform = ''; });
    });
  }
})();
