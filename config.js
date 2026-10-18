/* ═══════════════════════════════════════════════════════════════════════
   Réglages du site Assysteo : le SEUL fichier à modifier pour changer
   les places pilotes, les prix, les adresses des formulaires et les compteurs.
   (Seule l'adresse du chat reste dans chat.js, variable ADRESSE.)

   Les pages gardent aussi une valeur « de secours » dans le HTML (pour Google
   et pour les visiteurs sans JavaScript). Après une modification, lancez :
       python3 outils/verifier_site.py
   Il liste les pages où la valeur de secours n'est plus la même.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Programme pilote ─────────────────────────────────────────────────────
   Places encore libres (installation offerte). Affiché à plusieurs endroits.
   À 0, le site affiche tout seul « Programme complet, liste d'attente ». */
var PLACES_PILOTE_RESTANTES = 3;
var PLACES_PILOTE_TOTAL = 3;

/* ── Mini-diagnostic ──────────────────────────────────────────────────────
   Adresse du webhook n8n qui reçoit les réponses en POST (JSON).
   Vide : le bouton « Envoyer à Pierre » ouvre un email prérempli vers contact@assysteo.be.
   Le webhook doit accepter l'origine https://assysteo.be (option « Allowed Origins »). */
var WEBHOOK_DIAGNOSTIC = '';

/* ── Démo du contrôle des documents ───────────────────────────────────────
   Formulaire de démo n8n. Vide : le bouton « Tester la démo » est masqué. */
var URL_DEMO_DOCUMENTS = 'https://n8n.assysteo.be/form/bf5906ae-5a53-52d1-bc58-230468a14867';

/* ── Réservation de l'audit gratuit (formulaire n8n, lien de secours) ────── */
var URL_RESERVATION = 'https://n8n.assysteo.be/form/9b2f6c1e-4d7a-4e3b-8a51-3c0d2e7f9a64';

/* ── Questionnaire de diagnostic n8n (proposé aux visiteurs sans JavaScript) ── */
var URL_QUESTIONNAIRE = 'https://n8n.assysteo.be/form/41a3e6dd-3005-527a-b055-37d01f474d98';

/* ── Photo de Pierre ──────────────────────────────────────────────────────
   Mettez 'img/pierre.webp' quand le fichier est dans le dossier img/
   (photo carrée, 480 × 480 px, en WebP). Vide : un portrait dessiné s'affiche. */
var PHOTO_PIERRE = '';

/* ── Compteurs « Assysteo tourne avec ses propres agents » ────────────────
   null = compteur caché. Uniquement des chiffres vrais, relevés dans n8n
   (tableau des indicateurs du CEO). Jamais d'estimation. */
var STATS = {
  emails_tries: null,   // emails triés par la secrétaire depuis le départ
  relances: null,       // relances préparées
  prospects: null       // entreprises étudiées par le prospecteur
};

/* ── Témoignages ──────────────────────────────────────────────────────────
   Seulement avec l'accord écrit de la personne. Liste vide = bloc caché.
   Exemple : { texte: "…", nom: "Prénom Nom", fonction: "Gérante", entreprise: "Nom de l'entreprise" } */
var TEMOIGNAGES = [];

/* ── Prix, en euros hors TVA ──────────────────────────────────────────────
   À VALIDER par Pierre : diagnostic_ecrit et les deux prix « croissance ».
   Pensez aussi au chat du site et au Diagnostic n8n (mêmes prix partout). */
var PRIX = {
  diagnostic_ecrit: 290,          // À VALIDER : déduit si le client installe
  essentiel_installation: 490,    // déjà publié
  essentiel_mois: 79,             // déjà publié
  croissance_installation: 1900,  // À VALIDER
  croissance_mois: 190            // À VALIDER
};

/* ── Hypothèses du calculateur (rappelées en clair sous le résultat) ────── */
var CALCUL = {
  jours_par_semaine: 5,
  semaines_par_an: 46,
  // Part des devis non relancés qui auraient été signés avec une relance.
  // Hypothèse prudente (1 sur 10), à confirmer pendant le diagnostic.
  devis_recuperes_par_relance: 0.10
};
