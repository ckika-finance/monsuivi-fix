/* ============================================================
   js/03-utils.js — Fonctions utilitaires
   ============================================================ */

const fmt  = v => Math.abs(v)<0.001 ? '-' : Math.abs(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const fmtS = v => Math.abs(v)<0.001 ? '-' : Math.abs(v).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €';
const uid  = () => 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);

const THIS_YEAR = new Date().getFullYear();

function getTxByMonthYear(month, year) {
  return DB.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth()+1===month && d.getFullYear()===year;
  });
}
function getTxByYear(year) {
  return DB.transactions.filter(t => new Date(t.date).getFullYear()===year);
}
function getAvailableYears() {
  const s = new Set(DB.transactions.map(t => new Date(t.date).getFullYear()));
  s.add(THIS_YEAR);
  return [...s].sort((a,b)=>b-a);
}
/* isPastYear défini dans 11-permissions.js (basé sur canEdit) */

const sumType   = (txs,type) => txs.filter(t=>t.type===type).reduce((s,t)=>s+Math.abs(t.amount),0);
const realByCat = (txs,type) => { const r={}; txs.filter(t=>t.type===type).forEach(t=>{r[t.label]=(r[t.label]||0)+Math.abs(t.amount);}); return r; };
const pct       = (real,bud,max=150) => bud<=0?0:Math.min(max,Math.round(real/bud*100));
const budgetStatus = (r,b) => { if(b<=0) return 'OK'; const v=r/b; return v>1?'Dépassé':v>0.85?'Limite':'OK'; };

/* Solde net = revenus - (dépenses + abonnements + crédits) */
function soldeNet(txs) {
  return sumType(txs,'revenus') - sumType(txs,'depenses') - sumType(txs,'abonnements') - sumType(txs,'credits');
}
/* Solde net pour une personne — Commun divisé par le nombre réel de personnes */
function soldeNetForPerson(txs, owner) {
  const types = ['revenus','depenses','abonnements','credits'];
  const n = getPersonCount();
  let total = 0;
  types.forEach(type => {
    txs.filter(t=>t.type===type).forEach(t => {
      let share = Math.abs(t.amount);
      if (t.owner==='Commun') share /= n;
      else if (t.owner!==owner) return;
      total += (type==='revenus') ? share : -share;
    });
  });
  return total;
}

/* "abonnements" → libellé "Abonnement" partout dans l'UI */
/* Nombre réel de personnes dans le compte (min 1 pour éviter division par 0) */
function getPersonCount() {
  return Math.max(1, getActivePersons().length);
}

/* Label dynamique pour l'option "Commun" dans les sélecteurs */
function communLabel() {
  const n = getPersonCount();
  if (n <= 1) return 'Commun';
  return 'Commun (' + n + ' personne' + (n > 1 ? 's' : '') + ')';
}

const TYPE_LABELS     = {revenus:'Revenu',depenses:'Dépense',abonnements:'Abonnement',credits:'Crédit',epargne:'Épargne',projets:'Projet'};
const TYPE_COLORS     = {revenus:'#1D9E75',depenses:'#D85A30',abonnements:'#378ADD',credits:'#BA7517',epargne:'#534AB7',projets:'#D4537E'};
const TYPE_BADGE      = {revenus:'badge-rev',depenses:'badge-dep',abonnements:'badge-abo',credits:'badge-cre',epargne:'badge-epa',projets:'badge-pro'};
const TYPE_HEADER_CLS = {revenus:'rev',depenses:'dep',abonnements:'abo',credits:'cre',epargne:'epa',projets:'pro'};

/* ============================================================
   CALCUL AUTOMATIQUE CAPITAL RESTANT + DURÉE RESTANTE
   Simule les mensualités déjà passées depuis la date de début
   ============================================================ */

/**
 * Calcule le capital restant et la durée restante à ce jour.
 * @param {number} capitalInitial - Capital à la souscription
 * @param {number} tauxAnnuel     - Taux annuel en %
 * @param {number} mensualite     - Mensualité fixe
 * @param {number} dureeTotal     - Durée totale en mois
 * @param {string} dateDebutStr   - "YYYY-MM-DD" ou "YYYY-MM-01"
 * @returns {{ capitalRestant, dureeRestante, moisEcoules }}
 */
function _computeCapitalActuel(capitalInitial, tauxAnnuel, mensualite, dureeTotal, dateDebutStr) {
  if (!dateDebutStr || !capitalInitial || !mensualite) {
    return { capitalRestant: capitalInitial || 0, dureeRestante: dureeTotal || 0, moisEcoules: 0 };
  }

  const today = new Date();
  const debut = new Date(dateDebutStr);

  /* Nombre de mensualités déjà passées (inclure le mois courant) */
  const moisEcoules = Math.max(0,
    (today.getFullYear() - debut.getFullYear()) * 12 +
    (today.getMonth() - debut.getMonth())
  );

  if (moisEcoules === 0) {
    return { capitalRestant: capitalInitial, dureeRestante: dureeTotal, moisEcoules: 0 };
  }

  const tauxMens = (tauxAnnuel || 0) / 100 / 12;
  let capital = capitalInitial;

  const moisAPasser = Math.min(moisEcoules, dureeTotal);
  for (let i = 0; i < moisAPasser && capital > 0.01; i++) {
    const partInt = Math.round(capital * tauxMens * 100) / 100;
    const partCap = Math.min(capital, Math.round((mensualite - partInt) * 100) / 100);
    capital = Math.max(0, Math.round((capital - partCap) * 100) / 100);
  }

  const dureeRestante = Math.max(0, dureeTotal - moisEcoules);
  return { capitalRestant: capital, dureeRestante, moisEcoules };
}

/* ---- Injection automatique des abonnements comme transactions ---- */
function injectAbonnementsTransactions() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const dateStr = `${year}-${String(month).padStart(2,'0')}-01`;
  let changed = false;

  DB.abonnements.forEach(abo => {
    /* Vérifier si une transaction auto existe déjà pour ce mois */
    const key   = `abo_auto_${abo.id}_${year}_${month}`;
    const exist = DB.transactions.find(t => t._aboKey === key);
    if (exist) return;

    DB.transactions.push({
      id:      uid(),
      _aboKey: key,
      date:    dateStr,
      label:   abo.name,
      type:    'abonnements',
      owner:   abo.owner || 'Commun',
      amount:  -Math.abs(abo.amount),
      comment: 'Abonnement auto'
    });
    changed = true;
  });

  /* Sauvegarder si de nouvelles transactions ont été créées */
  if (changed && typeof saveDB === 'function') saveDB();
}

/* ---- Injection automatique des mensualités de prêts ---- */
/* Injecte UNE transaction par mois pour chaque prêt, depuis startDate jusqu'à aujourd'hui */
function injectPretsTransactions() {
  const today = new Date();
  const todayYear  = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  let changed = false;

  DB.prets.forEach(pret => {
    if (!pret.startDate) return; /* Ignorer les prêts sans date de début */

    const start      = new Date(pret.startDate);
    const startYear  = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const creditCat  = pret.type === 'Logement' ? 'Habitation' : (pret.type || 'Conso');

    /* Parcourir chaque mois de startDate jusqu'à aujourd'hui inclus */
    let y = startYear, m = startMonth;
    while (y < todayYear || (y === todayYear && m <= todayMonth)) {
      const key   = `pret_auto_${pret.id}_${y}_${m}`;
      const exist = DB.transactions.find(t => t._pretKey === key);

      if (!exist) {
        const dateStr = `${y}-${String(m).padStart(2,'0')}-01`;
        DB.transactions.push({
          id:       uid(),
          _pretKey: key,
          date:     dateStr,
          label:    creditCat,
          type:     'credits',
          owner:    pret.owner || 'Commun',
          amount:   -Math.abs(pret.mensualite),
          comment:  `Mensualité ${pret.nom}`
        });
        changed = true;
      }

      /* Avancer d'un mois */
      m++;
      if (m > 12) { m = 1; y++; }
    }
  });

  if (changed && typeof saveDB === 'function') saveDB();
}

/* ---- Transfert solde → épargne en début de mois ---- */
function checkMonthlyTransfer() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const key   = `transfer_${year}_${month}`;
  if (DB.monthlyTransferDone && DB.monthlyTransferDone[key]) return;

  /* Calculer le solde du mois précédent */
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevTxs   = getTxByMonthYear(prevMonth, prevYear);
  const solde     = soldeNet(prevTxs);

  if (solde <= 0) {
    /* Découvert — géré ailleurs */
    _markTransferDone(key);
    return;
  }

  /* Trouver la première catégorie d'épargne */
  const epaCats = Object.keys(DB.budgets.epargne || {});
  const epaCat  = epaCats[0] || 'Épargne';
  const dateStr = `${year}-${String(month).padStart(2,'0')}-01`;

  /* Créer transaction épargne auto */
  const tKey = `epargne_auto_${year}_${month}`;
  const exist = DB.transactions.find(t => t._transferKey === tKey);
  if (!exist) {
    DB.transactions.push({
      id:           uid(),
      _transferKey: tKey,
      date:         dateStr,
      label:        epaCat,
      type:         'epargne',
      owner:        'Commun',
      amount:       solde,
      comment:      `Transfert auto solde ${MONTHS_FR[prevMonth-1]}`
    });
    saveDB();
  }
  _markTransferDone(key);
}

function _markTransferDone(key) {
  if (!DB.monthlyTransferDone) DB.monthlyTransferDone = {};
  DB.monthlyTransferDone[key] = true;
}

/* ---- Vérification découvert ---- */
function checkDecouvert() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const txs   = getTxByMonthYear(month, year);
  const tRev  = sumType(txs,'revenus');
  const tDep  = sumType(txs,'depenses') + sumType(txs,'abonnements') + sumType(txs,'credits');
  const solde = tRev - tDep;

  if (solde >= 0) return null; /* Pas de découvert */

  const montant = Math.abs(solde);

  /* Vérifier si épargne disponible */
  const epaTotal = Object.values(DB.epa_totals||{}).reduce((a,b)=>a+b,0);
  if (epaTotal > 0) {
    return { type:'epargne', montant, message:`Découvert couvert par l'épargne (-${fmt(montant)})` };
  } else {
    return { type:'credit', montant, message:`Découvert ${Math.round(montant)}` };
  }
}

const p1 = () => DB.persons.person1;
const p2 = () => DB.persons.person2;

/* Retourne tous les noms de personnes actives pour les filtres */
function getAllOwners() {
  const list = [];
  getActivePersons().forEach(p => {
    if (p.name) list.push(p.name);
  });
  return list;
}

function amountForPerson(tx, owner) {
  if (tx.owner==='Commun') return Math.abs(tx.amount) / getPersonCount();
  if (tx.owner===owner)    return Math.abs(tx.amount);
  return 0;
}
function persoRealByCat(txs, type, owner) {
  const r={};
  txs.filter(t=>t.type===type).forEach(t=>{
    /* Pour les revenus : afficher UNIQUEMENT les revenus propres à la personne
       (ni Commun, ni les revenus d'une autre personne) */
    if (type === 'revenus') {
      if (t.owner !== owner) return; /* ignorer Commun et autres personnes */
      r[t.label]=(r[t.label]||0)+Math.abs(t.amount);
      return;
    }
    /* Pour les autres types : Commun divisé par le nombre réel de personnes */
    let share = Math.abs(t.amount);
    if (t.owner==='Commun') share /= getPersonCount();
    else if (t.owner!==owner) return;
    r[t.label]=(r[t.label]||0)+share;
  });
  return r;
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/* Retourne les transactions selon currentMonth et currentYear.
   currentMonth = 0  → toute l'année
   currentMonth = 1-12 → mois précis */
function getTxCurrent() {
  if (currentMonth === 0) return getTxByYear(currentYear);
  return getTxByMonthYear(currentMonth, currentYear);
}

/* Label lisible de la période affichée */
function currentPeriodLabel() {
  if (currentMonth === 0) return 'Année ' + currentYear;
  return MONTHS_FR[currentMonth - 1] + ' ' + currentYear;
}

function confirmDelete(msg) {
  return confirm('⚠️ '+msg+'\n\nCette action est irréversible.');
}

/* ============================================================
   BUDGET PAR PERSONNE — 50/50 sauf salaires
   ============================================================ */

/**
 * Retourne le budget prévisionnel ajusté pour une personne donnée.
 * Règle :
 *   - Revenus "salaire" → 100 % pour la personne concernée, 0 % pour les autres
 *   - Tous les autres postes → divisés par le nombre réel de personnes
 *
 * @param {number|string} year  - Année
 * @param {string}        owner - Nom de la personne (ex: "Alice")
 * @returns {object} Budget clone avec montants divisés
 */
function getBudgetForPerson(year, owner) {
  const base  = getBudgetForYear(year);
  const clone = JSON.parse(JSON.stringify(base));

  /* ---- Revenus : chaque salaire reste attaché à son propriétaire ---- */
  if (clone.revenus) {
    const salaryKeys = Object.keys(clone.revenus).filter(k =>
      k.toLowerCase().includes('salaire') || k.toLowerCase().includes('extras')
    );
    const otherRevKeys = Object.keys(clone.revenus).filter(k =>
      !salaryKeys.includes(k)
    );

    salaryKeys.forEach(k => {
      const kLow     = k.toLowerCase();
      const ownerLow = owner.toLowerCase();

      /* Vérifier si la clé contient le nom d'une AUTRE personne (parmi toutes les personnes) */
      const belongsToOwner = kLow.includes(ownerLow);
      const belongsToOtherPerson = !belongsToOwner && getActivePersons().some(p => {
        if (p.name === owner) return false;
        return kLow.includes(p.name.toLowerCase());
      });

      if (belongsToOtherPerson) {
        /* Ce salaire appartient à une autre personne → 0 pour owner */
        clone.revenus[k] = 0;
      }
      /* Sinon (nom de owner dans la clé, ou clé générique sans nom) → garder 100% */
    });

    /* Revenus autres (non-salaire) → divisés par le nombre de personnes */
    const n = getPersonCount();
    otherRevKeys.forEach(k => {
      clone.revenus[k] = (clone.revenus[k] || 0) / n;
    });
  }

  /* ---- Toutes les autres catégories → divisées par le nombre de personnes ---- */
  const nPersons = getPersonCount();
  ['depenses', 'abonnements', 'credits', 'epargne', 'projets'].forEach(type => {
    if (!clone[type]) return;
    Object.keys(clone[type]).forEach(k => {
      clone[type][k] = (clone[type][k] || 0) / nPersons;
    });
  });

  return clone;
}
