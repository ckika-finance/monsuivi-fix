/* ============================================================
   js/09-page-prets.js — Suivi des Prêts & Crédits
   - Mois de début, dates réelles amortissement, capital recalculé
   ============================================================ */

const MONTHS_FR_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function moisEcoules(pret) {
  if (!pret.startDate) return 0;
  const start = new Date(pret.startDate);
  const now   = new Date();
  return Math.max(0, (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth()));
}

function capitalActuel(pret) {
  /* Si capitalInitial est disponible (nouveau format), on recalcule depuis le début.
     Sinon on utilise capitalRestant (ancien format) sans recalcul. */
  if (!pret.startDate) return pret.capitalRestant || 0;
  const capBase = pret.capitalInitial || pret.capitalRestant || 0;
  const { capitalRestant } = _computeCapitalActuel(
    capBase, pret.tauxAnnuel || 0, pret.mensualite, pret.dureeTotal || pret.dureeRestante || 0, pret.startDate
  );
  return capitalRestant;
}

function dureeRestanteActuelle(pret) {
  if (!pret.startDate) return pret.dureeRestante || 0;
  const durBase = pret.dureeTotal || pret.dureeRestante || 0;
  const { dureeRestante } = _computeCapitalActuel(
    pret.capitalInitial || pret.capitalRestant || 0,
    pret.tauxAnnuel || 0, pret.mensualite, durBase, pret.startDate
  );
  return dureeRestante;
}

function fmtStartDate(pret) {
  if (!pret.startDate) return 'Non renseigné';
  const d = new Date(pret.startDate);
  return `${MONTHS_FR_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtEcheance(pret, moisOffset) {
  if (!pret.startDate) return `Mois ${moisOffset}`;
  const d = new Date(pret.startDate);
  d.setMonth(d.getMonth() + moisEcoules(pret) + moisOffset);
  return `${MONTHS_FR_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Construit le tableau d'amortissement depuis capitalDepart,
 * avec les vraies dates calendaires (1ère ligne = mois courant+1).
 * @returns rows avec {mois, dateLabel, mensualite, partCapital, partInterets, capitalRestant, totalInterets}
 */
function buildAmortissement(pret, capitalDepart, duree) {
  const rows    = [];
  const capBase = capitalDepart !== undefined ? capitalDepart : capitalActuel(pret);
  const durBase = duree !== undefined ? duree : dureeRestanteActuelle(pret);
  const taux    = (pret.tauxAnnuel || 0) / 100 / 12;
  const mens    = pret.mensualite;
  let cap       = capBase;
  let totInt    = 0;
  const n       = getPersonCount();

  /* Date de départ du tableau = mois suivant le mois courant */
  const today = new Date();
  let eY = today.getFullYear(), eM = today.getMonth(); /* 0-based */

  for (let m = 1; m <= durBase && cap > 0.01; m++) {
    eM++; if (eM > 11) { eM = 0; eY++; }

    const pi  = Math.round(cap * taux * 100) / 100;
    const pc  = Math.min(cap, Math.round((mens - pi) * 100) / 100);
    cap       = Math.max(0, Math.round((cap - pc) * 100) / 100);
    totInt    = Math.round((totInt + pi) * 100) / 100;

    const dateLabel = new Date(eY, eM, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    /* Part par personne si crédit commun */
    const isCommun = !pret.owner || pret.owner === 'Commun';
    const partPerso = isCommun ? mens / n : mens;
    const pcPerso   = isCommun ? pc / n : pc;
    const piPerso   = isCommun ? pi / n : pi;

    rows.push({
      mois: m, dateLabel,
      mensualite: mens, mensualitePerso: partPerso,
      partCapital: pc, partCapitalPerso: pcPerso,
      partInterets: pi, partInteretsPerso: piPerso,
      capitalRestant: cap, totalInterets: totInt
    });
  }
  return rows;
}

function renderPrets() {
  if (!window._pretActif || !DB.prets.find(p=>p.id===window._pretActif)) {
    window._pretActif = DB.prets.length ? DB.prets[0].id : null;
  }

  if (!DB.prets || DB.prets.length===0) {
    return `<div class="section-wrap">
      <div class="section-header">
        <span class="section-title">Prêts & Crédits</span>
        <button class="btn-add" onclick="openPretModal()"><i class="ti ti-plus"></i> Ajouter un crédit</button>
      </div>
      <div class="empty-state" style="padding:40px">Aucun crédit enregistré.</div>
    </div>`;
  }

  const pret     = DB.prets.find(p=>p.id===window._pretActif);
  const capNow   = capitalActuel(pret);
  const durNow   = dureeRestanteActuelle(pret);
  const amort    = buildAmortissement(pret, capNow, durNow);
  const totalInt = amort.length ? amort[amort.length-1].totalInterets : 0;
  const totalMens = DB.prets.reduce((s,p)=>s+p.mensualite,0);
  const totalCap  = DB.prets.reduce((s,p)=>s+capitalActuel(p),0);

  const persons   = getActivePersons(); /* Toutes les personnes du compte */
  const txCredits = DB.transactions.filter(t=>t.type==='credits');
  const budCre    = Object.values(DB.budgets.credits||{}).reduce((a,b)=>a+b,0);

  function creditsPourPersonne(owner) {
    const cats={};
    txCredits.forEach(t=>{
      let share=Math.abs(t.amount);
      if(t.owner==='Commun') share /= getPersonCount();
      else if(t.owner!==owner) return;
      cats[t.label]=(cats[t.label]||0)+share;
    });
    return cats;
  }

  /* Calcul dynamique par personne (N personnes) */
  const perPersonData = persons.map(p => ({
    name:   p.name,
    key:    p.key,
    idx:    getPersonIdx(p.name),
    creds:  creditsPourPersonne(p.name),
    mens:   DB.prets.filter(pr=>pr.owner===p.name).reduce((s,pr)=>s+pr.mensualite,0),
    nb:     DB.prets.filter(pr=>pr.owner===p.name).length,
  }));
  perPersonData.forEach(pp => {
    pp.totalCred = Object.values(pp.creds).reduce((s,v)=>s+v,0);
  });
  const mensCom = DB.prets.filter(p=>!p.owner||p.owner==='Commun').reduce((s,p)=>s+p.mensualite,0);
  /* Rétrocompatibilité — garder name1/name2 pour les parties du code non refactorisées */
  const name1 = persons[0]?.name || '';
  const name2 = persons[1]?.name || '';

  return `
  <!-- KPI globaux -->
  <div class="kpi-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:12px">
    <div class="kpi-card">
      <div class="kpi-label">Total mensualités</div>
      <div class="kpi-value red">${fmt(totalMens)}</div>
      <div class="kpi-sub">${DB.prets.length} crédit${DB.prets.length>1?'s':''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Capital total restant</div>
      <div class="kpi-value blue">${fmt(totalCap)}</div>
      <div class="kpi-sub">Recalculé à ce jour</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Intérêts restants</div>
      <div class="kpi-value" style="color:#BA7517">${fmt(totalInt)}</div>
      <div class="kpi-sub">Pour ${pret.nom}</div>
    </div>
  </div>

  <!-- Par titulaire — masqué si 1 seule personne, dynamique pour N personnes -->
  ${getActivePersons().length>1?`
  <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:20px">
    ${perPersonData.map(pp=>{
      const av = AVATAR_COLORS[pp.idx] || AVATAR_COLORS[0];
      return `<div class="kpi-card" style="border-top:3px solid ${av.text}">
        <div class="kpi-label">
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px">
            <span style="width:16px;height:16px;border-radius:50%;background:${av.bg};color:${av.text};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${pp.name.charAt(0).toUpperCase()}</span>
            ${pp.name}
          </span>
        </div>
        <div class="kpi-value" style="color:${av.text};font-size:15px">${pp.mens>0?fmt(pp.mens)+'/mois':'—'}</div>
        <div class="kpi-sub">${pp.nb} crédit(s)</div>
      </div>`;
    }).join('')}
    <div class="kpi-card" style="border-top:3px solid #999">
      <div class="kpi-label"><span class="pret-owner-badge pret-owner-com" style="font-size:10px">👥 ${communLabel()}</span></div>
      <div class="kpi-value" style="color:#555;font-size:15px">${mensCom>0?fmt(mensCom)+'/mois':'—'}</div>
      <div class="kpi-sub">${DB.prets.filter(p=>!p.owner||p.owner==='Commun').length} crédit(s)</div>
    </div>
  </div>`:''}

  <!-- Crédits par personne — masqué si 1 seule personne, dynamique pour N personnes -->
  ${getActivePersons().length>1?`
  <div class="section-wrap" style="margin-bottom:20px">
    <div class="section-header">
      <span class="section-title">Crédits par personne</span>
      <span style="font-size:12px;color:#999">Depuis les transactions · ${communLabel()}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(perPersonData.length,2)},minmax(0,1fr));gap:0">
      ${perPersonData.map((pp,i)=>`
      <div style="padding:16px;${i<perPersonData.length-1?'border-right:1px solid var(--color-border-tertiary)':''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <b>${pp.name}</b><span class="kpi-value red" style="font-size:15px">${fmt(pp.totalCred)}</span>
        </div>
        ${Object.keys(DB.budgets.credits||{}).length ? renderPersonCreditBars(pp.name,pp.creds,budCre) : ''}
        ${Object.keys(pp.creds).length===0
          ? '<div style="color:#bbb;font-size:12px;text-align:center;padding:12px">Aucun crédit</div>'
          : renderPersonCreditRows(pp.creds)}
      </div>`).join('')}
    </div>
  </div>`:''}

  <!-- Sélecteur crédit actif -->
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
    ${DB.prets.map(p=>`
    <button class="tab-btn ${p.id===window._pretActif?'active':''}" onclick="window._pretActif='${p.id}';render()">
      ${p.nom}${p.type?` <span style="font-size:10px;opacity:.7">(${p.type})</span>`:''}
    </button>`).join('')}
    <button class="btn-add" style="margin-left:auto" onclick="openPretModal()">
      <i class="ti ti-plus"></i> Ajouter
    </button>
  </div>

  <!-- Détail crédit sélectionné -->
  <div class="section-wrap" style="margin-bottom:20px">
    <div class="section-header">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="section-title">${pret.nom}</span>
        ${getActivePersons().length>1?pretOwnerBadge(pret.owner):''}
        ${pret.type?`<span style="background:#f0efed;padding:2px 8px;border-radius:10px;font-size:11px;color:#666">${pret.type}</span>`:''}
      </div>
      <button class="btn-trash" onclick="deletePret('${pret.id}','${pret.nom}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Supprimer
      </button>
    </div>
    <div style="padding:16px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
      <div class="kpi-card">
        <div class="kpi-label">Mensualité</div>
        <div class="kpi-value red" style="font-size:16px">${fmt(pret.mensualite)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Capital restant</div>
        <div class="kpi-value blue" style="font-size:16px">${fmt(capNow)}</div>
        <div class="kpi-sub">À ce jour</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux annuel</div>
        <div class="kpi-value" style="color:#BA7517;font-size:16px">${pret.tauxAnnuel}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Durée restante</div>
        <div class="kpi-value" style="color:#534AB7;font-size:16px">${durNow} mois</div>
        <div class="kpi-sub">≈ ${(durNow/12).toFixed(1)} ans</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Début du crédit</div>
        <div style="font-size:13px;font-weight:500;color:#1a1a1a;margin-top:6px">${fmtStartDate(pret)}</div>
      </div>
    </div>
  </div>

  <!-- Avancement -->
  <div class="section-wrap" style="margin-bottom:20px">
    <div class="section-header"><span class="section-title">Avancement du remboursement</span></div>
    <div style="padding:16px">
      ${DB.prets.map(p=>{
        const cIni = p.capitalInitial || p.capitalRestant || 0;
        const cCur = capitalActuel(p);
        const paid = Math.max(0, cIni - cCur);
        const pct  = cIni>0 ? Math.min(100, Math.max(0, Math.round(paid/cIni*100))) : 0;
        const n    = moisEcoules(p);
        const durRestante = dureeRestanteActuelle(p);
        return `<div class="prog-row" style="margin-bottom:16px">
          <div class="prog-header" style="margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:500">${p.nom}${p.type?' ('+p.type+')':''}</span>
              ${getActivePersons().length>1?`<span style="font-size:10px;background:var(--color-background-secondary);padding:2px 7px;border-radius:10px;color:#888">${p.owner||'Commun'}</span>`:''}
            </div>
            <span style="color:#888">${fmt(cCur)} restants · ${durRestante} mois</span>
          </div>
          <div class="prog-track" style="height:10px;border-radius:6px">
            <div class="prog-real" style="width:${pct}%;background:${pct>75?'#1D9E75':pct>40?'#378ADD':'#BA7517'};border-radius:6px"></div>
          </div>
          <div style="font-size:11px;color:#aaa;margin-top:4px;display:flex;justify-content:space-between">
            <span>${p.startDate?'Démarré '+fmtStartDate(p)+(n>0?' · '+n+' mensualité'+(n>1?'s':'')+' passée'+(n>1?'s':''):''):'Date inconnue'}</span>
            <span>${pct}% remboursé</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- Tableau amortissement — 12 prochaines échéances -->
  ${(()=>{
    const isCommun = !pret.owner || pret.owner === 'Commun';
    const nPers    = getPersonCount();
    const showPerso = isCommun && nPers > 1;
    const next12   = amort.slice(0, 12);
    return `
  <div class="section-wrap">
    <div class="section-header">
      <span class="section-title">Tableau d'amortissement — ${pret.nom}</span>
      <span style="font-size:12px;color:#999">12 prochaines échéances${showPerso?' · Part/personne calculée':''}${pret.startDate?' · Démarré '+fmtStartDate(pret):''}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="budget-table" style="font-size:12px">
        <thead>
          <tr>
            <th style="text-align:left">Échéance</th>
            <th>Mensualité</th>
            ${showPerso?'<th>Part/pers.</th>':''}
            <th>Capital</th>
            <th>Intérêts</th>
            <th>Capital restant</th>
          </tr>
        </thead>
        <tbody>
          ${next12.map(r=>`
          <tr>
            <td style="color:#555;font-weight:500;text-transform:capitalize">${r.dateLabel}</td>
            <td>${fmt(r.mensualite)}</td>
            ${showPerso?`<td style="color:#534AB7">${fmt(r.mensualitePerso)}</td>`:''}
            <td style="color:#1D9E75">${fmt(r.partCapital)}</td>
            <td style="color:#D85A30">${fmt(r.partInterets)}</td>
            <td style="font-weight:600">${fmt(r.capitalRestant)}</td>
          </tr>`).join('')}
          ${amort.length > 12 ? `<tr><td colspan="${showPerso?6:5}" style="text-align:center;color:#bbb;padding:10px;font-size:11px">
            ${amort.length - 12} échéances masquées · Total intérêts restants : ${fmt(amort[amort.length-1].totalInterets)}
          </td></tr>` : ''}
        </tbody>
      </table>
    </div>
  </div>`;
  })()}`
}

function renderPersonCreditBars(owner, credCats, budgetTotal) {
  const cats=Object.keys(DB.budgets.credits||{});
  if (!cats.length) return '';
  const max=Math.max(...cats.map(c=>Math.max(credCats[c]||0,DB.budgets.credits[c]||0)),1);
  return `<div style="margin-bottom:12px">`+cats.map(cat=>{
    const r=credCats[cat]||0,b=DB.budgets.credits[cat]||0,over=r>b&&b>0;
    return `<div class="bar-row">
      <div class="bar-row-label" title="${cat}">${cat}</div>
      <div class="bar-track"><div class="bar-bg"></div>
        <div class="bar-fill" style="width:${Math.min(100,Math.round(r/max*100))}%;background:${over?'#D85A30':'#BA7517'}"></div>
        <div class="bar-mark" style="left:${Math.min(100,Math.round(b/max*100))}%"></div>
      </div>
      <div class="bar-val ${over?'amount-neg':''}">${fmtS(r)}${over?' ▲':''}</div>
    </div>`;
  }).join('')+`</div>`;
}

function renderPersonCreditRows(credCats) {
  return `<table class="data-table" style="font-size:12px">
    <tr><th>Catégorie</th><th>Montant payé</th><th>Budget</th></tr>
    ${Object.entries(credCats).map(([cat,v])=>{
      const b=DB.budgets.credits?.[cat]||0,over=v>b&&b>0;
      return `<tr class="${over?'row-alert':''}">
        <td>${cat}</td>
        <td style="${over?'color:#993C1D;font-weight:600':''}">${fmt(v)}${over?' ▲':''}</td>
        <td>${b>0?fmt(b):'<span style="color:#ccc">—</span>'}</td>
      </tr>`;
    }).join('')}
  </table>`;
}
