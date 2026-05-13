/* ============================================================
   js/04-app.js — Navigation — structure exacte du mockup
   ============================================================ */

let currentPage  = 'dashboard';
let currentMonth = new Date().getMonth() + 1;
let currentYear  = new Date().getFullYear();
let chartInst    = null;
let filterType   = 'all';
let filterOwner  = 'all';

const AV_COLORS = [
  { bg:'#E1F5EE', text:'#0F6E56' },
  { bg:'#FBEAF0', text:'#72243E' },
  { bg:'#FAEEDA', text:'#633806' },
  { bg:'#EEEDFE', text:'#3C3489' },
];

function getPageTitles() {
  const titles = {
    dashboard:'Vue d\'ensemble', transactions:'Transactions',
    budget:'Budget', abonnements:'Abonnements',
    analyse:'Détails financiers',
    prets:'Prêts', parametres:'Paramètres'
  };
  getActivePersons().forEach(p=>{ titles[p.key]=p.name; });
  return titles;
}

/* ---- Rebuild sidebar dynamiquement comme le mockup ---- */
function refreshSidebarNames() {
  const persons = getActivePersons();
  const hasMultiPersons = persons.length > 1;

  /* Label section PERSONNES — masqué si 0 ou 1 personne */
  const lbl = document.getElementById('persons-nav-label');
  if (lbl) lbl.style.display = hasMultiPersons ? '' : 'none';

  /* Supprimer anciens items personnes */
  document.querySelectorAll('.nav-item[data-person]').forEach(el=>el.remove());

  /* Insérer avant .nav-bottom */
  const navBottom = document.querySelector('.nav-bottom');
  /* Insérer les items personnes seulement si > 1 personne */
  if (hasMultiPersons) {
    persons.forEach((p, idx) => {
      const av   = AV_COLORS[idx] || AV_COLORS[0];
      const init = p.name.charAt(0).toUpperCase();
      const el   = document.createElement('div');
      el.className      = 'nav-item';
      el.dataset.page   = p.key;
      el.dataset.person = '1';
      el.innerHTML = `
        <span class="nav-avatar" style="background:${av.bg};color:${av.text};font-size:10px;font-weight:600">${init}</span>
        ${p.name}
      `;
      if (navBottom) navBottom.parentNode.insertBefore(el, navBottom);
    });
  }

  /* Mobile nav — afficher les boutons perso seulement si > 1 personne */
  persons.forEach((p, idx) => {
    const btn   = document.getElementById(`mob-p${idx+1}`);
    const label = document.getElementById(`mob-p${idx+1}-label`);
    if (btn)   { btn.style.display = hasMultiPersons ? '' : 'none'; btn.dataset.page=p.key; }
    if (label) label.textContent = p.name;
  });
  for (let i=persons.length+1; i<=4; i++) {
    const btn=document.getElementById(`mob-p${i}`);
    if (btn) btn.style.display='none';
  }
}

function refreshNavActive() {
  document.querySelectorAll('.nav-item[data-page], .mobile-nav-item[data-page]').forEach(el=>{
    el.classList.toggle('active', el.dataset.page===currentPage);
  });
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-page]');
  if (nav && (nav.classList.contains('nav-item')||nav.classList.contains('mobile-nav-item'))) {
    navigate(nav.dataset.page);
  }
  const editBtn = e.target.closest('[data-edit-tx]');
  if (editBtn) openTxModal(editBtn.dataset.editTx);
});

document.addEventListener('change', e => {
  if (e.target.id==='month-select') { currentMonth=parseInt(e.target.value); destroyChart(); render(); }
  if (e.target.id==='year-select')  { currentYear =parseInt(e.target.value); destroyChart(); render(); }
});

function navigate(page) {
  currentPage = page;
  refreshNavActive();
  document.getElementById('page-title').textContent = getPageTitles()[page]||page;
  destroyChart();
  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;
  render();
}

function destroyChart() {
  if (chartInst) { chartInst.destroy(); chartInst=null; }
}

function buildTopbarSelectors() {
  const monthSel = document.getElementById('month-select');
  const yearSel  = document.getElementById('year-select');
  if (!monthSel||!yearSel) return;

  /* Toutes les années disponibles PLUS les 3 années passées même sans transaction */
  const txYears = getAvailableYears();
  const allYears = new Set(txYears);
  for (let y = THIS_YEAR - 3; y <= THIS_YEAR + 1; y++) allYears.add(y);
  const years = [...allYears].sort((a,b)=>b-a);

  yearSel.innerHTML = years.map(y=>`<option value="${y}" ${y===currentYear?'selected':''}>${y}${!canEdit(y)?' 🔒':''}</option>`).join('');
  monthSel.value = currentMonth;

  /* Badge lecture seule */
  const badge = document.getElementById('readonly-badge');
  if (badge) {
    const locked = !canEdit(currentYear);
    badge.style.display = locked ? 'inline-flex' : 'none';
    if (locked) {
      badge.innerHTML = CURRENT_ROLE === 'viewer'
        ? '🔒 Lecture seule'
        : `🔒 ${currentYear} — verrouillé`;
    }
  }
}

function setSyncBadge(text) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const isOk   = text.includes('Synchronisé')||text.includes('Sauvegardé')||text.includes('Migré');
  const isWarn = text.includes('⚠')||text.includes('📴')||text.includes('partielle');
  const isBusy = text.includes('Sync')||text.includes('Sauvegarde')||text.includes('Migration');
  const clr    = isWarn?'#BA7517':isOk?'#1D9E75':isBusy?'#378ADD':'#999';
  /* Badge compact : juste le point coloré avec tooltip */
  el.innerHTML = `<span class="sync-dot" style="background:${clr};${isBusy?'animation:pulse 1s infinite':''}"></span>`;
  el.title = text.replace(/[☁️💾⏳⚙️📴⚠️✓]/g,'').trim();
}

function render() {
  const container = document.getElementById('content');
  if (!container) return;

  refreshSidebarNames();
  refreshNavActive();
  buildTopbarSelectors();

  const personPages = {};
  getActivePersons().forEach(p=>{ personPages[p.key]=p.name; });

  if (personPages[currentPage]) {
    /* Vue perso : afficher seulement si > 1 personne configurée */
    if (getActivePersons().length <= 1) {
      currentPage = 'dashboard';
      container.innerHTML = renderDashboard();
      if (typeof initDonut === 'function') initDonut();
      refreshNavActive();
    } else {
      container.innerHTML = renderPerso(personPages[currentPage]);
    }
  } else {
    switch (currentPage) {
      case 'dashboard':    container.innerHTML = renderDashboard();    break;
      case 'transactions': container.innerHTML = renderTransactions(); break;
      case 'budget':       container.innerHTML = renderBudget();       break;
      case 'abonnements':  container.innerHTML = renderAbonnements();  break;
      case 'prets':        container.innerHTML = renderPrets();        break;
      case 'analyse':      container.innerHTML = renderAnalyse();      break;
      case 'parametres':   container.innerHTML = renderParametres();   break;
      default:             container.innerHTML = '<div class="empty-state">Page inconnue</div>';
    }
  }

  if (currentPage==='dashboard') initDonut();
  attachDeleteHandlers();

  container.querySelectorAll('script').forEach(old=>{
    const s=document.createElement('script');
    s.textContent=old.textContent;
    old.parentNode.replaceChild(s,old);
  });
}

function attachDeleteHandlers() {
  document.querySelectorAll('[data-delete-tx]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (!confirmDelete(`Supprimer "${btn.dataset.label||''}" ?`)) return;
      DB.transactions=DB.transactions.filter(t=>t.id!==btn.dataset.deleteTx);
      saveDB(); render();
    });
  });
  document.querySelectorAll('[data-delete-abo]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (!confirmDelete(`Supprimer l'abonnement "${btn.dataset.name||''}" ?`)) return;
      const aboId = btn.dataset.deleteAbo;
      /* Supprimer l'abonnement */
      DB.abonnements = DB.abonnements.filter(a => a.id !== aboId);
      /* Supprimer toutes les transactions auto liées à cet abonnement */
      DB.transactions = DB.transactions.filter(t =>
        !t._aboKey || !t._aboKey.startsWith(`abo_auto_${aboId}_`)
      );
      saveDB(); render();
    });
  });
}
