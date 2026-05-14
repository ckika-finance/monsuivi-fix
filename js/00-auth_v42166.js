/* ============================================================
   js/00-auth.js — Authentification Supabase
   Login + Inscription (signup) avec email + mot de passe
   ============================================================ */

const AUTH_URL = 'https://iuazbpthcktxpnvletbp.supabase.co/auth/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YXpicHRoY2t0eHBudmxldGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzY0NTgsImV4cCI6MjA5MzU1MjQ1OH0.G1cJxDs9E7w3INoUirDwTlmpG9_jQ7MFFZMJ22tTzzg';

/* URL de production — utilisée comme redirectTo dans les emails Supabase */
const SITE_URL = 'https://chiikaa.netlify.app';

let SESSION = null;

/* ---- Session locale ---- */
function loadSession() {
  try {
    const raw = localStorage.getItem('chiika_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expires_at && Date.now() / 1000 > s.expires_at - 60) {
      localStorage.removeItem('chiika_session');
      return null;
    }
    return s;
  } catch(e) { return null; }
}

function saveSession(session) {
  SESSION = session;
  if (session) localStorage.setItem('chiika_session', JSON.stringify(session));
  else         localStorage.removeItem('chiika_session');
}

/* ---- Login ---- */
async function authLogin(email, password) {
  try {
    const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body:    JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error_description || data.msg || 'Identifiants incorrects' };
    saveSession(data);
    return { ok: true };
  } catch(e) {
    return { ok: false, error: 'Connexion impossible. Vérifiez votre réseau.' };
  }
}

/* ---- Inscription ---- */
async function authSignup(email, password) {
  try {
    const res = await fetch(`${AUTH_URL}/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body:    JSON.stringify({
        email,
        password,
        /* Forcer la redirection vers le site de prod après confirmation email */
        options: { emailRedirectTo: SITE_URL }
      })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.msg || data.error_description || data.error || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists'))
        return { ok: false, error: 'Cet email est déjà utilisé. Connectez-vous plutôt.' };
      if (msg.toLowerCase().includes('password'))
        return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
      return { ok: false, error: msg || 'Inscription impossible. Réessayez.' };
    }
    /* Supabase peut retourner une session directement si "confirm email" est désactivé */
    if (data.access_token) {
      saveSession(data);
      return { ok: true, confirmed: true };
    }
    /* Sinon confirmation par email requise */
    return { ok: true, confirmed: false };
  } catch(e) {
    return { ok: false, error: 'Inscription impossible. Vérifiez votre réseau.' };
  }
}

/* ---- Refresh ---- */
async function authRefresh(refreshToken) {
  try {
    const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body:    JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await res.json();
    if (!res.ok) return null;
    saveSession(data);
    return data;
  } catch(e) { return null; }
}

/* ---- Logout ---- */
async function authLogout() {
  if (SESSION?.access_token) {
    await fetch(`${AUTH_URL}/logout`, {
      method:  'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + SESSION.access_token }
    }).catch(() => {});
  }

  /* Purger le cache localStorage lié à cet utilisateur pour éviter
     toute fuite de données vers un prochain compte sur le même appareil */
  const uid = SESSION?.user?.id || SESSION?.sub;
  if (uid) {
    const prefix = uid + ':';
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  }

  saveSession(null);
  showLoginScreen();
}

/* ---- Init ---- */
async function initAuth() {
  let session = loadSession();
  if (session?.refresh_token) {
    const refreshed = await authRefresh(session.refresh_token);
    if (refreshed) session = refreshed;
    else           session = null;
  }
  if (!session) { showLoginScreen(); return false; }
  SESSION = session;
  return true;
}

/* ---- Headers ---- */
function getAuthHeaders() {
  const token = SESSION?.access_token || ANON_KEY;
  return {
    'Content-Type':  'application/json',
    'apikey':        ANON_KEY,
    'Authorization': 'Bearer ' + token,
    'Prefer':        'resolution=merge-duplicates'
  };
}

/* ============================================================
   ÉCRAN LOGIN / INSCRIPTION
   ============================================================ */

/* Mode actif : 'login' ou 'signup' */
let _authMode = 'login';

function showLoginScreen(mode) {
  _authMode = mode || 'login';
  document.getElementById('app').style.display = 'none';

  let screen = document.getElementById('login-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'login-screen';
    document.body.appendChild(screen);
  }
  screen.style.display = 'flex';
  _renderAuthScreen(screen);
}

function _renderAuthScreen(screen) {
  const isLogin = _authMode === 'login';

  screen.innerHTML = `
  <div class="login-wrapper">
    <div class="login-card">

      <!-- Logo -->
      <div class="login-logo">Chiika <span>Finance</span></div>
      <div class="login-subtitle">Gestion financière familiale</div>

      <!-- Onglets Login / Inscription -->
      <div class="auth-tabs">
        <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="switchAuthMode('login')">
          Se connecter
        </button>
        <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="switchAuthMode('signup')">
          Créer un compte
        </button>
      </div>

      <!-- Champ email -->
      <div class="form-group" style="margin-top:20px">
        <label class="form-label">Adresse email</label>
        <input class="form-input" type="email" id="auth-email"
          placeholder="votre@email.com"
          autocomplete="${isLogin ? 'email' : 'username'}"
          inputmode="email">
      </div>

      <!-- Champ mot de passe -->
      <div class="form-group">
        <label class="form-label">Mot de passe</label>
        <div style="position:relative">
          <input class="form-input" type="password" id="auth-password"
            placeholder="${isLogin ? '••••••••' : 'Au moins 6 caractères'}"
            autocomplete="${isLogin ? 'current-password' : 'new-password'}"
            style="padding-right:44px">
          <button onclick="togglePwd()" tabindex="-1"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:18px;color:#aaa;padding:4px"
            id="pwd-eye">👁</button>
        </div>
      </div>

      <!-- Confirmation mot de passe (inscription seulement) -->
      ${!isLogin ? `
      <div class="form-group" id="confirm-group">
        <label class="form-label">Confirmer le mot de passe</label>
        <div style="position:relative">
          <input class="form-input" type="password" id="auth-confirm"
            placeholder="Répétez le mot de passe"
            autocomplete="new-password"
            style="padding-right:44px">
          <button onclick="toggleConfirm()" tabindex="-1"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:18px;color:#aaa;padding:4px"
            id="confirm-eye">👁</button>
        </div>
      </div>` : ''}

      <!-- Erreur / succès -->
      <div id="auth-error"
        style="display:none;border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:12px">
      </div>

      <!-- Bouton principal -->
      <button class="btn-save" id="auth-btn"
        style="width:100%;min-height:48px;font-size:15px;margin-top:4px"
        onclick="${isLogin ? 'handleLogin()' : 'handleSignup()'}">
        ${isLogin ? 'Se connecter' : 'Créer mon compte'}
      </button>

      <!-- Loader -->
      <div id="auth-loader"
        style="display:none;text-align:center;margin-top:12px;color:#888;font-size:13px">
        <i class="ti ti-loader-2" style="animation:spin .8s linear infinite"></i>
        ${isLogin ? 'Connexion en cours…' : 'Création du compte…'}
      </div>

      <!-- Lien bascule mode -->
      <div style="text-align:center;margin-top:20px;font-size:13px;color:#999">
        ${isLogin
          ? `Pas encore de compte ?
             <button onclick="switchAuthMode('signup')"
               style="background:none;border:none;color:var(--green,#1D9E75);font-weight:500;
                      cursor:pointer;font-size:13px;padding:0;text-decoration:underline">
               Créer un compte
             </button>`
          : `Déjà un compte ?
             <button onclick="switchAuthMode('login')"
               style="background:none;border:none;color:var(--green,#1D9E75);font-weight:500;
                      cursor:pointer;font-size:13px;padding:0;text-decoration:underline">
               Se connecter
             </button>`
        }
      </div>

      <div style="text-align:center;margin-top:12px;font-size:11px;color:#bbb">
        Données chiffrées et synchronisées entre tous vos appareils.
      </div>
    </div>
  </div>

  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-tabs {
      display: flex;
      gap: 0;
      margin-top: 20px;
      border: 1px solid var(--color-border, #e8e4df);
      border-radius: 10px;
      overflow: hidden;
    }
    .auth-tab {
      flex: 1;
      padding: 10px 0;
      background: transparent;
      border: none;
      font-size: 13px;
      font-family: inherit;
      font-weight: 500;
      color: #999;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .auth-tab.active {
      background: var(--green, #1D9E75);
      color: #fff;
    }
    .auth-tab:not(.active):hover {
      background: #f5f4f0;
      color: #333;
    }
  </style>`;

  /* Raccourcis clavier */
  const pwdInput = screen.querySelector('#auth-password');
  const emailInput = screen.querySelector('#auth-email');
  const confirmInput = screen.querySelector('#auth-confirm');

  emailInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') pwdInput?.focus();
  });
  pwdInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (!isLogin && confirmInput) confirmInput.focus();
      else isLogin ? handleLogin() : handleSignup();
    }
  });
  confirmInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });

  /* Focus auto sur l'email */
  setTimeout(() => emailInput?.focus(), 100);
}

/* Bascule entre login et signup */
function switchAuthMode(mode) {
  _authMode = mode;
  const screen = document.getElementById('login-screen');
  if (screen) _renderAuthScreen(screen);
}

/* Affiche un message d'erreur ou de succès */
function _showAuthMsg(msg, type = 'error') {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  if (type === 'error') {
    el.style.background = '#FAECE7';
    el.style.color      = '#993C1D';
    el.style.border     = '1px solid rgba(216,90,48,.25)';
  } else {
    el.style.background = '#E1F5EE';
    el.style.color      = '#0F6E56';
    el.style.border     = '1px solid rgba(29,158,117,.25)';
  }
}

function _setLoading(on) {
  const loader = document.getElementById('auth-loader');
  const btn    = document.getElementById('auth-btn');
  if (loader) loader.style.display = on ? 'block' : 'none';
  if (btn)    btn.disabled = on;
}

/* ---- Connexion ---- */
async function handleLogin() {
  const email    = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;

  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.style.display = 'none';

  if (!email || !password) {
    _showAuthMsg('Remplissez l\'email et le mot de passe.'); return;
  }

  _setLoading(true);
  const result = await authLogin(email, password);
  _setLoading(false);

  if (result.ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadDB();
  } else {
    _showAuthMsg(result.error);
  }
}

/* ---- Inscription ---- */
async function handleSignup() {
  const email    = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const confirm  = document.getElementById('auth-confirm')?.value;

  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.style.display = 'none';

  if (!email || !password || !confirm) {
    _showAuthMsg('Remplissez tous les champs.'); return;
  }
  if (!email.includes('@')) {
    _showAuthMsg('Adresse email invalide.'); return;
  }
  if (password.length < 6) {
    _showAuthMsg('Le mot de passe doit contenir au moins 6 caractères.'); return;
  }
  if (password !== confirm) {
    _showAuthMsg('Les mots de passe ne correspondent pas.'); return;
  }

  _setLoading(true);
  const result = await authSignup(email, password);
  _setLoading(false);

  if (result.ok) {
    if (result.confirmed) {
      /* Session ouverte directement → lancer l'app */
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadDB();
    } else {
      /* Email de confirmation envoyé */
      _showAuthMsg(
        '✉️ Un email de confirmation a été envoyé à ' + email +
        '. Cliquez sur le lien dans l\'email puis revenez vous connecter.',
        'success'
      );
      /* Basculer vers login après 3 s */
      setTimeout(() => switchAuthMode('login'), 4000);
    }
  } else {
    _showAuthMsg(result.error);
  }
}

/* ---- Toggle visibilité mot de passe ---- */
function togglePwd() {
  const inp = document.getElementById('auth-password');
  const eye = document.getElementById('pwd-eye');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     if (eye) eye.textContent = '🙈'; }
  else                         { inp.type = 'password'; if (eye) eye.textContent = '👁'; }
}

function toggleConfirm() {
  const inp = document.getElementById('auth-confirm');
  const eye = document.getElementById('confirm-eye');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     if (eye) eye.textContent = '🙈'; }
  else                         { inp.type = 'password'; if (eye) eye.textContent = '👁'; }
}
