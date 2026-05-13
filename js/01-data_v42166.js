/* ============================================================
   js/01-data.js — Données par défaut
   ============================================================ */

const DEFAULT_BUDGETS = {
  revenus:  { 'Revenus autres': 0 },
  depenses: {
    'Carburant': 150, 'Courses': 300, 'Imprévus': 200,
    'Restaurant': 80, 'Santé': 40, 'Shopping': 60
  },
  /* clé interne = "abonnements", libellé affiché = "Abonnements" */
  abonnements: {
    'Assurance Auto': 0, 'Assurance Habitation': 0,
    'Box Internet': 20, 'Crèche': 0,
    'Eau': 0, 'Électricité': 100, 'Gaz': 0,
    'Loyer Logement': 700, 'Netflix': 0,
    'Spotify': 0, 'Téléphone': 60
  },
  credits:  { 'Auto': 0, 'Conso': 0, 'Habitation': 0 },
  epargne:  { 'Épargne': 200 },
  projets:  { 'Autres': 100, 'Vacances': 200 }
};

const DEFAULT_PRETS        = [];
const DEFAULT_TRANSACTIONS = [];
const DEFAULT_ABONNEMENTS  = [];
const DEFAULT_EPA_TOTALS   = { 'Épargne': 2400 };
const DEFAULT_PRO_TOTALS   = { 'Vacances': 2000, 'Autres': 1000 };
const DEFAULT_PERSONS      = { count:2, person1:'Personne 1', person2:'Personne 2', person3:null, person4:null };
const DEFAULT_BUDGET_PREV  = {};

/* setSyncBadge — défini ici car 02-database.js l'appelle au chargement
   La version complète dans 04-app.js remplace celle-ci automatiquement */
function setSyncBadge(text) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const clr = (text.includes('Synchronisé')||text.includes('Sauvegardé')) ? '#1D9E75'
             : (text.includes('⚠')||text.includes('📴')) ? '#BA7517' : '#999';
  el.innerHTML = `<span class="sync-dot" style="background:${clr}"></span>`;
  el.title = text;
}
