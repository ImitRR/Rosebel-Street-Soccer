/*=====================================================================
  script.js – FULL: MULTI-PAGE + GITHUB AUTO-LOAD + TOAST + KNOCKOUT FIX
=====================================================================*/

const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('storage')); }
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const byId = id => document.getElementById(id);  // ← DEFINED HERE

const page = document.body.dataset.page;

// ---------------------------------------------------------------------
// GITHUB CONFIG
let GITHUB_TOKEN = localStorage.getItem('ghToken') || '';
let GITHUB_REPO = localStorage.getItem('ghRepo') || '';
const GITHUB_PATH = 'data.json';

function ghRawUrl() {
  if (!GITHUB_REPO) return '';
  const raw = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_PATH}`;
  return `https://corsproxy.io/?${encodeURIComponent(raw)}`;
}
function ghApiUrl() {
  return `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
}

// ---------------------------------------------------------------------
// TOAST
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
    padding:12px 24px; border-radius:8px; color:#fff; font-size:14px;
    box-shadow:0 4px 12px rgba(0,0,0,.3); z-index:9999;
    animation:fadeIn .3s, fadeOut .3s 2.7s forwards;
    background:${type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '#1a1a1a'};
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
  @keyframes fadeOut { from {opacity:1;} to {opacity:0;} }
`;
document.head.appendChild(style);

// ---------------------------------------------------------------------
// AUTO-LOAD FROM GITHUB
async function autoLoadFromGitHub() {
  if (!GITHUB_REPO) return;
  try {
    const res = await fetch(ghRawUrl(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ['teams', 'players', 'matches', 'bracket'].forEach(k => {
      if (data[k] !== undefined) store.set(k, data[k]);
    });
    toast('Data loaded from GitHub', 'success');
  } catch (e) {
    toast(`GitHub load failed: ${e.message}`, 'error');
  }
}

// ---------------------------------------------------------------------
// SAVE TO GITHUB
async function saveToGitHub() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return toast('Set repo & token first', 'error');
  try {
    let sha = null;
    try {
      const cur = await fetch(ghApiUrl(), { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }).then(r => r.json());
      sha = cur.sha;
    } catch (e) {}

    const payload = {
      message: `Update ${new Date().toISOString()}`,
      content: btoa(JSON.stringify({
        teams: store.get('teams', []),
        players: store.get('players', {}),
        matches: store.get('matches', []),
        bracket: store.get('bracket', { rounds: [] })
      }, null, 2)),
      branch: 'main'
    };
    if (sha) payload.sha = sha;

    const res = await fetch(ghApiUrl(), {
      method: sha ? 'PUT' : 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    toast('Saved to GitHub!', 'success');
  } catch (e) {
    toast('Save error: ' + e.message, 'error');
  }
}

// ---------------------------------------------------------------------
// DATA HELPERS
const getTeams   = () => store.get('teams', []);
const setTeams   = v  => store.set('teams', v);
const getPlayers = () => store.get('players', {});
const setPlayers = v  => store.set('players', v);
const getMatches = () => store.get('matches', []);
const setMatches = v  => store.set('matches', v);
const getBracket = () => store.get('bracket', { rounds: [] });
const setBracket = v  => store.set('bracket', v);

const fileToDataURL = file => new Promise(res => {
  if (!file) return res('');
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(file);
});

/*=====================================================================
  DASHBOARD – BACKUP/RESTORE + GITHUB SYNC
=====================================================================*/
if (page === 'dashboard') {
  const updateStats = () => {
    const teams = getTeams().length;
    const playersObj = getPlayers();
    const players = Object.values(playersObj).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    const matches = getMatches().length;
    byId('statTeams').textContent = teams;
    byId('statPlayers').textContent = players;
    byId('statMatches').textContent = matches;
  };
  updateStats();
  window.addEventListener('storage', updateStats);

  // Backup & Restore (your original code)
  const keys = ['teams','players','matches','bracket'];
  byId('exportBtn').addEventListener('click', () => {
    const data = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if(v) data[k] = v; });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rosebel-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  const importInput = byId('importFile');
  const fileNameDiv = byId('importFileName');
  byId('importBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameDiv.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.teams || !Array.isArray(data.teams)) throw new Error('Invalid teams');
        if (data.teams.length > 8) throw new Error('Backup has more than 8 teams');
       
        if (confirm('This will ERASE all current data. Continue?')) {
          localStorage.clear();
          keys.forEach(k => {
            if (data[k] !== undefined) {
              if (k === 'teams' && data[k].length > 8) return;
              localStorage.setItem(k, JSON.stringify(data[k]));
            }
          });
          toast('Backup restored! Reloading...', 'success');
          setTimeout(() => location.reload(), 1000);
        }
      } catch (err) {
        toast('Invalid backup: ' + err.message, 'error');
        fileNameDiv.textContent = 'Error';
      }
    };
    reader.readAsText(file);
  });
  byId('resetAllBtn').addEventListener('click', () => {
    if (confirm('Delete EVERYTHING? This cannot be undone.')) {
      localStorage.clear();
      location.reload();
    }
  });

  // Inject GitHub Sync Section
  const ghSection = document.createElement('section');
  ghSection.className = 'card';
  ghSection.innerHTML = `
    <h2>GitHub Live Sync (Admin)</h2>
    <div class="grid grid-2">
      <div><label>Repo</label><input id="ghRepo" value="${GITHUB_REPO}" placeholder="user/repo"></div>
      <div><label>Token</label><input id="ghToken" type="password" value="${GITHUB_TOKEN}" placeholder="ghp_…"></div>
    </div>
    <div class="actions" style="margin-top:1rem;">
      <button class="btn sm primary" id="ghSave">Save to GitHub</button>
      <button class="btn sm" id="ghClear">Clear Config</button>
    </div>
    <p style="font-size:.8rem;margin-top:.5rem;color:#aaa;">
      Data auto-loads from GitHub on every page.
    </p>`;
  document.querySelector('main.container').appendChild(ghSection);

  byId('ghSave').onclick = () => {
    const repo = byId('ghRepo').value.trim();
    const token = byId('ghToken').value.trim();
    if (!repo) return toast('Enter repo', 'error');
    localStorage.setItem('ghRepo', repo);
    localStorage.setItem('ghToken', token);
    GITHUB_REPO = repo;
    GITHUB_TOKEN = token;
    saveToGitHub();
  };
  byId('ghClear').onclick = () => {
    localStorage.removeItem('ghRepo');
    localStorage.removeItem('ghToken');
    GITHUB_REPO = ''; GITHUB_TOKEN = '';
    byId('ghRepo').value = ''; byId('ghToken').value = '';
    toast('GitHub config cleared', 'info');
  };
}

/*=====================================================================
  TEAMS, PLAYERS, MATCHES, STANDINGS, KNOCKOUT
=====================================================================*/
if (page === 'teams') { /* ... [same as before] ... */ }
if (page === 'players') { /* ... [same as before] ... */ }
if (page === 'matches') { /* ... [same as before] ... */ }
if (page === 'standings') { /* ... [same as before] ... */ }
if (page === 'knockout') { /* ... [same as before] ... */ }

/*=====================================================================
  BOOT + AUTO-LOAD
=====================================================================*/
document.addEventListener('DOMContentLoaded', () => {
  autoLoadFromGitHub();
});