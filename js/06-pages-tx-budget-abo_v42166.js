/* ============================================================
   js/06-pages-tx-budget-abo.js — Transactions, Budget, Abonnements
   Structure exacte du mockup
   ============================================================ */

const TRASH_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const TRASH_MD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

/* Icônes par label (même fonction que dashboard) */
const TX_ICONS_MAP = {
  'courses':'ti-building-store','lidl':'ti-building-store','carrefour':'ti-building-store',
  'carburant':'ti-gas-station','essence':'ti-gas-station',
  'restaurant':'ti-tools-kitchen-2','loyer':'ti-home','logement':'ti-home',
  'électricité':'ti-bolt','electricite':'ti-bolt','netflix':'ti-device-tv',
  'spotify':'ti-music','internet':'ti-wifi','box':'ti-wifi',
  'téléphone':'ti-phone','telephone':'ti-phone',
  'transport':'ti-train','crèche':'ti-baby-carriage','creche':'ti-baby-carriage',
  'salaire':'ti-trending-up','western union':'ti-send','assurance':'ti-shield',
  'eau':'ti-droplet','gaz':'ti-flame','épargne':'ti-piggy-bank',
  'vacances':'ti-beach','santé':'ti-heart-rate-monitor','shopping':'ti-shopping-bag',
};
function txIconData(label, type) {
  const low = label.toLowerCase();
  const key = Object.keys(TX_ICONS_MAP).find(k=>low.includes(k));
  const icon = key ? TX_ICONS_MAP[key] : (type==='revenus'?'ti-trending-up':type==='abonnements'?'ti-file-invoice':type==='epargne'?'ti-piggy-bank':'ti-receipt');
  const bg = {revenus:'#E1F5EE',depenses:'#FAECE7',abonnements:'#E6F1FB',credits:'#FAEEDA',epargne:'#EEEDFE',projets:'#FBEAF0'}[type]||'#f5f4f0';
  const cl = {revenus:'#0F6E56',depenses:'#993C1D',abonnements:'#185FA5',credits:'#633806',epargne:'#3C3489',projets:'#72243E'}[type]||'#999';
  return {icon,bg,cl};
}

/* ---- TRANSACTIONS ---- */
function renderTransactions() {
  const readonly = isPastYear(currentYear);
  const allTxs   = getTxCurrent();
  const filtered = allTxs.filter(t=>
    (filterType==='all'||t.type===filterType) &&
    (filterOwner==='all'||t.owner===filterOwner)
  );
  const sorted = [...filtered].sort((a,b)=>b.date.localeCompare(a.date));

  /* Grouper par date */
  const grouped = {};
  sorted.forEach(t => { if(!grouped[t.date]) grouped[t.date]=[]; grouped[t.date].push(t); });
  const dateKeys = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  const DAYS_FR  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const MONTHS_S = ['JANV','FÉVR','MARS','AVRI','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];
  function fmtDate(s) {
    const d=new Date(s);
    return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
  }

  return `
  ${readonly?`<div class="banner-warn"><i class="ti ti-calendar-off"></i> ${currentPeriodLabel()} — consultation uniquement.</div>`:''}
  <div class="section-wrap">
    <div class="section-header" style="background:#fff">
      <span class="section-title">${currentPeriodLabel()} · <span style="color:#999;font-weight:400">${filtered.length} opération${filtered.length!==1?'s':''}</span></span>
      ${!readonly?`<button class="btn-add" onclick="openTxModal()"><i class="ti ti-plus"></i> Ajouter</button>`:''}
    </div>

    <!-- Filtres pills comme le mockup -->
    <div style="display:flex;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary)">
      <select class="filter-select" onchange="filterType=this.value;render()">
        <option value="all" ${filterType==='all'?'selected':''}>Tous les types</option>
        ${['revenus','depenses','abonnements','credits','epargne','projets'].map(t=>
          `<option value="${t}" ${filterType===t?'selected':''}>${TYPE_LABELS[t]}s</option>`
        ).join('')}
      </select>
      ${getActivePersons().length > 1 ? `
      <select class="filter-select" onchange="filterOwner=this.value;render()">
        <option value="all" ${filterOwner==='all'?'selected':''}>Tous</option>
        ${getAllOwners().map(n=>`<option value="${n}" ${filterOwner===n?'selected':''}>${n}</option>`).join('')}
        <option value="Commun" ${filterOwner==='Commun'?'selected':''}>Commun</option>
      </select>` : ''}
    </div>

    ${sorted.length===0
      ? `<div class="empty-state">Aucune transaction${filterType!=='all'||filterOwner!=='all'?' — changez les filtres':''}</div>`
      : dateKeys.map(dateStr=>`
        <!-- Label date -->
        <div class="tx-group-label">${fmtDate(dateStr)}</div>
        <!-- Lignes -->
        ${grouped[dateStr].map(t=>{
          const {icon,bg,cl}=txIconData(t.label,t.type);
          return `<div class="tx-row">
            <div class="tx-icon" style="background:${bg}">
              <i class="ti ${icon}" style="color:${cl};font-size:14px"></i>
            </div>
            <div class="tx-info">
              <div class="tx-name">${t.label}</div>
              <div class="tx-meta">
                <span class="badge ${TYPE_BADGE[t.type]}">${TYPE_LABELS[t.type]}</span>
                ${getActivePersons().length>1?`· ${t.owner}`:''}${t.comment?` · <em style="color:#bbb">${t.comment}</em>`:''}
              </div>
            </div>
            ${!readonly?`<div class="tx-actions">
              <button class="icon-btn" data-edit-tx="${t.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
              <button class="icon-btn btn-trash-sm" data-delete-tx="${t.id}" data-label="${t.label}" title="Supprimer">${TRASH_SM}</button>
            </div>`:''}
            <div class="tx-right">
              <div class="tx-amount ${t.amount>=0?'pos':'neg'}">${t.amount>=0?'+':''}${fmt(t.amount)}</div>
              ${getActivePersons().length>1?`<div class="tx-owner">${t.owner}</div>`:''}
            </div>
          </div>`;
        }).join('')}`
      ).join('')}
  </div>`;
}

/* ---- BUDGET ---- */
function renderBudget() {
  const txs      = getTxCurrent();
  const bud      = getBudgetForYear(currentYear);
  const readonly = isPastYear(currentYear);
  const factor   = currentMonth===0 ? 12 : 1;

  const tRev = sumType(txs,'revenus');
  const tDep = sumType(txs,'depenses')+sumType(txs,'abonnements')+sumType(txs,'credits');
  const sld  = tRev - tDep;

  const sections = [
    { key:'revenus',  label:'Revenus',            color:'#1D9E75', icon:'ti-trending-up' },
    { key:'depenses', label:'Dépenses variables',  color:'#D85A30', icon:'ti-shopping-cart' },
    { key:'abonnements', label:'Abonnements',      color:'#378ADD', icon:'ti-file-invoice' },
    { key:'credits',  label:'Crédits',             color:'#BA7517', icon:'ti-building-bank' },
    { key:'epargne',  label:'Épargne',             color:'#534AB7', icon:'ti-piggy-bank' },
    { key:'projets',  label:'Projets',             color:'#D4537E', icon:'ti-beach' },
  ];

  return `
  ${readonly?`<div class="banner-warn"><i class="ti ti-calendar-off"></i> Budget ${currentPeriodLabel()} — lecture seule.</div>`:''}

  <!-- Résumé 3 cards -->
  <div class="bud-summary-row" style="margin-bottom:16px">
    <div class="bud-sum-card">
      <div class="bud-sum-label">Revenus réels</div>
      <div class="bud-sum-val" style="color:#1D9E75">${fmt(tRev)}</div>
      <div class="bud-sum-bar"><div class="bud-sum-fill" style="width:100%;background:#1D9E75"></div></div>
    </div>
    <div class="bud-sum-card">
      <div class="bud-sum-label">Charges totales</div>
      <div class="bud-sum-val" style="color:#D85A30">${fmt(tDep)}</div>
      <div class="bud-sum-bar"><div class="bud-sum-fill" style="width:${tRev>0?Math.min(100,Math.round(tDep/tRev*100)):0}%;background:#D85A30"></div></div>
    </div>
    <div class="bud-sum-card">
      <div class="bud-sum-label">Solde disponible</div>
      <div class="bud-sum-val" style="color:${sld>=0?'#1D9E75':'#D85A30'}">${sld>=0?'+':''}${fmt(sld)}</div>
      <div class="bud-sum-bar"><div class="bud-sum-fill" style="width:${tRev>0?Math.min(100,Math.round(Math.abs(sld)/tRev*100)):0}%;background:${sld>=0?'#1D9E75':'#D85A30'}"></div></div>
    </div>
  </div>

  <div class="section-wrap">
    ${sections.map(sec => {
      const cats = Object.keys(bud[sec.key]||{});
      if (cats.length===0) return '';
      const real = realByCat(txs, sec.key);
      return `
      <div class="bud-section-label">
        <i class="ti ${sec.icon}" style="color:${sec.color}"></i> ${sec.label}
      </div>
      ${cats.map(cat => {
        const r=real[cat]||0, b=(bud[sec.key][cat]||0)*factor, over=r>b&&b>0;
        const p=b>0?Math.min(100,Math.round(r/b*100)):0;
        const status=over?'Dépassé':p>=85?'Limite':'OK';
        return `<div class="bud-row">
          <div class="bud-cat ${over?'over':''}">${cat}${over?' ▲':''}</div>
          <div class="bud-track"><div class="bud-fill" style="width:${p}%;background:${over?'#D85A30':p>=85?'#BA7517':sec.color}"></div></div>
          <div class="bud-real ${over?'over':''}">${r>0?fmt(r):'—'}</div>
          <div class="bud-budget">/ ${fmt(b)}</div>
          <div class="bud-ecart ${over?'over':r>0?'ok':''}">${r>0?(b-r>=0?'+':'')+fmtS(b-r):'—'}</div>
          <span class="status-pill ${status==='OK'?'s-ok':status==='Limite'?'s-warn':'s-over'}">${status}</span>
        </div>`;
      }).join('')}`;
    }).join('')}
  </div>`;
}

/* ---- ABONNEMENTS ---- */
function renderAbonnements() {
  const total = DB.abonnements.reduce((s,a)=>s+a.amount, 0);
  const now   = new Date();

  function aboBadge(owner) {
    if(owner==='Commun') return 'abo-commun';
    const persons=getActivePersons(), idx=persons.findIndex(p=>p.name===owner);
    return ['abo-p1','abo-p2','abo-p3','abo-p4'][idx]||'abo-commun';
  }

  /* Couleur engagement selon avancement */
  function engagementColor(abo) {
    if (abo.engagement !== 'oui' || !abo.startDate || !abo.endDate) return null;
    const start = new Date(abo.startDate);
    const end   = new Date(abo.endDate);
    const total = end - start;
    const elapsed = now - start;
    if (total <= 0) return null;
    const pct = elapsed / total;
    if (pct < 0.33) return { color:'#1D9E75', label:'Début', bg:'#E1F5EE' };
    if (pct < 0.66) return { color:'#BA7517', label:'Milieu', bg:'#FAEEDA' };
    return { color:'#D85A30', label:'Fin proche', bg:'#FAECE7' };
  }

  /* Prochain prélèvement calculé */
  function nextPrelevement(abo) {
    const day = abo.day || 1;
    const d   = new Date(now.getFullYear(), now.getMonth(), day);
    if (d <= now) d.setMonth(d.getMonth()+1);
    const MONTHS_S = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
  }

  return `
  <div class="bud-summary-row" style="margin-bottom:16px">
    <div class="bud-sum-card">
      <div class="bud-sum-label">Total mensuel</div>
      <div class="bud-sum-val" style="color:#D85A30">${fmt(total)}</div>
    </div>
    <div class="bud-sum-card">
      <div class="bud-sum-label">Abonnements actifs</div>
      <div class="bud-sum-val" style="color:#378ADD">${DB.abonnements.length}</div>
    </div>
    <div class="bud-sum-card">
      <div class="bud-sum-label">Coût annuel</div>
      <div class="bud-sum-val" style="color:#534AB7">${fmt(total*12)}</div>
    </div>
  </div>

  <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <button class="btn-add" onclick="openAboModal()"><i class="ti ti-plus"></i> Ajouter</button>
    <span style="font-size:11px;color:#999">Les abonnements sont injectés automatiquement chaque mois dans les transactions.</span>
  </div>

  <div class="abonnements-grid">
    ${DB.abonnements.length === 0
      ? `<div class="empty-state">Aucun abonnement enregistré.</div>`
      : DB.abonnements.map(a => {
        const eng  = engagementColor(a);
        const next = nextPrelevement(a);
        return `
        <div class="abo-card" style="${eng?`border-left:3px solid ${eng.color}`:''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
            <div class="abo-name">${a.name}</div>
            <div style="display:flex;gap:4px">
              <button class="btn-edit-sm" onclick="openAboModal('${a.id}')" title="Modifier"><i class="ti ti-pencil" style="font-size:12px"></i></button>
              <button class="btn-trash-sm" data-delete-abo="${a.id}" data-name="${a.name}">${TRASH_SM}</button>
            </div>
          </div>
          <div class="abo-amount">${fmt(a.amount)}<span style="font-size:12px;font-weight:400;color:#999">/mois</span></div>
          <div class="abo-meta" style="margin-top:6px">
            <span style="background:#f0efed;padding:2px 6px;border-radius:6px">${a.cat||'—'}</span>
            <span>·</span>
            <span>Prochain : ${next}</span>
          </div>
          <div style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${getActivePersons().length>1?`<span class="abo-owner-badge ${aboBadge(a.owner)}">${a.owner}</span>`:''}
            ${eng
              ? `<span style="background:${eng.bg};color:${eng.color};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500">
                  ● ${eng.label}
                  ${a.endDate?`· fin ${new Date(a.endDate).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`:''}
                </span>`
              : a.engagement==='oui'
                ? `<span style="background:#f0efed;color:#999;padding:2px 8px;border-radius:10px;font-size:10px">Avec engagement</span>`
                : `<span style="background:#f0efed;color:#999;padding:2px 8px;border-radius:10px;font-size:10px">Sans engagement</span>`
            }
          </div>
        </div>`;
      }).join('')}
  </div>`;
}
