/* ============================================================
   js/05-page-dashboard.js — Vue d'ensemble
   Graphiques d'évolution, indicateurs visuels, comparaison mois
   SANS les mini-tableaux (déplacés dans Détails financiers)
   ============================================================ */

/* Icônes par label */
const TX_ICONS_DB = {
  'courses':'ti-building-store','lidl':'ti-building-store',
  'carburant':'ti-gas-station','restaurant':'ti-tools-kitchen-2',
  'shopping':'ti-shopping-bag','loyer':'ti-home','logement':'ti-home',
  'électricité':'ti-bolt','electricite':'ti-bolt','netflix':'ti-device-tv',
  'spotify':'ti-music','internet':'ti-wifi','box':'ti-wifi',
  'téléphone':'ti-phone','transport':'ti-train',
  'crèche':'ti-baby-carriage','creche':'ti-baby-carriage',
  'salaire':'ti-trending-up','western union':'ti-send',
  'assurance':'ti-shield','eau':'ti-droplet','gaz':'ti-flame',
  'épargne':'ti-piggy-bank','vacances':'ti-beach','santé':'ti-heart-rate-monitor',
};
function getTxIconDB(label, type) {
  const low = label.toLowerCase();
  const key = Object.keys(TX_ICONS_DB).find(k=>low.includes(k));
  const icon = key ? TX_ICONS_DB[key] : (type==='revenus'?'ti-trending-up':type==='abonnements'?'ti-file-invoice':type==='epargne'?'ti-piggy-bank':'ti-receipt');
  const bg = {revenus:'#E1F5EE',depenses:'#FAECE7',abonnements:'#E6F1FB',credits:'#FAEEDA',epargne:'#EEEDFE',projets:'#FBEAF0'}[type]||'#f5f4f0';
  const cl = {revenus:'#0F6E56',depenses:'#993C1D',abonnements:'#185FA5',credits:'#633806',epargne:'#3C3489',projets:'#72243E'}[type]||'#999';
  return {icon,bg,cl};
}

/* Données des 6 derniers mois pour les graphiques */
function getLast6Months() {
  const result = [];
  const now = new Date();
  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.getMonth()+1, y = d.getFullYear();
    const txs = getTxByMonthYear(m, y);
    const MONTHS_S = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    result.push({
      label: MONTHS_S[m-1]+' '+String(y).slice(2),
      month: m, year: y,
      rev:   sumType(txs,'revenus'),
      dep:   sumType(txs,'depenses'),
      abo:   sumType(txs,'abonnements'),
      cre:   sumType(txs,'credits'),
      epa:   sumType(txs,'epargne'),
      sld:   soldeNet(txs),
    });
  }
  return result;
}

function renderDashboard() {
  const readonly = isPastYear(currentYear);
  const bud  = getBudgetForYear(currentYear);
  const txs  = getTxCurrent();

  const tRev = sumType(txs,'revenus');
  const tDep = sumType(txs,'depenses');
  const tAbo = sumType(txs,'abonnements');
  const tCre = sumType(txs,'credits');
  const tEpa = sumType(txs,'epargne');
  const tSld = tRev - tDep - tAbo - tCre;

  /* Réels par catégorie (pour dépenses par catégorie) */
  const depReal = realByCat(txs, 'depenses');

  const monthsWithTx = currentMonth===0
    ? new Set(DB.transactions.filter(t=>new Date(t.date).getFullYear()===currentYear).map(t=>new Date(t.date).getMonth()+1)).size
    : 1;
  const factor = currentMonth===0 ? Math.max(monthsWithTx,1) : 1;

  const budRev = Object.values(bud.revenus   ||{}).reduce((a,b)=>a+b,0)*factor;
  const budDep = Object.values(bud.depenses  ||{}).reduce((a,b)=>a+b,0)*factor;
  const budAbo = Object.values(bud.abonnements||{}).reduce((a,b)=>a+b,0)*factor;
  const budCre = Object.values(bud.credits   ||{}).reduce((a,b)=>a+b,0)*factor;
  const budEpa = Object.values(bud.epargne   ||{}).reduce((a,b)=>a+b,0)*factor;
  const totalMens = DB.prets.reduce((s,p)=>s+p.mensualite,0);

  const depPct = tRev>0 ? Math.round((tDep+tAbo)/tRev*100) : 0;
  const maxBar = Math.max(tRev,1);

  /* Données pour tendances (hero balance) */
  const hist = getLast6Months();

  /* Tendance : comparer mois courant vs mois précédent */
  const curr = hist[hist.length-1];
  const prev = hist[hist.length-2];
  function trend(valCurr, valPrev) {
    if (!valPrev) return null;
    const diff = valCurr - valPrev;
    const pct  = Math.abs(Math.round(diff/valPrev*100));
    return { diff, pct, up: diff>0 };
  }
  const tRevTrend = trend(curr?.rev, prev?.rev);
  const tSldTrend = trend(curr?.sld, prev?.sld);

  /* Découvert */
  const decouvert = checkDecouvert();

  const readonlyBanner = readonly
    ? `<div class="banner-warn"><i class="ti ti-calendar-off"></i> ${currentPeriodLabel()} — consultation uniquement.</div>` : '';
  const decouvertBanner = (!readonly && decouvert)
    ? `<div style="background:#FAECE7;border:1px solid rgba(216,90,48,.3);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <i class="ti ti-alert-triangle" style="color:#D85A30;font-size:20px;flex-shrink:0"></i>
        <div>
          <div style="font-size:13px;font-weight:600;color:#D85A30">Solde négatif ce mois-ci</div>
          <div style="font-size:12px;color:#993C1D;margin-top:2px">
            Découvert de ${fmt(decouvert.montant)}
          </div>
        </div>
      </div>` : '';

  /* Dernières transactions (5) */
  const lastTxs = [...DB.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const MONTHS_S2 = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];

  return `
${readonlyBanner}
${decouvertBanner}

<!-- ① HERO SOLDE -->
<div class="balance-hero">
  <div>
    <div class="balance-label">Solde net · ${currentPeriodLabel()}</div>
    <div class="balance-amount ${tSld<0?'neg':''}">${tSld>=0?'+':''}${fmt(tSld)}</div>

    ${tRevTrend?`<div style="margin-top:8px;font-size:11px;color:${tRevTrend.up?'#1D9E75':'#D85A30'}">
      ${tRevTrend.up?'↑':'↓'} Revenus ${tRevTrend.up?'+':''}${tRevTrend.pct}% vs mois précédent
    </div>`:''}
    ${tSldTrend?`<div style="font-size:11px;color:${tSldTrend.up?'#1D9E75':'#D85A30'}">
      ${tSldTrend.up?'↑':'↓'} Solde ${tSldTrend.up?'+':''}${tSldTrend.pct}% vs mois précédent
    </div>`:''}
  </div>
  <div class="balance-bar-wrap">
    ${[
      ['Revenus',  tRev, '#1D9E75'],
      ['Dépenses', tDep, '#D85A30'],
      ['Abonnements', tAbo, '#378ADD'],
      ['Épargne',  tEpa, '#534AB7'],
    ].map(([lbl,val,clr])=>`
    <div class="bbar-row">
      <div class="bbar-label">${lbl}</div>
      <div class="bbar-track"><div class="bbar-fill" style="width:${Math.min(100,Math.round(val/maxBar*100))}%;background:${clr}"></div></div>
      <div class="bbar-val" style="color:${clr}">${fmt(val)}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ② KPI 4 CARDS -->
<div class="kpi-row" style="margin-bottom:16px">
  <div class="kpi-card-sm ${tDep>budDep&&budDep>0?'kpi-alert':''}">
    <div class="kpi-label-sm">Dépenses variables</div>
    <div class="kpi-val-sm" style="color:#D85A30">${fmt(tDep)}</div>
    <div class="kpi-progress"><div class="kpi-fill" style="width:${Math.min(100,pct(tDep,budDep))}%;background:#D85A30"></div></div>
    <div class="kpi-sub-sm">Budget ${fmt(budDep)} · ${pct(tDep,budDep)}%</div>
  </div>
  <div class="kpi-card-sm ${tAbo>budAbo&&budAbo>0?'kpi-alert':''}">
    <div class="kpi-label-sm">Abonnements</div>
    <div class="kpi-val-sm" style="color:#378ADD">${fmt(tAbo)}</div>
    <div class="kpi-progress"><div class="kpi-fill" style="width:${Math.min(100,pct(tAbo,budAbo))}%;background:#378ADD"></div></div>
    <div class="kpi-sub-sm">Budget ${fmt(budAbo)} · ${pct(tAbo,budAbo)}%</div>
  </div>
  <div class="kpi-card-sm">
    <div class="kpi-label-sm">Épargne</div>
    <div class="kpi-val-sm" style="color:#534AB7">${fmt(tEpa)}</div>
    <div class="kpi-progress"><div class="kpi-fill" style="width:${Math.min(100,pct(tEpa,budEpa))}%;background:#534AB7"></div></div>
    <div class="kpi-sub-sm">Objectif ${fmt(budEpa)} · ${pct(tEpa,budEpa)>=100?'✓ atteint':pct(tEpa,budEpa)+'%'}</div>
  </div>
  <div class="kpi-card-sm">
    <div class="kpi-label-sm">Mensualités crédits</div>
    <div class="kpi-val-sm" style="color:#BA7517">${fmt(totalMens)}</div>
    <div class="kpi-progress"><div class="kpi-fill" style="width:${totalMens>0?Math.min(100,Math.round(totalMens/Math.max(tRev,1)*100)):0}%;background:#BA7517"></div></div>
    <div class="kpi-sub-sm">${DB.prets.length} crédit${DB.prets.length!==1?'s':''} actif${DB.prets.length!==1?'s':''}</div>
  </div>
</div>

<!-- ③ DERNIÈRES TRANSACTIONS + RÉPARTITION + DÉPENSES PAR CATÉGORIE -->
<div class="two-col" style="margin-bottom:16px">

  <!-- Colonne gauche : Dernières transactions -->
  <div class="card">
    <div class="card-head">
      <span class="card-title">Dernières transactions</span>
      <span class="card-link" onclick="navigate('transactions')">Voir tout</span>
    </div>
    <div class="card-body" style="padding:0">
      ${lastTxs.length===0
        ? '<div class="empty-state" style="padding:16px">Aucune transaction</div>'
        : lastTxs.map(t=>{
          const {icon,bg,cl}=getTxIconDB(t.label,t.type);
          const d=new Date(t.date);
          return `<div class="tx-item" style="padding:7px 16px">
            <div class="tx-icon" style="background:${bg}"><i class="ti ${icon}" style="color:${cl};font-size:13px"></i></div>
            <div class="tx-info">
              <div class="tx-name">${t.label}</div>
              <div class="tx-meta">${d.getDate()} ${MONTHS_S2[d.getMonth()]} · ${t.owner}</div>
            </div>
            <div class="tx-amount ${t.amount>=0?'pos':'neg'}">${t.amount>=0?'+':''}${fmtS(t.amount)}</div>
          </div>`;
        }).join('')}
    </div>
  </div>

  <!-- Colonne droite : Répartition + Dépenses par catégorie -->
  <div style="display:flex;flex-direction:column;gap:12px">

    <!-- Répartition des charges (donut) -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">Répartition des charges</span>
        <span style="font-size:11px;color:#D85A30">${depPct}% du revenu</span>
      </div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:16px">
          <svg width="72" height="72" viewBox="0 0 72 72" style="flex-shrink:0">
            <circle cx="36" cy="36" r="26" fill="none" stroke="#f0efed" stroke-width="10"/>
            ${(()=>{
              const total = tDep+tAbo+tEpa+totalMens;
              if(total<=0) return '<text x="36" y="39" text-anchor="middle" font-size="9" fill="#999">—</text>';
              const circ=163.4; let off=22;
              return [[tDep,'#D85A30'],[tAbo,'#378ADD'],[tEpa,'#534AB7'],[totalMens,'#BA7517']].map(([v,c])=>{
                if(v<=0) return '';
                const dash=Math.round(v/total*circ), gap=circ-dash;
                const out=`<circle cx="36" cy="36" r="26" fill="none" stroke="${c}" stroke-width="10"
                  stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${off}" stroke-linecap="round"/>`;
                off-=dash; return out;
              }).join('');
            })()}
            <text x="36" y="33" text-anchor="middle" font-size="11" font-weight="500" fill="#1a1a1a">${depPct}%</text>
            <text x="36" y="45" text-anchor="middle" font-size="9" fill="#999">charges</text>
          </svg>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            ${[['Variables',tDep,'#D85A30'],['Abonnements',tAbo,'#378ADD'],['Épargne',tEpa,'#534AB7'],['Crédits',totalMens,'#BA7517']].map(([lbl,val,clr])=>`
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:8px;height:8px;border-radius:50%;background:${clr};flex-shrink:0"></div>
              <span style="font-size:11px;color:#666;flex:1">${lbl}</span>
              <span style="font-size:11px;font-weight:500;color:#1a1a1a">${val>0?fmt(val):'—'}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Dépenses par catégorie -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">Dépenses par catégorie</span>
        <span class="card-link" onclick="navigate('budget')">Budget</span>
      </div>
      <div class="card-body" style="padding-top:8px">
        ${(()=>{
          const cats = Object.keys(bud.depenses||{});
          if(!cats.length) return '<div style="color:#bbb;font-size:12px">Aucune dépense budgétée</div>';
          const allVals = cats.map(c=>Math.max(depReal[c]||0, bud.depenses[c]||0));
          const maxV = Math.max(...allVals,1);
          return cats.map(cat=>{
            const r=depReal[cat]||0, b=bud.depenses[cat]||0, over=r>b&&b>0;
            const pctW=b>0?Math.min(100,Math.round(r/b*100)):0;
            return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid #f5f4f0">
              <div style="font-size:11px;color:${over?'#D85A30':'#555'};flex:1;font-weight:${over?'600':'400'}">${cat}${over?' ▲':''}</div>
              <div style="width:80px;height:3px;background:#f0efed;border-radius:2px;overflow:hidden;flex-shrink:0">
                <div style="width:${pctW}%;height:100%;background:${over?'#D85A30':'#D85A30'};border-radius:2px"></div>
              </div>
              <div style="font-size:11px;font-weight:500;color:${over?'#D85A30':'#333'};min-width:52px;text-align:right">${r>0?fmt(r):'—'}${over?' ▲':''}</div>
              <div style="font-size:10px;color:#aaa;min-width:44px;text-align:right">/ ${fmtS(b)}</div>
            </div>`;
          }).join('');
        })()}
      </div>
    </div>

  </div>
</div>`;
}

/* Pas de Chart.js — SVG inline */
function initDonut() {}

/* ============================================================
   PAGE ANALYSE DÉTAILLÉE — mini-tableaux + graphiques avancés
   ============================================================ */
function renderAnalyse() {
  const bud    = getBudgetForYear(currentYear);
  const txs    = getTxCurrent();
  const factor = currentMonth===0 ? 12 : 1;
  const hist   = getLast6Months();

  /* Graphique évolution dépenses par catégorie (barres horizontales) */
  /* renderTrend : barres par catégorie — masque les lignes sans données */
  function renderTrend(type, color) {
    const budCats = bud[type] || {};
    const reals   = realByCat(txs, type);
    /* Fusionner les catégories du budget + celles ayant des réels (nouvelles catégories) */
    const allCats = [...new Set([...Object.keys(budCats), ...Object.keys(reals)])];
    /* Filtrer : garder seulement celles avec budget ou réel > 0 */
    const cats = allCats.filter(cat => (reals[cat]||0) > 0 || (budCats[cat]||0) > 0);
    if (!cats.length) return '';
    const maxVal = Math.max(...cats.map(c => Math.max(reals[c]||0, (budCats[c]||0)*factor)), 1);
    return cats.map(cat => {
      const r = reals[cat]||0, b = (budCats[cat]||0)*factor, over = r>b && b>0;
      return `<div class="bar-row">
        <div class="bar-row-label" title="${cat}">${cat}</div>
        <div class="bar-track">
          <div class="bar-bg"></div>
          <div class="bar-fill" style="width:${Math.min(100,Math.round(r/maxVal*100))}%;background:${over?'#D85A30':color}"></div>
          <div class="bar-mark" style="left:${Math.min(100,Math.round(b/maxVal*100))}%"></div>
        </div>
        <div class="bar-val ${over?'amount-neg':''}">${fmtS(r)}${over?' ▲':''}</div>
      </div>`;
    }).join('');
  }

  return `
  <div style="font-size:12px;color:#999;margin-bottom:16px">
    Détails financiers · ${currentPeriodLabel()} · Les barres montrent le réel vs le budget prévu.
  </div>

  <!-- Graphique 6 mois détaillé -->
  <div class="section-wrap" style="margin-bottom:16px">
    <div class="section-header">
      <span class="section-title">Évolution mensuelle — 6 mois</span>
    </div>
    <div style="padding:16px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:400px">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;color:#999;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Mois</th>
            <th style="text-align:right;padding:6px 8px;color:#1D9E75;font-size:10px">Revenus</th>
            <th style="text-align:right;padding:6px 8px;color:#D85A30;font-size:10px">Dépenses</th>
            <th style="text-align:right;padding:6px 8px;color:#378ADD;font-size:10px">Abonnements</th>
            <th style="text-align:right;padding:6px 8px;color:#BA7517;font-size:10px">Crédits</th>
            <th style="text-align:right;padding:6px 8px;color:#534AB7;font-size:10px">Épargne</th>
            <th style="text-align:right;padding:6px 8px;color:#555;font-size:10px">Solde</th>
          </tr>
        </thead>
        <tbody>
          ${hist.map((h,i)=>{
            const isLast = i===hist.length-1;
            const prevH  = hist[i-1];
            const sldDiff = prevH ? h.sld-prevH.sld : 0;
            return `<tr style="border-top:0.5px solid #f0efed;${isLast?'background:#fafaf8;font-weight:500':''}">
              <td style="padding:6px 8px;color:#666">${h.label}</td>
              <td style="text-align:right;padding:6px 8px;color:#1D9E75;font-family:monospace">${h.rev>0?fmtS(h.rev):'—'}</td>
              <td style="text-align:right;padding:6px 8px;color:#D85A30;font-family:monospace">${h.dep>0?fmtS(h.dep):'—'}</td>
              <td style="text-align:right;padding:6px 8px;color:#378ADD;font-family:monospace">${h.abo>0?fmtS(h.abo):'—'}</td>
              <td style="text-align:right;padding:6px 8px;color:#BA7517;font-family:monospace">${h.cre>0?fmtS(h.cre):'—'}</td>
              <td style="text-align:right;padding:6px 8px;color:#534AB7;font-family:monospace">${h.epa>0?fmtS(h.epa):'—'}</td>
              <td style="text-align:right;padding:6px 8px;font-weight:600;color:${h.sld>=0?'#1D9E75':'#D85A30'}">
                ${h.sld!==0?((h.sld>=0?'+':'')+fmtS(h.sld)):'—'}
                ${sldDiff!==0&&prevH?`<span style="font-size:9px;color:${sldDiff>0?'#1D9E75':'#D85A30'}"> ${sldDiff>0?'↑':'↓'}</span>`:''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Sections détaillées par type — masquées automatiquement si vides -->
  ${(()=>{
    const sections = [
      ['Revenus',     'rev', 'revenus',     '#1D9E75'],
      ['Dépenses',    'dep', 'depenses',    '#D85A30'],
      ['Abonnements', 'abo', 'abonnements', '#378ADD'],
      ['Crédits',     'cre', 'credits',     '#BA7517'],
      ['Épargne',     'epa', 'epargne',     '#534AB7'],
      ['Projets',     'pro', 'projets',     '#D4537E']
    ];
    return sections.map(([title, cls, type, color])=>{
      const budCats    = bud[type] || {};
      const reals      = realByCat(txs, type);
      const allCats    = [...new Set([...Object.keys(budCats), ...Object.keys(reals)])];
      const activeCats = allCats.filter(cat => (reals[cat]||0)>0 || (budCats[cat]||0)>0);
      if (!activeCats.length) return '';
      const tReal  = activeCats.reduce((s,cat)=>s+(reals[cat]||0), 0);
      const tBud   = activeCats.reduce((s,cat)=>s+(budCats[cat]||0), 0)*factor;
      const maxVal = Math.max(...activeCats.map(cat=>Math.max(reals[cat]||0,(budCats[cat]||0)*factor)), 1);
      return '<div class="section-wrap" style="margin-bottom:14px">'
        + '<div class="section-header">'
          + '<span class="section-title" style="display:flex;align-items:center;gap:8px">'
            + '<span style="width:10px;height:10px;border-radius:3px;background:'+color+';display:inline-block"></span>'
            + title
          + '</span>'
          + '<span style="font-size:12px;color:#999">'
            + 'Réel : <strong style="color:'+color+'">'+fmt(tReal)+'</strong>'
            + (tBud>0 ? ' &nbsp;·&nbsp; Budget : <strong>'+fmt(tBud)+'</strong>' : '')
          + '</span>'
        + '</div>'
        + '<div style="padding:14px 16px">'
          + activeCats.map(cat=>{
              const r=reals[cat]||0, b=(budCats[cat]||0)*factor, over=r>b&&b>0;
              const pctR=maxVal>0?Math.min(100,Math.round(r/maxVal*100)):0;
              const pctB=maxVal>0?Math.min(100,Math.round(b/maxVal*100)):0;
              return '<div class="bar-row">'
                + '<div class="bar-row-label" title="'+cat+'" style="color:'+(over?'#D85A30':'inherit')+'">'+cat+(over?' ▲':'')+'</div>'
                + '<div class="bar-track">'
                  + '<div class="bar-bg"></div>'
                  + '<div class="bar-fill" style="width:'+pctR+'%;background:'+(over?'#D85A30':color)+'"></div>'
                  + (b>0 ? '<div class="bar-mark" style="left:'+pctB+'%"></div>' : '')
                + '</div>'
                + '<div class="bar-val '+(over?'amount-neg':'')+'">'+(r>0?fmt(r):'—')+(b>0?' / '+fmt(b):'')+'</div>'
              + '</div>';
            }).join('')
        + '</div>'
      + '</div>';
    }).filter(Boolean).join('');
  })()}
  </div>`;
}

function renderMiniTable(title, cls, budgets, reals, factor=1) {
  /* Fusionner les catégories budget + celles avec réels seulement */
  const allCats    = [...new Set([...Object.keys(budgets), ...Object.keys(reals)])];
  const activeCats = allCats.filter(cat => (reals[cat]||0)>0 || (budgets[cat]||0)>0);
  if (!activeCats.length) return '';
  const tR = activeCats.reduce((s,c)=>s+(reals[c]||0), 0);
  const tB = activeCats.reduce((s,c)=>s+(budgets[c]||0), 0)*factor;
  return `<div class="table-card">
    <div class="table-header ${cls}">${title}</div>
    <table class="data-table">
      <tr><th>Catégorie</th><th>Réel</th><th>Budget</th></tr>
      ${activeCats.map(cat=>{
        const r=reals[cat]||0, b=(budgets[cat]||0)*factor, over=r>b&&b>0;
        return `<tr class="${over?'row-alert':''}">
          <td>${cat}</td>
          <td style="${over?'color:#D85A30;font-weight:500':''}">${r>0?fmt(r):'<span style="color:#ccc">—</span>'}${over?' ▲':''}</td>
          <td style="color:#999">${b>0?fmt(b):'<span style="color:#ccc">—</span>'}</td>
        </tr>`;
      }).join('')}
      <tr style="font-weight:500;background:#f5f4f0">
        <td>Total</td><td>${fmt(tR)}</td><td style="color:#999">${tB>0?fmt(tB):'—'}</td>
      </tr>
    </table>
  </div>`;
}
