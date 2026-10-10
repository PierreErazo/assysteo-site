/* Bulle de chat Assysteo.
   Envoie les messages à l'agent d'accueil (workflow n8n « 💬 Assysteo : agent d'accueil du site »)
   et affiche ses réponses. Aucun cookie, aucun service tiers : la conversation reste dans
   l'onglet (sessionStorage) et disparaît à sa fermeture. */
(function () {
  'use strict';

  var ADRESSE = 'https://n8n.assysteo.be/webhook/709a6543-9a79-5089-b3ce-e0975ebcad26/chat';
  var LONGUEUR_MAX = 1500;
  var DELAI_MAX = 90000;  // la 1re réponse après un redémarrage du serveur peut prendre ~40 s
  var ACCUEIL = [
    "Bonjour ! Je suis l'assistant virtuel d'Assysteo, une intelligence artificielle.",
    "Posez-moi vos questions sur l'assistant email, les tarifs ou l'audit gratuit. Si vous le souhaitez, je transmets aussi votre demande à Pierre."
  ];
  var SECOURS = "Le chat ne répond pas pour le moment. Vous pouvez appeler Pierre au [0472 99 14 85](tel:+32472991485) ou écrire à [contact@assysteo.be](mailto:contact@assysteo.be).";

  // ── Mémoire de l'onglet (peut être indisponible : navigation privée, stockage bloqué) ──
  function lire(cle) { try { return window.sessionStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, valeur) { try { window.sessionStorage.setItem(cle, valeur); } catch (e) { /* sans effet */ } }

  function nouvelleSession() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  var session = lire('assysteo-chat-session') || nouvelleSession();
  ecrire('assysteo-chat-session', session);
  var historique = [];
  try { historique = JSON.parse(lire('assysteo-chat-historique') || '[]') || []; } catch (e) { historique = []; }

  // ── Texte de l'agent → HTML sûr (gras, liens, listes) ──
  function echapper(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function enLigne(t) {
    var s = echapper(t);
    s = s.replace(/\[([^\]]+)\]\(((?:https:\/\/|mailto:|tel:)[^\s)]+)\)/g, function (_, texte, url) {
      var externe = url.indexOf('https://') === 0;
      return '<a href="' + url + '"' + (externe ? ' target="_blank" rel="noopener"' : '') + '>' + texte + '</a>';
    });
    s = s.replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s;
  }
  function enHtml(texte) {
    var lignes = String(texte || '').replace(/\r/g, '').split('\n');
    var html = '', liste = false, paragraphe = [];
    function fermerParagraphe() { if (paragraphe.length) { html += '<p>' + paragraphe.join('<br>') + '</p>'; paragraphe = []; } }
    function fermerListe() { if (liste) { html += '</ul>'; liste = false; } }
    lignes.forEach(function (l) {
      var m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (m) { fermerParagraphe(); if (!liste) { html += '<ul>'; liste = true; } html += '<li>' + enLigne(m[1]) + '</li>'; }
      else if (!l.trim()) { fermerParagraphe(); fermerListe(); }
      else { fermerListe(); paragraphe.push(enLigne(l.replace(/^#+\s*/, ''))); }
    });
    fermerParagraphe(); fermerListe();
    return html;
  }

  // ── Construction de l'interface ──
  var icone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  var bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ac-bouton';
  bouton.setAttribute('aria-expanded', 'false');
  bouton.setAttribute('aria-controls', 'ac-panneau');
  bouton.innerHTML = icone + '<span>Une question&nbsp;?</span>';

  var panneau = document.createElement('div');
  panneau.id = 'ac-panneau';
  panneau.className = 'ac-panneau';
  panneau.hidden = true;
  panneau.setAttribute('role', 'dialog');
  panneau.setAttribute('aria-label', "Chat avec l'assistant IA d'Assysteo");
  panneau.innerHTML =
    '<div class="ac-entete"><img class="ac-logo" src="favicon.svg" alt="" width="34" height="34"><div class="ac-entete-texte">' +
      '<p class="ac-titre">Assistant Assysteo</p>' +
      '<p class="ac-sous-titre">Intelligence artificielle · peut se tromper</p></div>' +
      '<button type="button" class="ac-fermer" aria-label="Fermer le chat">×</button></div>' +
    '<div class="ac-messages" aria-live="polite"></div>' +
    '<form class="ac-formulaire">' +
      '<label class="sr-only" for="ac-saisie" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Votre message</label>' +
      '<textarea id="ac-saisie" class="ac-saisie" rows="1" maxlength="' + LONGUEUR_MAX + '" placeholder="Votre question…"></textarea>' +
      '<button type="submit" class="ac-envoyer" aria-label="Envoyer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button>' +
    '</form>' +
    '<p class="ac-pied">Réponses générées par une IA (OpenAI). N\'indiquez pas de données sensibles. <a href="confidentialite.html#chat">Confidentialité</a></p>';

  document.body.appendChild(bouton);
  document.body.appendChild(panneau);
  var zone = panneau.querySelector('.ac-messages');
  var formulaire = panneau.querySelector('.ac-formulaire');
  var saisie = panneau.querySelector('.ac-saisie');
  var envoyer = panneau.querySelector('.ac-envoyer');
  var enCours = false;

  // ── Téléphones ──
  // iPhone : Safari zoome la page quand on touche un champ ; maximum-scale l'en empêche
  // (le zoom à deux doigts reste possible sur iOS). Pas appliqué ailleurs : sur Android,
  // ce réglage bloquerait aussi le zoom volontaire.
  var petitEcran = window.matchMedia('(max-width: 520px)');
  var iOS = /iP(hone|ad|od)/.test(navigator.platform || '') ||
            (/Mac/.test(navigator.userAgent) && 'ontouchend' in document);
  if (iOS) {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp && !/maximum-scale/.test(vp.content)) vp.content += ', maximum-scale=1';
  }
  // Quand le clavier s'ouvre, la zone visible rétrécit : le chat s'y cale au lieu d'être décalé.
  function caler() {
    var vv = window.visualViewport;
    if (panneau.hidden || !petitEcran.matches || !vv) {
      panneau.style.top = panneau.style.bottom = panneau.style.height = '';
      return;
    }
    panneau.style.top = (vv.offsetTop + 12) + 'px';
    panneau.style.bottom = 'auto';
    panneau.style.height = Math.max(vv.height - 24, 220) + 'px';
    zone.scrollTop = zone.scrollHeight;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', caler);
    window.visualViewport.addEventListener('scroll', caler);
  }

  function ajouter(qui, texte, garder) {
    var div = document.createElement('div');
    div.className = 'ac-msg ' + (qui === 'moi' ? 'ac-moi' : qui === 'erreur' ? 'ac-erreur' : 'ac-bot');
    if (qui === 'moi') div.textContent = texte; else div.innerHTML = enHtml(texte);
    zone.appendChild(div);
    zone.scrollTop = zone.scrollHeight;
    if (garder) {
      historique.push({ q: qui, t: texte });
      ecrire('assysteo-chat-historique', JSON.stringify(historique.slice(-40)));
    }
  }

  function afficherDebut() {
    zone.innerHTML = '';
    ACCUEIL.forEach(function (t) { ajouter('bot', t, false); });
    historique.forEach(function (m) { ajouter(m.q, m.t, false); });
  }

  function ouvrir() {
    if (!zone.childNodes.length) afficherDebut();
    panneau.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('ac-ouvert');
    caler();
    // Sur téléphone, pas de clavier d'office : il s'ouvre quand on touche le champ.
    if (!petitEcran.matches) saisie.focus();
    zone.scrollTop = zone.scrollHeight;
  }
  function fermer() {
    panneau.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('ac-ouvert');
    caler();
    bouton.focus();
  }

  function ajusterHauteur() {
    saisie.style.height = 'auto';
    saisie.style.height = Math.min(saisie.scrollHeight, 120) + 'px';
  }

  function reponseDe(donnees) {
    var d = Array.isArray(donnees) ? donnees[0] : donnees;
    if (!d) return '';
    if (typeof d === 'string') return d;
    return d.output || d.text || d.message || '';
  }

  function envoyerMessage(texte) {
    enCours = true;
    envoyer.disabled = true;
    ajouter('moi', texte, true);
    var attente = document.createElement('div');
    attente.className = 'ac-msg ac-bot ac-ecrit';
    attente.setAttribute('aria-label', "L'assistant écrit");
    attente.innerHTML = '<span></span><span></span><span></span>';
    zone.appendChild(attente);
    zone.scrollTop = zone.scrollHeight;

    var controle = window.AbortController ? new AbortController() : null;
    var minuterie = setTimeout(function () { if (controle) controle.abort(); }, DELAI_MAX);
    fetch(ADRESSE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId: session, chatInput: texte }),
      signal: controle ? controle.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (donnees) {
        var t = reponseDe(donnees);
        if (!t) throw new Error('réponse vide');
        ajouter('bot', t, true);
      })
      .catch(function () { ajouter('erreur', SECOURS, false); })
      .then(function () {
        clearTimeout(minuterie);
        if (attente.parentNode) attente.parentNode.removeChild(attente);
        enCours = false;
        envoyer.disabled = false;
        if (!petitEcran.matches) saisie.focus();
      });
  }

  bouton.addEventListener('click', ouvrir);
  // Permet au bouton « Essayer l'agent maintenant » du site d'ouvrir la bulle
  window.assysteoOuvrirChat = ouvrir;
  panneau.querySelector('.ac-fermer').addEventListener('click', fermer);
  panneau.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  saisie.addEventListener('input', ajusterHauteur);
  saisie.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); formulaire.requestSubmit ? formulaire.requestSubmit() : formulaire.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  formulaire.addEventListener('submit', function (e) {
    e.preventDefault();
    var texte = saisie.value.trim();
    if (!texte || enCours) return;
    saisie.value = '';
    ajusterHauteur();
    envoyerMessage(texte.slice(0, LONGUEUR_MAX));
  });
})();
