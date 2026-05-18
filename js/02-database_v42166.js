/* ============================================================
   js/02-database.js — Base de données Supabase (avec auth)
   ============================================================ */

const SUPABASE_URL = 'https://iuazbpthcktxpnvletbp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YXpicHRoY2t0eHBudmxldGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzY0NTgsImV4cCI6MjA5MzU1MjQ1OH0.G1cJxDs9E7w3INoUirDwTlmpG9_jQ7MFFZMJ22tTzzg';
const TABLE        = 'monsuivi_data';

const KEYS = {
  tx:         'monsuivi_tx',
  bud:        'monsuivi_bud',
  bud_prev:   'monsuivi_bud_prev',
  abo:        'monsuivi_abo',
  epa:        'monsuivi_epa',
  pro:        'monsuivi_pro',
  persons:    'monsuivi_persons',
  prets:      'monsuivi_prets',
  onboarding: 'monsuivi_onboarding',
  transfer:   'monsuivi_transfer',
  version:    'monsuivi_db_version'
};
const DB_VERSION = 2;

/* Structure persons dynamique : count + jusqu'à 4 personnes */
const DEFAULT_PERSONS_DYNAMIC = {
  count: 0,
  person1: null,
  person2: null,
  person3: null,
  person4: null
};

const DB = {
  transactions:       [],
  budgets:            {},
  budget_prev:        {},
  abonnements:        [],
  epa_totals:         {},
  pro_totals:         {},
  persons:            { ...DEFAULT_PERSONS_DYNAMIC },
  prets:              [],
  onboarding:         false,
  monthlyTransferDone:{}
};

/* ---- Retourne le user_id de la session courante ---- */
function getUserId() {
  return SESSION?.user?.id || SESSION?.sub || null;
}

/* ---- Préfixe une clé avec le user_id pour isoler les données ---- */
function userKey(key) {
  const uid = getUserId();
  if (!uid) return key; /* fallback sans préfixe si pas de session */
  return uid + ':' + key;
}

/* ---- Lecture de toutes les clés de l'utilisateur courant ---- */
async function sbGetAll() {
  try {
    const uid    = getUserId();
    const prefix = uid ? uid + ':' : '';
    /* Récupérer TOUTES les clés et filtrer côté client
       (évite les problèmes d'encodage URL avec le filtre LIKE Supabase) */
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=key,value`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) { console.warn('[DB] sbGetAll HTTP', res.status); return {}; }
    const rows = await res.json();
    const map  = {};
    rows.forEach(r => {
      if (!uid) {
        /* Pas de session — prendre toutes les clés non préfixées */
        if (!r.key.includes(':')) map[r.key] = r.value;
      } else if (r.key.startsWith(prefix)) {
        /* Clé préfixée par notre user_id → retirer le préfixe */
        const k = r.key.slice(prefix.length);
        map[k] = r.value;
      }
    });
    return map;
  } catch(e) { console.warn('[DB] sbGetAll:', e); return {}; }
}

/* ---- Écriture d'une clé (upsert), préfixée par user_id ---- */
async function sbSet(key, value) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}`,
      {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify({ key: userKey(key), value, updated_at: new Date().toISOString() })
      }
    );
    if (!res.ok) console.warn('[DB] sbSet HTTP', res.status, key);
    return res.ok;
  } catch(e) { console.warn('[DB] sbSet:', e); return false; }
}

/* ============================================================
   MIGRATION — Lecture des anciennes clés sans préfixe user_id
   ============================================================ */
async function sbGetLegacy() {
  /* DESACTIVE — migration auto des donnees non prefixees desactivee.
     Chaque compte est strictement isole par user_id. */
  return {};
}

/* Migre les données legacy vers les clés préfixées + marque onboarding comme fait */
async function _migrateLegacyData(legacy) {
  console.log('[DB] Migration des données legacy en cours...');
  setSyncBadge('⚙️ Migration...');

  DB.transactions = _parse(legacy[KEYS.tx],       []);
  DB.budgets = _migrateBudget(_parse(legacy[KEYS.bud], JSON.parse(JSON.stringify(DEFAULT_BUDGETS))));
  DB.budget_prev  = _parse(legacy[KEYS.bud_prev], {});
  DB.abonnements  = _parse(legacy[KEYS.abo],      []);
  DB.epa_totals   = _parse(legacy[KEYS.epa],      { ...DEFAULT_EPA_TOTALS });
  DB.pro_totals   = _parse(legacy[KEYS.pro],      { ...DEFAULT_PRO_TOTALS });
  DB.prets        = _parse(legacy[KEYS.prets],    []);
  DB.persons      = _migratePersons(_parse(legacy[KEYS.persons], null));
  DB.onboarding   = true;

  /* Réécrire sous les nouvelles clés préfixées */
  await saveDB();
  console.log('[DB] Migration terminée ✓');
}

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadDB() {
  setSyncBadge('⏳ Sync...');

  /* ---- 1. Chercher les données avec le préfixe user_id ---- */
  const remote    = await sbGetAll();
  const hasRemote = Object.keys(remote).length > 0;

  if (hasRemote) {
    /* Données trouvées avec le bon préfixe → chargement normal.
       Pour chaque clé, si absent du remote on essaie le localStorage avant de tomber sur []. */
    function remoteOrLocal(key, fallback) {
      if (remote[key] !== undefined) return _parse(remote[key], fallback);
      const local = localStorage.getItem(_localKey(key));
      if (local !== null) return _parse(local, fallback);
      return fallback;
    }
    DB.transactions = remoteOrLocal(KEYS.tx,       []);
    DB.budgets      = _migrateBudget(remoteOrLocal(KEYS.bud, JSON.parse(JSON.stringify(DEFAULT_BUDGETS))));
    DB.budget_prev  = _migrateBudgetPrev(remoteOrLocal(KEYS.bud_prev, {}));
    DB.abonnements  = remoteOrLocal(KEYS.abo,      []);
    DB.epa_totals   = remoteOrLocal(KEYS.epa,      { ...DEFAULT_EPA_TOTALS });
    DB.pro_totals   = remoteOrLocal(KEYS.pro,      { ...DEFAULT_PRO_TOTALS });
    DB.prets        = remoteOrLocal(KEYS.prets,    []);
    DB.persons      = _migratePersons(remoteOrLocal(KEYS.persons, null));

    /* onboarding : essayer remote, puis localStorage, sinon true (compte existant) */
    if (remote[KEYS.onboarding] !== undefined) {
      DB.onboarding = _parse(remote[KEYS.onboarding], false);
    } else {
      const localOnb = localStorage.getItem(_localKey(KEYS.onboarding));
      DB.onboarding = localOnb !== null ? _parse(localOnb, true) : true;
      /* Sauvegarder en remote si manquant */
      sbSet(KEYS.onboarding, JSON.stringify(DB.onboarding));
    }

    /* Forcer migration factures→abonnements si nécessaire */
    let needsSave = false;
    if (DB.budgets && DB.budgets.factures && !DB.budgets.abonnements) {
      DB.budgets = _migrateBudget(DB.budgets);
      needsSave = true;
    }
    _saveLocal();
    setSyncBadge('☁️ Synchronisé');
    if (needsSave) {
      console.log('[DB] Migration budget factures→abonnements sauvegardée');
      saveDB();
    }

  } else {
    /* ---- 2. Rien trouvé avec le préfixe → chercher les anciennes clés ---- */
    const legacy    = await sbGetLegacy();
    const hasLegacy = Object.keys(legacy).length > 0 && legacy[KEYS.tx];

    if (hasLegacy) {
      /* Données legacy trouvées → migrer automatiquement */
      await _migrateLegacyData(legacy);
      setSyncBadge('☁️ Données migrées ✓');

    } else {
      /* ---- 3. Rien du tout → essayer le cache local ---- */
      const hadLocal = _loadLocal();

      if (!hadLocal) {
        /* Nouveau compte totalement vierge — aucune donnée préremplie */
        _initEmptyDB();
        DB.onboarding = false; /* Lance l'onboarding */
      } else {
        /* Cache local présent mais pas de remote → hors ligne */
        setSyncBadge('📴 Hors ligne');
        if (!DB.onboarding) DB.onboarding = true; /* compte existant offline */
      }
    }
  }

  /* ---- Décision finale ---- */
  if (!DB.onboarding) {
    showOnboarding();
  } else {
    /* Charger le rôle de l'utilisateur (défini dans 11-permissions.js) */
    if (typeof loadRole === 'function') await loadRole();
    /* Injection automatique des abonnements du mois courant */
    injectAbonnementsTransactions();
    injectPretsTransactions();
    _migrateOldLabels(); /* Migration labels Salaire Net → Salaire */
    /* Vérifier transfert mensuel solde → épargne */
    checkMonthlyTransfer();
    render();
  }
}

/* ============================================================
   INIT COMPTE VIERGE — aucune donnée, structure minimale
   ============================================================ */
function _initEmptyDB() {
  DB.transactions = [];
  /* Budgets : structure vide, sans catégories préremplies.
     Les catégories seront créées via l'onboarding ou manuellement. */
  DB.budgets = {
    revenus:     {},
    depenses:    {},
    abonnements: {},
    credits:     {},
    epargne:     {},
    projets:     {}
  };
  DB.budget_prev = {};
  DB.abonnements = [];
  DB.epa_totals  = {};
  DB.pro_totals  = {};
  DB.persons     = { count: 0, person1: null, person2: null, person3: null, person4: null };
  DB.prets       = [];
  DB.monthlyTransferDone = {};
}

/* Migration budget : ancienne clé 'factures' → 'abonnements' */
function _migrateBudget(bud) {
  /* Nouveau compte vierge */
  if (!bud) return { revenus:{}, depenses:{}, abonnements:{}, credits:{}, epargne:{}, projets:{} };

  /* Migration format factures→abonnements (ancien format) */
  if (bud.factures && Object.keys(bud.factures).length > 0 && !bud.abonnements) {
    bud.abonnements = bud.factures;
    delete bud.factures;
  } else if (bud.factures && bud.abonnements) {
    /* Fusionner factures dans abonnements si les deux existent */
    Object.entries(bud.factures).forEach(([k,v]) => {
      if (!(k in bud.abonnements)) bud.abonnements[k] = v;
    });
    delete bud.factures;
  }

  /* S'assurer que toutes les clés de type existent (sans écraser les données) */
  ['revenus','depenses','abonnements','credits','epargne','projets'].forEach(type => {
    if (!bud[type] || typeof bud[type] !== 'object') bud[type] = {};
  });

  /* NE PAS ajouter de catégories prédéfinies pour préserver les comptes vierges
     Les catégories sont créées dynamiquement lors des saisies utilisateur */
  return bud;
}
/* Migration one-shot : normaliser "Salaire Net X"→"Salaire X" et "Assurance"→"Assurance Habitation" */
function _migrateOldLabels() {
  let changed = false;

  /* Transactions : Salaire Net X → Salaire X */
  DB.transactions.forEach(t => {
    if (t.type === 'revenus' && t.label) {
      const newLabel = t.label.replace(/^Salaire [Nn]et /, 'Salaire ');
      if (newLabel !== t.label) { t.label = newLabel; changed = true; }
    }
    /* Assurance générique → Assurance Habitation */
    if (t.label === 'Assurance') { t.label = 'Assurance Habitation'; changed = true; }
  });

  /* Budget revenus : renommer les clés */
  function migrateRevCats(rev) {
    if (!rev) return;
    Object.keys(rev).forEach(k => {
      const nk = k.replace(/^Salaire [Nn]et /, 'Salaire ');
      if (nk !== k && !(nk in rev)) { rev[nk] = rev[k]; delete rev[k]; changed = true; }
    });
  }
  migrateRevCats(DB.budgets?.revenus);
  Object.values(DB.budget_prev || {}).forEach(yb => migrateRevCats(yb?.revenus));

  /* Budget abonnements/dépenses : Assurance → Assurance Habitation */
  ['abonnements','depenses','credits'].forEach(type => {
    const bud = DB.budgets?.[type];
    if (bud && 'Assurance' in bud) {
      if (!bud['Assurance Habitation']) bud['Assurance Habitation'] = bud['Assurance'];
      delete bud['Assurance'];
      changed = true;
    }
  });

  if (changed && typeof saveDB === 'function') saveDB();
}

function _migrateBudgetPrev(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const result = {};
  Object.entries(raw).forEach(([year, bud]) => {
    result[year] = _migrateBudget(bud);
  });
  return result;
}

function _migratePersons(raw) {
  if (!raw) return { ...DEFAULT_PERSONS_DYNAMIC };
  /* Déjà nouveau format */
  if (typeof raw.count === 'number') return raw;
  /* Ancien format : on reconstruit */
  return {
    count:   2,
    person1: raw.person1 || 'Personne 1',
    person2: raw.person2 || 'Personne 2',
    person3: null,
    person4: null
  };
}

/* ============================================================
   SAUVEGARDE
   ============================================================ */
async function saveDB() {
  setSyncBadge('💾 Sauvegarde...');
  _saveLocal();

  const pairs = [
    [KEYS.tx,         JSON.stringify(DB.transactions)],
    [KEYS.bud,        JSON.stringify(DB.budgets)      ],
    [KEYS.bud_prev,   JSON.stringify(DB.budget_prev)  ],
    [KEYS.abo,        JSON.stringify(DB.abonnements)  ],
    [KEYS.epa,        JSON.stringify(DB.epa_totals)   ],
    [KEYS.pro,        JSON.stringify(DB.pro_totals)   ],
    [KEYS.persons,    JSON.stringify(DB.persons)      ],
    [KEYS.prets,      JSON.stringify(DB.prets)        ],
    [KEYS.onboarding, JSON.stringify(DB.onboarding)             ],
    [KEYS.transfer,   JSON.stringify(DB.monthlyTransferDone||{}) ],
    [KEYS.version,    JSON.stringify(DB_VERSION)                 ]
  ];

  const results = await Promise.all(pairs.map(([k,v]) => sbSet(k, v)));
  const allOk   = results.every(Boolean);

  if (allOk) {
    setSyncBadge('☁️ Sauvegardé ✓');
    setTimeout(() => setSyncBadge('☁️ Synchronisé'), 2000);
  } else {
    setSyncBadge('⚠️ Sync partielle');
  }
}

async function resetDB() {
  if (!confirmDelete('Réinitialiser TOUTES les données sur TOUS les appareils ?')) return;
  DB.transactions = [];
  DB.budgets      = JSON.parse(JSON.stringify(DEFAULT_BUDGETS));
  DB.budget_prev  = {};
  DB.abonnements  = [];
  DB.epa_totals   = { ...DEFAULT_EPA_TOTALS };
  DB.pro_totals   = { ...DEFAULT_PRO_TOTALS };
  DB.persons      = { ...DEFAULT_PERSONS_DYNAMIC };
  DB.prets        = [];
  DB.onboarding   = false;
  await saveDB();
  showOnboarding();
}

/* ---- localStorage fallback — préfixé par user_id ---- */
function _localKey(k) {
  const uid = getUserId();
  return uid ? uid + ':' + k : k;
}

function _saveLocal() {
  try {
    /* Ne sauvegarder en local que si une session est active (pour préfixer les clés) */
    if (!getUserId()) return;
    localStorage.setItem(_localKey(KEYS.tx),         JSON.stringify(DB.transactions));
    localStorage.setItem(_localKey(KEYS.bud),        JSON.stringify(DB.budgets));
    localStorage.setItem(_localKey(KEYS.bud_prev),   JSON.stringify(DB.budget_prev));
    localStorage.setItem(_localKey(KEYS.abo),        JSON.stringify(DB.abonnements));
    localStorage.setItem(_localKey(KEYS.epa),        JSON.stringify(DB.epa_totals));
    localStorage.setItem(_localKey(KEYS.pro),        JSON.stringify(DB.pro_totals));
    localStorage.setItem(_localKey(KEYS.persons),    JSON.stringify(DB.persons));
    localStorage.setItem(_localKey(KEYS.prets),      JSON.stringify(DB.prets));
    localStorage.setItem(_localKey(KEYS.transfer),   JSON.stringify(DB.monthlyTransferDone||{}));
    localStorage.setItem(_localKey(KEYS.version),    JSON.stringify(DB_VERSION));
    localStorage.setItem(_localKey(KEYS.onboarding), JSON.stringify(DB.onboarding));
  } catch(e) {}
}

function _loadLocal() {
  try {
    /* Sécurité : ne charger le localStorage que si une session user est active.
       Sans user_id, _localKey retourne la clé brute → risque de lire des données
       d'un autre compte (ex: connexion sur le même navigateur). */
    if (!getUserId()) return false;
    const tx = localStorage.getItem(_localKey(KEYS.tx));
    if (!tx) return false;
    DB.transactions = _parse(tx,                                                [...DEFAULT_TRANSACTIONS]);
    DB.budgets = _migrateBudget(_parse(localStorage.getItem(_localKey(KEYS.bud)), JSON.parse(JSON.stringify(DEFAULT_BUDGETS))));
    DB.budget_prev  = _migrateBudgetPrev(_parse(localStorage.getItem(_localKey(KEYS.bud_prev)), {}));
    DB.abonnements  = _parse(localStorage.getItem(_localKey(KEYS.abo)),        [...DEFAULT_ABONNEMENTS]);
    DB.epa_totals   = _parse(localStorage.getItem(_localKey(KEYS.epa)),        { ...DEFAULT_EPA_TOTALS });
    DB.pro_totals   = _parse(localStorage.getItem(_localKey(KEYS.pro)),        { ...DEFAULT_PRO_TOTALS });
    DB.prets        = _parse(localStorage.getItem(_localKey(KEYS.prets)),      [...DEFAULT_PRETS]);
    const rawP      = _parse(localStorage.getItem(_localKey(KEYS.persons)),    null);
    DB.persons      = _migratePersons(rawP);

    /* Préserver monthlyTransferDone */
    const rawTr = localStorage.getItem(_localKey(KEYS.transfer));
    if (rawTr !== null) DB.monthlyTransferDone = _parse(rawTr, {});

    /* onboarding : absent = compte existant */
    const rawOnb    = localStorage.getItem(_localKey(KEYS.onboarding));
    DB.onboarding   = rawOnb !== null ? _parse(rawOnb, false) : true;

    return true;
  } catch(e) { return false; }
}

function _parse(str, fallback) {
  if (str === null || str === undefined) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

function getBudgetForYear(y) {
  return DB.budget_prev[y] || JSON.parse(JSON.stringify(DB.budgets));
}
function ensureBudgetYear(y) {
  if (!DB.budget_prev[y]) DB.budget_prev[y] = JSON.parse(JSON.stringify(DB.budgets));
}
/* setSyncBadge défini dans 04-app.js */

/* ---- Helpers personnes actives ---- */
function getActivePersons() {
  const list = [];
  /* Toujours parcourir les 4 slots — count n'est plus un fallback hardcodé à 2 */
  for (let i = 1; i <= 4; i++) {
    const name = DB.persons['person' + i];
    if (name) list.push({ key: 'person' + i, name });
  }
  return list;
}
