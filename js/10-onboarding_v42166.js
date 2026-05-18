/* ============================================================
   js/10-onboarding.js — Écran d'accueil première connexion
   Choix du nombre de personnes + prénoms + budget de départ
   ============================================================ */

let _obCount = 2;

function showOnboarding() {
  document.getElementById('app').style.display = 'none';

  let screen = document.getElementById('onboarding-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'onboarding-screen';
    document.body.appendChild(screen);
  }

  screen.style.cssText = `
    display:flex; position:fixed; inset:0; z-index:1000;
    background:#f5f4f0; align-items:flex-start; justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    overflow-y:auto; padding:24px 16px;
  `;

  screen.innerHTML = `
  <div style="width:100%;max-width:480px;margin:auto;padding-bottom:32px">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px;padding-top:12px">
      <div style="font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px">
        Chiika <span style="color:#1D9E75">Finance</span>
      </div>
      <div style="font-size:13px;color:#aaa;margin-top:4px">Gestion financière personnelle</div>
    </div>

    <!-- STEP 1 : Nombre de personnes -->
    <div id="ob-step1" class="ob-card">
      <div class="ob-step-pill">Étape 1 / 3</div>
      <div class="ob-title">Combien de personnes gérez-vous ?</div>
      <div class="ob-subtitle">Vous pourrez modifier cela plus tard dans les paramètres.</div>

      <div class="ob-count-grid">
        ${[1,2,3,4].map(n => `
        <button class="ob-count-btn ${n===2?'selected':''}" onclick="obSelectCount(${n},this)">
          <span class="ob-count-icon">${['👤','👥','👨‍👩‍👦','👨‍👩‍👧‍👦'][n-1]}</span>
          <span class="ob-count-num">${n}</span>
          <span class="ob-count-lbl">${['Seul(e)','En couple','À 3','À 4'][n-1]}</span>
        </button>`).join('')}
      </div>

      <button class="ob-btn-primary" onclick="obGoStep2()">Continuer →</button>
    </div>

    <!-- STEP 2 : Prénoms -->
    <div id="ob-step2" class="ob-card" style="display:none">
      <div class="ob-step-pill">Étape 2 / 3</div>
      <div class="ob-title">Comment vous appelez-vous ?</div>
      <div class="ob-subtitle">Ces noms apparaîtront dans les tableaux de suivi personnels.</div>
      <div id="ob-names-wrap" style="margin:20px 0;display:flex;flex-direction:column;gap:10px"></div>
      <div style="display:flex;gap:10px">
        <button class="ob-btn-back" onclick="obGoStep(1)">← Retour</button>
        <button class="ob-btn-primary" style="flex:1;margin-top:0" onclick="obGoStep3()">Continuer →</button>
      </div>
    </div>

    <!-- STEP 3 : Budget -->
    <div id="ob-step3" class="ob-card" style="display:none">
      <div class="ob-step-pill">Étape 3 / 3</div>
      <div class="ob-title">Votre budget mensuel de référence</div>
      <div class="ob-subtitle">Ces montants sont modifiables à tout moment dans les paramètres.</div>

      <div style="margin:20px 0;display:flex;flex-direction:column;gap:8px">
        <div class="ob-sec-title">💰 Revenus</div>
        <div id="ob-rev-wrap"></div>

        <div class="ob-sec-title" style="margin-top:6px">🛒 Dépenses variables</div>
        ${obBudRow('Courses',         'ob-courses', 300)}
        ${obBudRow('Carburant',       'ob-carbu',   150)}
        ${obBudRow('Restaurant/Loisirs','ob-resto', 80)}
        ${obBudRow('Shopping',        'ob-shop',    60)}
        ${obBudRow('Imprévus',        'ob-imprev',  200)}

        <div class="ob-sec-title" style="margin-top:6px">🏠 Factures fixes</div>
        ${obBudRow('Loyer / Logement','ob-loyer',   700)}
        ${obBudRow('Électricité / Gaz','ob-elec',   100)}
        ${obBudRow('Téléphone/Internet','ob-tel',    60)}

        <div class="ob-sec-title" style="margin-top:6px">💎 Épargne</div>
        ${obBudRow('Épargne mensuelle','ob-epa',     200)}
      </div>

      <div id="ob-err" style="display:none;background:#FAECE7;color:#993C1D;border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:12px"></div>

      <div style="display:flex;gap:10px">
        <button class="ob-btn-back" onclick="obGoStep(2)">← Retour</button>
        <button class="ob-btn-primary" style="flex:1;margin-top:0" id="ob-finish" onclick="obFinish()">
          ✓ Créer mon espace
        </button>
      </div>
      <div id="ob-spinner" style="display:none;text-align:center;margin-top:12px;font-size:13px;color:#999">
        ⏳ Création en cours…
      </div>
    </div>

  </div>

  <style>
    .ob-card{background:#fff;border-radius:20px;padding:26px 22px;
      box-shadow:0 2px 20px rgba(0,0,0,.07);margin-bottom:14px}
    .ob-step-pill{display:inline-block;background:#e8f5ef;color:#0F6E56;
      font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
      padding:3px 10px;border-radius:20px;margin-bottom:12px}
    .ob-title{font-size:20px;font-weight:800;color:#1a1a1a;line-height:1.3;margin-bottom:6px}
    .ob-subtitle{font-size:13px;color:#aaa;margin-bottom:4px;line-height:1.5}
    .ob-count-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}
    .ob-count-btn{display:flex;flex-direction:column;align-items:center;gap:5px;
      padding:14px 6px;background:#f5f4f0;border:2px solid transparent;
      border-radius:14px;cursor:pointer;transition:all .15s ease}
    .ob-count-btn:hover{background:#e8f5ef;border-color:#a8dcc9}
    .ob-count-btn.selected{background:#e8f5ef;border-color:#1D9E75;box-shadow:0 0 0 2px #d0efe4}
    .ob-count-icon{font-size:22px}
    .ob-count-num{font-size:18px;font-weight:800;color:#1a1a1a}
    .ob-count-lbl{font-size:10px;color:#888;font-weight:500}
    .ob-btn-primary{display:block;width:100%;padding:14px;background:#1D9E75;color:#fff;
      border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;
      transition:background .15s;margin-top:10px}
    .ob-btn-primary:hover{background:#0F6E56}
    .ob-btn-primary:disabled{background:#bbb;cursor:not-allowed}
    .ob-btn-back{padding:14px 18px;background:#f5f4f0;color:#666;border:none;
      border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;margin-top:10px}
    .ob-btn-back:hover{background:#e8e7e3}
    .ob-name-row{display:flex;align-items:center;gap:10px;background:#f5f4f0;
      border-radius:12px;padding:10px 14px}
    .ob-name-emoji{font-size:20px}
    .ob-name-inp{flex:1;background:transparent;border:none;outline:none;
      font-size:15px;font-weight:600;color:#1a1a1a}
    .ob-name-inp::placeholder{color:#ccc;font-weight:400}
    .ob-sec-title{font-size:11px;font-weight:700;color:#999;text-transform:uppercase;
      letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid #f0efed}
    .ob-bud-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0}
    .ob-bud-row label{font-size:13px;color:#444;flex:1}
    .ob-bud-inp-wrap{display:flex;align-items:center;gap:4px;background:#f5f4f0;
      border-radius:8px;padding:6px 10px}
    .ob-bud-inp-wrap input{width:68px;background:transparent;border:none;outline:none;
      font-size:13px;font-weight:600;color:#1a1a1a;text-align:right}
    .ob-bud-inp-wrap span{font-size:12px;color:#aaa}
  </style>`;

  _obCount = 2;
}

/* ---- helpers ---- */
function obBudRow(label, id, val) {
  return `<div class="ob-bud-row">
    <label>${label}</label>
    <div class="ob-bud-inp-wrap">
      <input type="number" id="${id}" value="${val}" min="0">
      <span>€/mois</span>
    </div>
  </div>`;
}

function obV(id) { return parseFloat(document.getElementById(id)?.value) || 0; }

function obSelectCount(n, btn) {
  _obCount = n;
  document.querySelectorAll('.ob-count-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function obGoStep(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById('ob-step' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  });
  document.getElementById('onboarding-screen').scrollTop = 0;
}

function obGoStep2() {
  _renderObNames();
  obGoStep(2);
}

function obGoStep3() {
  /* Valider prénoms */
  for (let i = 1; i <= _obCount; i++) {
    const inp = document.getElementById('ob-name-' + i);
    if (!inp?.value.trim()) { inp?.focus(); alert('Saisissez le prénom de chaque personne.'); return; }
  }
  _renderObRevs();
  obGoStep(3);
}

const _OB_EMOJIS = ['🧑','👤','🧒','👶'];

function _renderObNames() {
  const wrap = document.getElementById('ob-names-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 1; i <= _obCount; i++) {
    const cur = DB.persons['person' + i];
    const def = cur && cur !== 'Personne ' + i ? cur : '';
    wrap.insertAdjacentHTML('beforeend', `
      <div class="ob-name-row">
        <span class="ob-name-emoji">${_OB_EMOJIS[i-1]}</span>
        <input class="ob-name-inp" id="ob-name-${i}" type="text"
          placeholder="Prénom ${i}" value="${def}">
      </div>`);
  }
  setTimeout(() => document.getElementById('ob-name-1')?.focus(), 80);
}

function _renderObRevs() {
  const wrap = document.getElementById('ob-rev-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 1; i <= _obCount; i++) {
    const name = document.getElementById('ob-name-' + i)?.value.trim() || 'Personne ' + i;
    wrap.insertAdjacentHTML('beforeend',
      obBudRow('Salaire ' + name, 'ob-sal-' + i, 2000) +
      obBudRow('Primes / Extras ' + name, 'ob-ext-' + i, 0)
    );
  }
}

/* ---- Finalisation ---- */
async function obFinish() {
  const btn  = document.getElementById('ob-finish');
  const spin = document.getElementById('ob-spinner');
  const err  = document.getElementById('ob-err');
  if (btn)  { btn.disabled = true; }
  if (spin) spin.style.display = 'block';
  if (err)  err.style.display  = 'none';

  try {
    /* Persons */
    DB.persons = { count: _obCount };
    const names = [];
    for (let i = 1; i <= _obCount; i++) {
      const n = document.getElementById('ob-name-' + i)?.value.trim() || 'Personne ' + i;
      DB.persons['person' + i] = n;
      names.push(n);
    }
    for (let i = _obCount + 1; i <= 4; i++) DB.persons['person' + i] = null;

    /* Revenus dynamiques */
    const revenus = { 'Revenus autres': 0 };
    for (let i = 1; i <= _obCount; i++) {
      const n = names[i-1];
      const sal = obV('ob-sal-' + i);
      const ext = obV('ob-ext-' + i);
      revenus['Salaire ' + n] = sal;
      if (ext > 0) revenus['Extras ' + n] = ext;
    }

    /* Budget complet */
    DB.budgets = {
      revenus,
      depenses: {
        'Courses':         obV('ob-courses'),
        'Carburant':       obV('ob-carbu'),
        'Restaurant':      obV('ob-resto'),
        'Shopping':        obV('ob-shop'),
        'Imprévus':        obV('ob-imprev'),
      },
      abonnements: {
        'Loyer Logement':  obV('ob-loyer'),
        'Électricité':     obV('ob-elec'),
        'Téléphone':       obV('ob-tel'),
        'Box Internet':    20,
        'Assurance':       50,
      },
      credits:  {},
      epargne:  { 'Épargne': obV('ob-epa') },
      projets:  { 'Vacances': 200, 'Autres': 100 }
    };

    DB.epa_totals   = { 'Épargne': obV('ob-epa') * 12 };
    DB.pro_totals   = { 'Vacances': 2000, 'Autres': 1000 };
    DB.prets        = [];
    DB.abonnements  = [];
    DB.transactions = [];
    DB.budget_prev  = {};
    DB.onboarding   = true;

    await saveDB();

    document.getElementById('onboarding-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    render();

  } catch(e) {
    if (err) { err.textContent = 'Erreur lors de la sauvegarde. Vérifiez votre connexion.'; err.style.display = 'block'; }
    if (btn)  btn.disabled = false;
    if (spin) spin.style.display = 'none';
  }
}
