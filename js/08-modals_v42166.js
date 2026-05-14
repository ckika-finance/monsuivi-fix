/* ============================================================
   js/08-modals.js — Modales : transaction, abonnement, prêt/crédit
   ============================================================ */

/* Catégories prédéfinies par type — triées alphabétiquement */
const CATS_ABONNEMENTS = [
  'Assurance Auto','Assurance Habitation','Box Internet','Crèche',
  'Eau','Électricité','Gaz','Loyer Logement','Netflix','Spotify','Téléphone'
];
const CATS_DEPENSES = [
  'Carburant','Courses','Imprévus','Restaurant','Santé','Shopping'
];
const CATS_CREDITS = ['Auto','Conso','Habitation'];

/* S'assure que les catégories de base existent dans le budget */
function ensureDefaultCats() {
  if (!DB.budgets) return;
  CATS_ABONNEMENTS.forEach(c => { if(!(c in DB.budgets.abonnements)) DB.budgets.abonnements[c] = 0; });
  CATS_DEPENSES.forEach(c   => { if(!(c in DB.budgets.depenses))  DB.budgets.depenses[c]  = 0; });
  CATS_CREDITS.forEach(c    => { if(!(c in DB.budgets.credits))   DB.budgets.credits[c]   = 0; });
}

/* ---- MODAL TRANSACTION ---- */
function openTxModal(txId) {
  /* Vérifier permission — canEdit défini dans 11-permissions.js */
  if (typeof canEdit === 'function' && !canEdit(currentYear)) {
    alert('🔒 Impossible de modifier les données de ' + currentYear + '.\nCette année est verrouillée.');
    return;
  }
  ensureDefaultCats();

  const existing = txId ? DB.transactions.find(t=>t.id===txId) : null;
  const overlay  = document.createElement('div');
  overlay.className='modal-overlay'; overlay.id='modal-tx';

  const typeOptions=['revenus','depenses','abonnements','credits','epargne','projets'];
  const selType  = existing ? existing.type : 'revenus';
  const cats     = _getCats(selType);
  const defDate  = existing ? existing.date : `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`;

  overlay.innerHTML=`
  <div class="modal">
    <div class="modal-title">${existing?'Modifier la transaction':'Nouvelle transaction'}</div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="f-date" value="${defDate}">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Montant (€)</label>
        <input class="form-input" type="number" id="f-amount" placeholder="0.00" step="0.01"
          value="${existing?Math.abs(existing.amount):''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-input" id="f-type" onchange="updateCatOptions(this.value,'')">
          ${typeOptions.map(t=>`<option value="${t}" ${t===selType?'selected':''}>${t==='abonnements'?'Abonnement':TYPE_LABELS[t]}</option>`).join('')}
        </select>
      </div>
      ${getActivePersons().length>1
        ? `<div class="form-group" style="flex:1">
        <label class="form-label">Propriétaire</label>
        <select class="form-input" id="f-owner">
          ${getAllOwners().map(name=>`<option value="${name}" ${existing?.owner===name?'selected':''}>${name}</option>`).join('')}
          <option value="Commun" ${(!existing||existing?.owner==='Commun')?'selected':''}>Commun</option>
        </select>
      </div>`
        : `<input type="hidden" id="f-owner" value="${(getAllOwners()[0])||'Commun'}">`
      }
    </div>
    <div class="form-group">
      <label class="form-label">Catégorie</label>
      <select class="form-input" id="f-label-sel"
        onchange="if(this.value!=='__custom__') document.getElementById('f-label').value=''">
        ${cats.map(c=>`<option value="${c}" ${existing?.label===c?'selected':''}>${c}</option>`).join('')}
        <option value="__custom__" ${existing&&!cats.includes(existing.label)?'selected':''}>Autre (saisie libre)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Libellé libre (si "Autre")</label>
      <input class="form-input" type="text" id="f-label"
        placeholder="Laisser vide si catégorie choisie"
        value="${existing&&!cats.includes(existing.label)?existing.label:''}">
    </div>
    <div class="form-group">
      <label class="form-label">Commentaire (optionnel)</label>
      <input class="form-input" type="text" id="f-comment"
        placeholder="Ex: Lidl semaine 48" value="${existing?.comment||''}">
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="document.getElementById('modal-tx').remove()">Annuler</button>
      <button class="btn-save" onclick="saveTx('${txId||''}')">
        ${existing?'Enregistrer les modifications':'Enregistrer'}
      </button>
    </div>
  </div>`;

  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/* Retourne les catégories triées pour un type donné */
function _getCats(type) {
  ensureDefaultCats();
  const fromBudget = Object.keys(DB.budgets[type]||{}).sort((a,b)=>a.localeCompare(b,'fr'));
  /* Pour abonnements : s'assurer que les prédéfinies sont incluses */
  if (type === 'abonnements') {
    const all = new Set([...CATS_ABONNEMENTS, ...fromBudget]);
    return [...all].sort((a,b)=>a.localeCompare(b,'fr'));
  }
  if (type === 'depenses') {
    const all = new Set([...CATS_DEPENSES, ...fromBudget]);
    return [...all].sort((a,b)=>a.localeCompare(b,'fr'));
  }
  if (type === 'credits') {
    const all = new Set([...CATS_CREDITS, ...fromBudget]);
    return [...all].sort((a,b)=>a.localeCompare(b,'fr'));
  }
  return fromBudget;
}

function updateCatOptions(type, currentLabel) {
  const sel = document.getElementById('f-label-sel'); if(!sel) return;
  const cats = _getCats(type);
  sel.innerHTML = cats.map(c=>`<option value="${c}" ${c===currentLabel?'selected':''}>${c}</option>`).join('')
    + `<option value="__custom__" ${currentLabel&&!cats.includes(currentLabel)?'selected':''}>Autre (saisie libre)</option>`;
  const libre = document.getElementById('f-label'); if(libre) libre.value='';
}

function saveTx(txId) {
  const date    = document.getElementById('f-date').value;
  const amount  = parseFloat(document.getElementById('f-amount').value);
  const type    = document.getElementById('f-type').value;
  const owner   = document.getElementById('f-owner').value;
  const sel     = document.getElementById('f-label-sel').value;
  const libre   = document.getElementById('f-label').value.trim();
  const comment = document.getElementById('f-comment').value.trim();
  const label   = (sel==='__custom__'?libre:sel).trim()||libre;

  if (!date||isNaN(amount)||!label){alert('Remplissez date, montant et catégorie.');return;}

  const isIncome  = type==='revenus';
  const finalAmt  = isIncome ? Math.abs(amount) : -Math.abs(amount);

  if (txId) {
    const idx = DB.transactions.findIndex(t=>t.id===txId);
    if (idx>=0) DB.transactions[idx]={...DB.transactions[idx],date,label,type,owner,amount:finalAmt,comment};
  } else {
    DB.transactions.push({id:uid(),date,label,type,owner,amount:finalAmt,comment});
  }

  document.getElementById('modal-tx').remove();
  saveDB(); render();
}


/* ---- MODAL ABONNEMENT ---- */
function openAboModal(aboId) {
  ensureDefaultCats();
  const existing = aboId ? DB.abonnements.find(a=>a.id===aboId) : null;
  const overlay  = document.createElement('div');
  overlay.className='modal-overlay'; overlay.id='modal-abo';

  overlay.innerHTML=`
  <div class="modal">
    <div class="modal-title">${existing?'Modifier l\'abonnement':'Nouvel abonnement'}</div>

    <!-- Sélection prédéfinie -->
    <div class="form-group">
      <label class="form-label">Sélection rapide</label>
      <select class="form-input" id="ab-preset" onchange="applyAboPreset(this.value)">
        <option value="">— Choisir un abonnement —</option>
        ${CATS_ABONNEMENTS.map(c=>`<option value="${c}" ${existing?.name===c?'selected':''}>${c}</option>`).join('')}
        <option value="__custom__">Autre (nom libre)</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Nom</label>
      <input class="form-input" type="text" id="ab-name" placeholder="Ex: Disney+" value="${existing?.name||''}">
    </div>

    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Montant (€/mois)</label>
        <input class="form-input" type="number" id="ab-amount" step="0.01" value="${existing?.amount||''}">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Jour de prélèvement</label>
        <input class="form-input" type="number" id="ab-day" min="1" max="31" placeholder="1" value="${existing?.day||1}">
      </div>
    </div>

    ${getActivePersons().length>1
      ? `<div class="form-group">
      <label class="form-label">Propriétaire</label>
      <select class="form-input" id="ab-owner">
        ${getAllOwners().map(name=>`<option value="${name}" ${existing?.owner===name?'selected':''}>${name}</option>`).join('')}
        <option value="Commun" ${(!existing||existing?.owner==='Commun')?'selected':''}>Commun</option>
      </select>
    </div>`
      : `<input type="hidden" id="ab-owner" value="${(getAllOwners()[0])||'Commun'}">`
    }

    <!-- Engagement -->
    <div class="form-group">
      <label class="form-label">Engagement</label>
      <div style="display:flex;gap:16px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="radio" name="ab-eng" value="non"
            ${!existing?.engagement||existing?.engagement==='non'?'checked':''} onchange="toggleEngagement(false)">
          Sans engagement
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="radio" name="ab-eng" value="oui"
            ${existing?.engagement==='oui'?'checked':''} onchange="toggleEngagement(true)">
          Avec engagement
        </label>
      </div>
    </div>

    <div id="ab-eng-fields" style="display:${existing?.engagement==='oui'?'flex':'none'};gap:12px">
      <div class="form-group" style="flex:1">
        <label class="form-label">Date de début</label>
        <input class="form-input" type="date" id="ab-start" value="${existing?.startDate||''}">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Date de fin</label>
        <input class="form-input" type="date" id="ab-end" value="${existing?.endDate||''}">
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="document.getElementById('modal-abo').remove()">Annuler</button>
      <button class="btn-save" onclick="saveAbo('${aboId||''}')">Enregistrer</button>
    </div>
  </div>`;

  overlay.addEventListener('click', e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
}

function applyAboPreset(val) {
  const nameEl = document.getElementById('ab-name');
  if (!nameEl) return;
  if (val && val !== '__custom__') nameEl.value = val;
  else if (val === '__custom__') nameEl.value = '';
}

function toggleEngagement(show) {
  const el = document.getElementById('ab-eng-fields');
  if (el) el.style.display = show ? 'flex' : 'none';
}

async function saveAbo(aboId) {
  const name       = document.getElementById('ab-name').value.trim();
  const amount     = parseFloat(document.getElementById('ab-amount').value);
  const owner      = document.getElementById('ab-owner').value;
  const day        = parseInt(document.getElementById('ab-day').value)||1;
  const engagement = document.querySelector('input[name="ab-eng"]:checked')?.value||'non';
  const startDate  = document.getElementById('ab-start')?.value||'';
  const endDate    = document.getElementById('ab-end')?.value||'';

  if (!name||isNaN(amount)){alert('Remplissez le nom et le montant.');return;}

  /* Déterminer la catégorie = nom si prédéfini, sinon 'Autre' */
  const cat = CATS_ABONNEMENTS.includes(name) ? name : 'Autre';

  const obj = { name, amount, cat, owner, day, engagement,
    startDate: engagement==='oui'?startDate:'',
    endDate:   engagement==='oui'?endDate:'' };

  if (aboId) {
    const idx = DB.abonnements.findIndex(a=>a.id===aboId);
    if (idx>=0) DB.abonnements[idx] = { ...DB.abonnements[idx], ...obj };
  } else {
    DB.abonnements.push({ id:uid(), ...obj });
  }

  /* Mettre à jour le budget abonnements avec ce montant */
  if (cat !== 'Autre') {
    if (!DB.budgets.abonnements) DB.budgets.abonnements = {};
    DB.budgets.abonnements[name] = amount;
  }

  /* Forcer la re-injection ce mois — supprimer l'ancienne transaction auto pour ce mois */
  const now = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  /* Supprimer toutes les transactions auto liées à cet abonnement */
  const pretKey = aboId || (DB.abonnements[DB.abonnements.length-1]?.id);
  DB.transactions = DB.transactions.filter(t =>
    !t._aboKey || !t._aboKey.startsWith(`abo_auto_${pretKey}_`)
  );

  document.getElementById('modal-abo').remove();
  /* Sauvegarder d'abord, puis ré-injecter les transactions du mois courant */
  await saveDB();
  injectAbonnementsTransactions();
  render();
}


/* ---- MODAL PRÊT / CRÉDIT ---- */
function openPretModal() {
  const overlay = document.createElement('div');
  overlay.className='modal-overlay'; overlay.id='modal-pret';
  overlay.innerHTML=`
  <div class="modal">
    <div class="modal-title">Nouveau crédit</div>

    <div class="form-group">
      <label class="form-label">Type de crédit</label>
      <select class="form-input" id="pt-type" onchange="updatePretNom(this.value)">
        <option value="">— Sélectionner —</option>
        <option value="Conso">Conso</option>
        <option value="Auto">Auto</option>
        <option value="Logement">Logement</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Nom du crédit</label>
      <input class="form-input" type="text" id="pt-nom" placeholder="Ex: Crédit Logement BNP">
    </div>

    ${getActivePersons().length>1
      ? `<div class="form-group">
      <label class="form-label">Titulaire</label>
      <select class="form-input" id="pt-owner">
        <option value="Commun">Commun (les deux)</option>
        ${getAllOwners().map(name=>`<option value="${name}">${name}</option>`).join('')}
      </select>
    </div>`
      : `<input type="hidden" id="pt-owner" value="${(getAllOwners()[0])||'Commun'}">`
    }

    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Mensualité (€)</label>
        <input class="form-input" type="number" id="pt-mens" step="0.01" placeholder="850"
          oninput="updateCreditBudgetPreview(this.value)">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Mois de début</label>
        <input class="form-input" type="month" id="pt-start">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Capital restant (€)</label>
        <input class="form-input" type="number" id="pt-cap" step="100" placeholder="180000">
      </div></div>

    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Taux annuel (%)</label>
        <input class="form-input" type="number" id="pt-taux" step="0.01" placeholder="1.8">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Durée restante (mois)</label>
        <input class="form-input" type="number" id="pt-dur" step="1" placeholder="240">
      </div>
    </div>

    <div id="credit-budget-info" style="display:none;background:#E1F5EE;border-radius:8px;padding:10px 12px;font-size:12px;color:#0F6E56">
      ✓ La mensualité sera automatiquement ajoutée au budget Crédits
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="document.getElementById('modal-pret').remove()">Annuler</button>
      <button class="btn-save" onclick="savePret()">Enregistrer</button>
    </div>
  </div>`;
  overlay.addEventListener('click', e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
}

function updatePretNom(type) {
  const nomEl = document.getElementById('pt-nom');
  if (nomEl && !nomEl.value) nomEl.value = `Crédit ${type}`;
}

function updateCreditBudgetPreview(val) {
  const el = document.getElementById('credit-budget-info');
  if (el) el.style.display = parseFloat(val)>0 ? 'block' : 'none';
}

function savePret() {
  const type  = document.getElementById('pt-type').value;
  const nom   = document.getElementById('pt-nom').value.trim();
  const owner = document.getElementById('pt-owner').value;
  const mens  = parseFloat(document.getElementById('pt-mens').value);
  const cap   = parseFloat(document.getElementById('pt-cap').value)||0;
  const taux  = parseFloat(document.getElementById('pt-taux').value)||0;
  const dur   = parseInt(document.getElementById('pt-dur').value)||0;
  const startDate = document.getElementById('pt-start')?.value||'';

  if (!nom||isNaN(mens)){alert('Remplissez le nom et la mensualité.');return;}
  if (!type){alert('Sélectionnez le type de crédit.');return;}

  /* Mise à jour automatique du budget crédits */
  ensureDefaultCats();
  const creditCat = type === 'Logement' ? 'Habitation' : type;
  DB.budgets.credits[creditCat] = (DB.budgets.credits[creditCat]||0) + mens;

  const newPret = {id:uid(), nom, type, owner, mensualite:mens, capitalRestant:cap, tauxAnnuel:taux, dureeRestante:dur, startDate};
  DB.prets.push(newPret);

  /* Supprimer les anciennes transactions auto du mois courant pour ce prêt
     et forcer la ré-injection */
  const now = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  DB.transactions = DB.transactions.filter(t =>
    !t._pretKey || !t._pretKey.startsWith(`pret_auto_${newPret.id}_`)
  );

  document.getElementById('modal-pret').remove();
  injectPretsTransactions();
  saveDB(); render();
}
