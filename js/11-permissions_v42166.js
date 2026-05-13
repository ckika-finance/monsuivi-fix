/* ============================================================
   js/11-permissions.js — Système de rôles et permissions
   
   Rôles :
   - "admin"  → peut tout faire, y compris modifier les années passées
   - "viewer" → lecture seule sur toutes les années
   - null     → utilisateur standard (lecture seule sur années passées,
                 modification autorisée sur l'année courante uniquement)
   
   Le rôle est stocké dans Supabase sous la clé chiika_role
   (par user_id, comme toutes les autres données).
   ============================================================ */

/* Rôle courant — chargé au démarrage */
var CURRENT_ROLE = null; /* var pour compatibilité globale */ /* null = standard */

/* ---- Chargement du rôle depuis Supabase ---- */
async function loadRole() {
  try {
    const uid = getUserId();
    if (!uid) { CURRENT_ROLE = null; return; }
    /* Chercher la clé chiika_role:user_id */
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(uid+':chiika_role')}&select=value`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) { CURRENT_ROLE = null; return; }
    const rows = await res.json();
    CURRENT_ROLE = rows.length > 0 ? JSON.parse(rows[0].value) : null;
    console.log('[Permissions] Rôle chargé:', CURRENT_ROLE || 'standard');
  } catch(e) { CURRENT_ROLE = null; }
}

/* ---- Sauvegarde du rôle ---- */
async function saveRole(role) {
  const uid = getUserId();
  if (!uid) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method:  'POST',
      headers: getAuthHeaders(),
      body:    JSON.stringify({ key: uid+':chiika_role', value: JSON.stringify(role), updated_at: new Date().toISOString() })
    });
    return res.ok;
  } catch(e) { return false; }
}

/* ---- Vérifications de permission ---- */

/* Peut modifier une année donnée ? */
function canEdit(year) {
  if (CURRENT_ROLE === 'admin')  return true;
  if (CURRENT_ROLE === 'viewer') return false;
  /* Standard : seulement l'année courante */
  return year >= THIS_YEAR;
}

/* Peut voir toutes les années ? Oui pour tout le monde */
function canView(year) {
  return true;
}

/* Alias pour compatibilité avec l'existant */
function isPastYear(y) {
  return !canEdit(y);
}

/* ---- Utilitaires UI ---- */
function getRoleBadge() {
  if (CURRENT_ROLE === 'admin')  return `<span style="background:#E1F5EE;color:#0F6E56;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">👑 Admin</span>`;
  if (CURRENT_ROLE === 'viewer') return `<span style="background:#f0efed;color:#999;padding:2px 8px;border-radius:10px;font-size:10px">👁 Lecteur</span>`;
  return `<span style="background:#f0efed;color:#666;padding:2px 8px;border-radius:10px;font-size:10px">Utilisateur</span>`;
}

function getReadonlyBanner(year) {
  if (canEdit(year)) return '';
  const msg = CURRENT_ROLE === 'viewer'
    ? '👁 Mode lecture seule — votre compte ne peut pas modifier les données.'
    : `📅 ${year} — Année verrouillée. Seul un administrateur peut modifier les données passées.`;
  return `<div class="banner-warn" style="display:flex;align-items:center;justify-content:space-between">
    <span>${msg}</span>
    ${CURRENT_ROLE !== 'viewer' ? `<span style="font-size:11px;color:#999">Contactez l'admin pour débloquer</span>` : ''}
  </div>`;
}

/* ---- Section permissions dans Paramètres ---- */
function renderPermissionsSection() {
  const isAdmin = CURRENT_ROLE === 'admin';
  return `
  <div class="section-wrap" ${isAdmin ? '' : 'style="opacity:.6;pointer-events:none"'}>
    <div class="section-header">
      <span class="section-title">🔐 Permissions & Rôles</span>
      ${getRoleBadge()}
    </div>
    <div style="padding:16px">
      ${!isAdmin ? `<div style="font-size:12px;color:#999;margin-bottom:12px">
        Seul un administrateur peut modifier les rôles. Votre rôle actuel : <b>${CURRENT_ROLE||'standard'}</b>
      </div>` : ''}

      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Mon rôle</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['standard','viewer','admin'].map(r=>`
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:${isAdmin?'pointer':'default'};
            padding:8px 12px;border-radius:10px;border:1px solid ${CURRENT_ROLE===r||(!CURRENT_ROLE&&r==='standard')?'#1D9E75':'#e0dedd'};
            background:${CURRENT_ROLE===r||(!CURRENT_ROLE&&r==='standard')?'#E1F5EE':'#f5f4f0'}">
            <input type="radio" name="role-select" value="${r}" ${CURRENT_ROLE===r||(!CURRENT_ROLE&&r==='standard')?'checked':''}
              ${isAdmin?'':'disabled'} onchange="changeRole('${r}')">
            <span style="font-weight:500">${r==='admin'?'👑 Administrateur':r==='viewer'?'👁 Lecteur':'👤 Standard'}</span>
          </label>`).join('')}
        </div>
        <div style="font-size:11px;color:#bbb;margin-top:8px">
          Standard : modification année courante · Lecteur : consultation uniquement · Admin : accès complet
        </div>
      </div>

      ${isAdmin ? `
      <div style="padding-top:12px;border-top:1px solid #f0efed">
        <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Années modifiables</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px">
          En tant qu'admin, vous pouvez modifier toutes les années. Les autres utilisateurs sont limités à l'année courante.
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:#999">Années disponibles :</span>
          ${getAvailableYears().map(y=>`
          <span style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:500;
            background:${y>=THIS_YEAR?'#E1F5EE':'#FAEEDA'};color:${y>=THIS_YEAR?'#0F6E56':'#633806'}">
            ${y} ${y>=THIS_YEAR?'✓':'🔒 admin'}
          </span>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </div>`;
}

async function changeRole(role) {
  if (CURRENT_ROLE !== 'admin') return;
  const ok = await saveRole(role === 'standard' ? null : role);
  if (ok) {
    CURRENT_ROLE = role === 'standard' ? null : role;
    alert(`Rôle mis à jour : ${role}`);
    render();
  }
}
