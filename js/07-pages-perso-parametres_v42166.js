/* ============================================================
   js/07-pages-perso-parametres.js — Perso + Paramètres
   Structure exacte du mockup
   ============================================================ */

const AVATAR_COLORS = [
  { bg:'#E1F5EE', text:'#0F6E56' },
  { bg:'#FBEAF0', text:'#72243E' },
  { bg:'#FAEEDA', text:'#633806' },
  { bg:'#EEEDFE', text:'#3C3489' },
];

function getPersonIdx(name) {
  return getActivePersons().findIndex(p=>p.name===name);
}

/* ============================================================
   PAGE PERSO — structure exacte du mockup
   ============================================================ */
function renderPerso(owner) {
  const txs   = getTxCurrent();
  const bud   = getBudgetForPerson(currentYear, owner); // 50/50 split sauf salaires
  const types = ['revenus','depenses','abonnements','credits','epargne','projets'];
  const sld   = soldeNetForPerson(txs, owner);
  const idx   = getPersonIdx(owner);
  const av    = AVATAR_COLORS[idx] || AVATAR_COLORS[0];
  const init  = owner.charAt(0).toUpperCase();

  const kpiData = types.map(type => {
    const reals  = persoRealByCat(txs, type, owner);
    const total  = Object.values(reals).reduce((s,v)=>s+v, 0);
    const budget = Object.values(bud[type]||{}).reduce((a,x)=>a+x, 0);
    return { type, total, budget, reals, over: total>budget&&budget>0&&type!=='revenus' };
  });

  const depReals = kpiData.find(k=>k.type==='depenses')?.reals||{};
  const facReals = kpiData.find(k=>k.type==='abonnements')?.reals||{};

  return `
  <!-- En-tête perso — exactement comme le mockup -->
  <div class="perso-header" style="margin-bottom:16px;border-radius:12px;border:0.5px solid var(--color-border-tertiary)">
    <div class="perso-avatar" style="background:${av.bg};color:${av.text}">${init}</div>
    <div>
      <div class="perso-name">${owner}</div>
      <div class="perso-sub">Vue personnelle · ${currentPeriodLabel()}${getActivePersons().length>1?' · Commun réparti à 50%':''}</div>
    </div>
    <div class="perso-solde">
      <div class="perso-solde-label">Solde net</div>
      <div class="perso-solde-val ${sld<0?'neg':''}">${sld>=0?'+':''}${fmt(sld)}</div>
    </div>
  </div>

  <!-- KPI 3 colonnes — comme le mockup -->
  <div class="perso-kpis" style="margin-bottom:16px">
    ${kpiData.slice(0,6).map(k=>`
    <div class="perso-kpi ${k.over?'kpi-alert':''}">
      <div class="perso-kpi-label">${TYPE_LABELS[k.type]}s${k.over?' ▲':''}</div>
      <div class="perso-kpi-val" style="color:${TYPE_COLORS[k.type]}">${k.total>0?fmt(k.total):'—'}</div>
      <div class="perso-kpi-sub">Budget ${fmtS(k.budget)}</div>
    </div>`).join('')}
  </div>

  <!-- 2 colonnes barres dépenses + abonnements -->
  <div class="two-col" style="margin-bottom:16px">

    <div class="card">
      <div class="card-head">
        <span class="card-title">Dépenses variables</span>
        <span style="font-size:12px;font-weight:500;color:#D85A30">${fmt(kpiData.find(k=>k.type==='depenses')?.total||0)}</span>
      </div>
      <div class="card-body">
        ${Object.keys(bud.depenses||{}).map(cat=>{
          const r=depReals[cat]||0, b=bud.depenses[cat]||0, over=r>b&&b>0;
          const maxV=Math.max(r,b,1);
          return `<div class="prog-row">
            <div class="prog-head">
              <span class="prog-name ${over?'over':''}">${cat}${over?' ▲':''}</span>
              <span class="prog-val">${fmtS(r)} / ${fmtS(b)}</span>
            </div>
            <div class="prog-track">
              <div class="prog-real" style="width:${Math.min(100,Math.round(r/maxV*100))}%;background:${over?'#D85A30':'#D85A30'}"></div>
            </div>
          </div>`;
        }).join('')||'<div style="color:#bbb;font-size:12px;text-align:center;padding:8px">Aucune dépense</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <span class="card-title">Abonnements</span>
        <span style="font-size:12px;font-weight:500;color:#378ADD">${fmt(kpiData.find(k=>k.type==='abonnements')?.total||0)}</span>
      </div>
      <div class="card-body">
        ${Object.keys(bud.abonnements||{}).map(cat=>{
          const r=facReals[cat]||0, b=bud.abonnements[cat]||0;
          const maxV=Math.max(r,b,1);
          return `<div class="prog-row">
            <div class="prog-head">
              <span class="prog-name">${cat}</span>
              <span class="prog-val">${fmtS(r)} / ${fmtS(b)}</span>
            </div>
            <div class="prog-track">
              <div class="prog-real" style="width:${Math.min(100,Math.round(r/maxV*100))}%;background:#378ADD"></div>
            </div>
          </div>`;
        }).join('')||'<div style="color:#bbb;font-size:12px;text-align:center;padding:8px">Aucun abonnement</div>'}
      </div>
    </div>

  </div>

  <!-- Mini tableaux -->
  <div class="tables-grid">
    ${types.map(type=>renderMiniTable(type==='abonnements'?'Abonnements':TYPE_LABELS[type]+'s', TYPE_HEADER_CLS[type], bud[type]||{}, persoRealByCat(txs,type,owner))).join('')}
  </div>`;
}

/* ============================================================
   PAGE PARAMÈTRES
   ============================================================ */
function renderParametres() {
  const types      = ['revenus','depenses','abonnements','credits','epargne','projets'];
  const thisYear   = THIS_YEAR;
  const years      = getAvailableYears();
  const editYears  = years.filter(y=>y>=thisYear);
  const TRASH_SVG  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  return `<div style="display:flex;flex-direction:column;gap:14px">

    <!-- Personnes -->
    <div class="section-wrap">
      <div class="section-header">
        <span class="section-title">Personnes suivies</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:#999">${DB.persons.count} personne${DB.persons.count>1?'s':''}</span>
          ${DB.persons.count>1?`<button class="btn-trash-sm" onclick="removeLastPerson()" title="Retirer la dernière">${TRASH_SVG}</button>`:''}
          ${DB.persons.count<4?`<button class="btn-sm-green" onclick="addPerson()">+ Ajouter</button>`:''}
        </div>
      </div>
      <div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${getActivePersons().map((p,i)=>{
          const av=AVATAR_COLORS[i]||AVATAR_COLORS[0];
          return `<div class="form-group" style="margin:0">
            <label class="form-label" style="display:flex;align-items:center;gap:6px">
              <span style="width:16px;height:16px;border-radius:50%;background:${av.bg};color:${av.text};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:600">${p.name.charAt(0).toUpperCase()}</span>
              Personne ${i+1}
            </label>
            <input class="form-input" type="text" value="${p.name}"
              onchange="renamePerson('${p.key}',this.value)" placeholder="Prénom ${i+1}">
          </div>`;
        }).join('')}
      </div>
      <div style="padding:0 16px 14px;border-top:0.5px solid var(--color-border-tertiary)">
        <button class="btn-trash" onclick="resetOnboarding()" style="margin-top:10px;font-size:12px">
          ${TRASH_SVG} Recommencer la configuration initiale
        </button>
      </div>
    </div>

    <!-- Budget prévisionnel -->
    <div class="section-wrap">
      <div class="section-header">
        <span class="section-title">Budget prévisionnel par année</span>
        <span style="font-size:12px;color:#999">Années courante et futures uniquement</span>
      </div>
      <div style="padding:16px">
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          ${editYears.map((y,i)=>`<button class="tab-btn ${i===0?'active':''}" onclick="showYearBudget(${y},this)">${y}</button>`).join('')}
          <button class="btn-sm-green" onclick="addFutureYear()">+ Nouvelle année</button>
        </div>
        ${editYears.map((y,yi)=>`
        <div id="year-bud-${y}" style="display:${yi===0?'block':'none'}">
          <div style="font-size:12px;color:#999;margin-bottom:12px">Budget ${y} ${y===thisYear?'(en cours)':'(futur)'}</div>
          <div class="tab-row">
            ${types.map((t,i)=>`<button class="tab-btn ${i===0?'active':''}" onclick="showBudTab('${y}','${t}',this)">${TYPE_LABELS[t]}s</button>`).join('')}
          </div>
          ${types.map(type=>{
            const bud=getBudgetForYear(y);
            return `<div id="budtab-${y}-${type}" style="display:${type==='revenus'?'block':'none'}">
              ${Object.keys(bud[type]).map(cat=>`
              <div class="cat-input-row">
                <span class="cat-label">${cat}</span>
                <input class="cat-number" type="number" value="${bud[type][cat]}" step="0.01"
                  onchange="setBudgetPrev(${y},'${type}','${cat}',this.value)">
                <button class="btn-trash-sm" onclick="deleteBudgetCat(${y},'${type}','${cat}')" title="Supprimer">${TRASH_SVG}</button>
              </div>`).join('')}
              <div class="cat-input-row" style="margin-top:8px;border-top:0.5px solid var(--color-border-tertiary);padding-top:8px;border-bottom:none">
                <input id="nc-${y}-${type}" type="text" placeholder="Nouvelle catégorie…"
                  style="flex:1;padding:6px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;font-size:12px;font-family:var(--font-sans);background:#f5f4f0">
                <input id="nb-${y}-${type}" type="number" placeholder="Budget €" step="0.01"
                  style="width:100px;padding:6px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:6px;font-size:12px;font-family:var(--font-sans);background:#f5f4f0">
                <button class="btn-sm-green" onclick="addBudgetCat(${y},'${type}')">Ajouter</button>
              </div>
            </div>`;
          }).join('')}
        </div>`).join('')}
        ${editYears.length===0?'<div class="empty-state">Aucune année modifiable.</div>':''}
      </div>
    </div>

    <!-- Prêts -->
    <div class="section-wrap">
      <div class="section-header">
        <span class="section-title">Prêts & Crédits</span>
        <button class="btn-add" onclick="openPretModal()"><i class="ti ti-plus"></i> Ajouter</button>
      </div>
      <table class="budget-table">
        <thead>
          <tr><th>Nom</th><th>Titulaire</th><th>Mensualité</th><th>Capital restant</th><th>Taux</th><th>Durée</th><th></th></tr>
        </thead>
        <tbody>
          ${DB.prets.length===0
            ?`<tr><td colspan="7" class="empty-state" style="padding:20px">Aucun prêt enregistré</td></tr>`
            :DB.prets.map(p=>`<tr>
              <td style="font-weight:500">${p.nom}</td>
              <td>${pretOwnerBadge(p.owner)}</td>
              <td>${fmt(p.mensualite)}</td>
              <td>${fmt(p.capitalRestant)}</td>
              <td>${p.tauxAnnuel}%</td>
              <td>${p.dureeRestante} mois</td>
              <td><button class="btn-trash-sm" onclick="deletePret('${p.id}','${p.nom}')" title="Supprimer">${TRASH_SVG}</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Objectifs épargne / projets -->
    <div class="section-wrap">
      <div class="section-header"><span class="section-title">Objectifs épargne & projets</span></div>
      <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          <div style="font-size:11px;font-weight:600;color:#999;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Épargne — objectifs totaux</div>
          ${Object.keys(DB.epa_totals).map(k=>`<div class="cat-input-row">
            <span class="cat-label">${k}</span>
            <input class="cat-number" type="number" value="${DB.epa_totals[k]}"
              onchange="DB.epa_totals['${k}']=parseFloat(this.value)||0;saveDB()">
          </div>`).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#999;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Projets — objectifs totaux</div>
          ${Object.keys(DB.pro_totals).map(k=>`<div class="cat-input-row">
            <span class="cat-label">${k}</span>
            <input class="cat-number" type="number" value="${DB.pro_totals[k]}"
              onchange="DB.pro_totals['${k}']=parseFloat(this.value)||0;saveDB()">
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Permissions & Rôles -->
    ${renderPermissionsSection()}

    <!-- Zone danger -->
    <div class="section-wrap" style="border-color:rgba(216,90,48,.2)">
      <div class="section-header">
        <span class="section-title" style="color:#D85A30">Zone de danger</span>
        <button class="btn-danger" onclick="resetDB()">${TRASH_SVG} Réinitialiser toutes les données</button>
      </div>
    </div>

  </div>`;
}

/* ============================================================
   FONCTIONS UTILITAIRES PARAMÈTRES
   ============================================================ */
function showYearBudget(year, btn) {
  document.querySelectorAll('[id^="year-bud-"]').forEach(el=>el.style.display='none');
  const el=document.getElementById('year-bud-'+year); if(el) el.style.display='block';
  btn.closest('.section-wrap').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function showBudTab(year, type, btn) {
  ['revenus','depenses','abonnements','credits','epargne','projets'].forEach(t=>{
    const el=document.getElementById(`budtab-${year}-${t}`); if(el) el.style.display='none';
  });
  const el=document.getElementById(`budtab-${year}-${type}`); if(el) el.style.display='block';
  btn.closest('[id^="year-bud-"]').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function setBudgetPrev(year, type, cat, val) {
  ensureBudgetYear(year); DB.budget_prev[year][type][cat]=parseFloat(val)||0; saveDB();
}
function deleteBudgetCat(year, type, cat) {
  if(!confirmDelete(`Supprimer "${cat}" du budget ${year} ?`)) return;
  ensureBudgetYear(year); delete DB.budget_prev[year][type][cat]; saveDB(); render();
}
function addBudgetCat(year, type) {
  const nEl=document.getElementById(`nc-${year}-${type}`), bEl=document.getElementById(`nb-${year}-${type}`);
  const name=nEl?.value.trim(), budget=parseFloat(bEl?.value)||0;
  if(!name) return;
  ensureBudgetYear(year); DB.budget_prev[year][type][name]=budget;
  saveDB(); render();
}
function addFutureYear() {
  const years=getAvailableYears();
  const next=(years[0]||THIS_YEAR)+1;
  ensureBudgetYear(next); saveDB(); render();
}
function deletePret(id, nom) {
  if(!confirmDelete(`Supprimer le prêt "${nom}" ?`)) return;
  DB.prets = DB.prets.filter(p => p.id !== id);
  /* Supprimer les transactions auto de mensualité liées à ce prêt */
  DB.transactions = DB.transactions.filter(t =>
    !t._pretKey || !t._pretKey.startsWith(`pret_auto_${id}_`)
  );
  saveDB(); render();
}
function renamePerson(key, newName) {
  const old=DB.persons[key];
  if(!newName.trim()||newName.trim()===old) return;
  const n=newName.trim();
  DB.transactions.forEach(t=>{if(t.owner===old) t.owner=n;});
  [['Salaire Net '],['Extras ']].forEach(([prefix])=>{
    const oldCat=prefix+old, newCat=prefix+n;
    const bud=DB.budgets?.revenus;
    if(bud&&oldCat in bud){bud[newCat]=bud[oldCat];delete bud[oldCat];}
    DB.transactions.forEach(t=>{if(t.label===oldCat) t.label=newCat;});
  });
  DB.persons[key]=n;
  saveDB(); refreshSidebarNames(); render();
}
function addPerson() {
  const count=DB.persons.count||2;
  if(count>=4) return;
  DB.persons.count=count+1;
  DB.persons['person'+(count+1)]='Personne '+(count+1);
  saveDB(); render();
}
function removeLastPerson() {
  const count=DB.persons.count||2;
  if(count<=1) return;
  const name=DB.persons['person'+count];
  if(!confirmDelete(`Retirer "${name}" ?`)) return;
  DB.persons['person'+count]=null;
  DB.persons.count=count-1;
  saveDB(); render();
}
function resetOnboarding() {
  if(!confirmDelete('Relancer la configuration initiale ? Cela réinitialisera vos données.')) return;
  DB.onboarding=false;
  saveDB().then(()=>showOnboarding());
}
function pretOwnerBadge(owner) {
  if(!owner||owner==='Commun') return `<span class="pret-owner-badge pret-owner-com">👥 Commun</span>`;
  const idx=getPersonIdx(owner);
  const cls=['pret-owner-p1','pret-owner-p2','pret-owner-p3','pret-owner-p4'][idx]||'pret-owner-com';
  return `<span class="pret-owner-badge ${cls}">◈ ${owner}</span>`;
}
