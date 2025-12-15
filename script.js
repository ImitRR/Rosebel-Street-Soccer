/*=====================================================================
  script.js – MULTI-PAGE + GITHUB AUTO-LOAD + TOAST + ALL FEATURES
=====================================================================*/

const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('storage')); }
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const byId = id => document.getElementById(id);               // defined once, used everywhere

const page = document.body.dataset.page;

// ---------------------------------------------------------------------
// GITHUB CONFIG - AUTO-LOAD TOKEN/REPO (SECURITY: REMOVE HARDCODE AFTER FIRST USE)
let GITHUB_TOKEN = localStorage.getItem('ghToken') || '';
let GITHUB_REPO  = localStorage.getItem('ghRepo')  || '';
const GITHUB_PATH = 'data.json';

function initGitHubConfig() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    // HARDCODED FOR YOUR SETUP - REMOVE THIS BLOCK AFTER FIRST LOAD FOR SECURITY
    localStorage.setItem('ghToken', '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');
    localStorage.setItem('ghRepo', 'imitrr/Rosebel-Street-Soccer');
    GITHUB_TOKEN = localStorage.getItem('ghToken');
    GITHUB_REPO = localStorage.getItem('ghRepo');
    toast('GitHub token & repo auto-set. Refresh page to load data. (Remove hardcode from code for security!)', 'info');
    return true; // Set flag to reload
  }
  return false;
}

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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    ['teams','players','matches','bracket'].forEach(k => {
      if (data[k] !== undefined) store.set(k, data[k]);
    });
    toast('Data loaded from GitHub', 'success');
  } catch (e) {
    toast(`GitHub load failed: ${e.message}. Check token/repo.`, 'error');
    console.warn('GitHub auto-load error:', e);
  }
}

// ---------------------------------------------------------------------
// SAVE TO GITHUB
async function saveToGitHub() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return toast('Set repo & token first (use Settings button)', 'error');
  if (!confirm('Save all data to GitHub? This overwrites data.json.')) return;
  try {
    let sha = null;
    try {
      const cur = await fetch(ghApiUrl(), { 
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'Rosebel-Street-Soccer-App' } 
      }).then(r => r.json());
      sha = cur.sha;
    } catch {}

    const payload = {
      message: `Update ${new Date().toISOString()}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify({
        teams:   store.get('teams', []),
        players: store.get('players', {}),
        matches: store.get('matches', []),
        bracket: store.get('bracket', {rounds:[]})
      }, null, 2)))),
      branch: 'main'
    };
    if (sha) payload.sha = sha;

    const res = await fetch(ghApiUrl(), {
      method: sha ? 'PUT' : 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Rosebel-Street-Soccer-App'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) throw new Error('Invalid token - regenerate with "contents" scope');
      if (res.status === 403) throw new Error('Token lacks repo write access');
      throw new Error(`Save failed ${res.status}: ${err}`);
    }
    toast('Saved to GitHub!', 'success');
  } catch (e) {
    toast('Save error: ' + e.message, 'error');
    console.error('GitHub save error:', e);
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
const getBracket = () => store.get('bracket', {rounds:[]});
const setBracket = v  => store.set('bracket', v);

const fileToDataURL = file => new Promise(res => {
  if (!file) return res('');
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(file);
});

// ---------------------------------------------------------------------
// SETTINGS MODAL FOR GITHUB (NEW: USER INPUT FOR TOKEN/REPO)
function createSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'ghSettingsModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>GitHub Settings</h3>
      <form id="ghSettingsForm" class="grid grid-2">
        <div>
          <label for="ghRepoInput">Repository (owner/repo)</label>
          <input id="ghRepoInput" value="${GITHUB_REPO}" placeholder="e.g., imitrr/Rosebel-Street-Soccer" required>
        </div>
        <div>
          <label for="ghTokenInput">Personal Access Token</label>
          <input id="ghTokenInput" type="password" value="${GITHUB_TOKEN ? '********' : ''}" placeholder="ghp_..." required>
        </div>
        <div class="full actions">
          <button type="button" class="btn sm" id="closeSettingsModal">Cancel</button>
          <button type="submit" class="btn sm primary">Save & Test</button>
        </div>
      </form>
      <p style="font-size:0.8rem;color:#aaa;">Tip: Use fine-grained token with 'Contents: Write' for this repo only.</p>
    </div>
  `;
  document.body.appendChild(modal);

  const form = byId('ghSettingsForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const repo = byId('ghRepoInput').value.trim();
    const token = byId('ghTokenInput').value.trim();
    if (!repo || !token) return toast('Fill both fields', 'error');
    localStorage.setItem('ghRepo', repo);
    localStorage.setItem('ghToken', token);
    GITHUB_REPO = repo; GITHUB_TOKEN = token;
    closeSettingsModal();
    await autoLoadFromGitHub(); // Test load
    if (GITHUB_TOKEN) await saveToGitHub(); // Test save if data exists
  };

  byId('closeSettingsModal').onclick = closeSettingsModal;
  modal.onclick = (e) => { if (e.target === modal) closeSettingsModal(); };

  function closeSettingsModal() { modal.style.display = 'none'; }
  return { open: () => modal.style.display = 'flex', close: closeSettingsModal };
}

// ---------------------------------------------------------------------
// AUTO-SAVE TOGGLE (BEST PRACTICE: DEBOUNCED)
let autoSaveEnabled = localStorage.getItem('autoSaveGh') === 'true';
function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  localStorage.setItem('autoSaveGh', autoSaveEnabled);
  toast(`Auto-save to GitHub: ${autoSaveEnabled ? 'Enabled' : 'Disabled'}`, 'info');
}
window.addEventListener('storage', () => { if (autoSaveEnabled) setTimeout(saveToGitHub, 2000); }); // Debounce 2s

/*=====================================================================
  DASHBOARD – STATS + BACKUP/RESTORE + GITHUB SYNC
=====================================================================*/
if (page === 'dashboard') {
  // ---- stats ----
  const updateStats = () => {
    const teams = getTeams().length;
    const playersObj = getPlayers();
    const players = Object.values(playersObj).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
    const matches = getMatches().length;
    byId('statTeams').textContent = teams;
    byId('statPlayers').textContent = players;
    byId('statMatches').textContent = matches;
  };
  updateStats();
  window.addEventListener('storage', updateStats);

  // ---- github settings button ----
  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = 'GitHub Settings';
  settingsBtn.className = 'btn sm primary';
  settingsBtn.onclick = () => settingsModal.open();
  const settingsDiv = document.createElement('div');
  settingsDiv.appendChild(settingsBtn);
  settingsDiv.innerHTML += `<button class="btn sm" onclick="toggleAutoSave()">Toggle Auto-Save</button>`;
  byId('importFileName').parentNode.appendChild(settingsDiv); // Add to import section

  // ---- save button ----
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save to GitHub';
  saveBtn.className = 'btn sm primary';
  saveBtn.onclick = saveToGitHub;
  byId('exportBtn').parentNode.appendChild(saveBtn);

  // ---- original backup/restore ----
  const keys = ['teams','players','matches','bracket'];
  byId('exportBtn').addEventListener('click', () => {
    const data = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if(v) data[k] = JSON.parse(v); });
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rosebel-backup.json'; a.click();
    URL.revokeObjectURL(url);
  });

  byId('importBtn').addEventListener('click', () => byId('importFile').click());
  byId('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    byId('importFileName').textContent = file.name;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        keys.forEach(k => { if (data[k] !== undefined) store.set(k, data[k]); });
        toast('Data restored!', 'success');
        updateStats();
      } catch (err) { toast('Invalid JSON file', 'error'); }
    };
    r.readAsText(file);
  });

  byId('resetAllBtn').addEventListener('click', () => {
    if (confirm('Delete ALL data?')) {
      keys.forEach(k => localStorage.removeItem(k));
      toast('All data reset', 'error');
      updateStats();
    }
  });

  const settingsModal = createSettingsModal();
}

/*=====================================================================
  TEAMS PAGE
=====================================================================*/
if (page === 'teams') {
  const form = byId('teamForm');
  const list = byId('teamList');
  const modal = byId('teamModal');

  function renderTeams() {
    const teams = getTeams();
    list.innerHTML = teams.map(t => `
      <div class="team-card">
        <div style="display:flex;align-items:center;gap:1rem;">
          <img src="${t.logo || ''}" alt="${t.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxOCIgY3k9IjE4IiByPSIxOCIgZmlsbD0iI2ZmZDAwMCIvPjx0ZXh0IHg9IjE4IiB5PSIyMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCIgZm9udC1zaXplPSIxNCI+QTwvdGV4dD48L3N2Zz4='" />
          <span>${t.name}</span>
        </div>
        <div class="actions">
          <button class="btn sm" onclick="editTeam('${t.id}')">Edit</button>
          <button class="btn sm danger" onclick="deleteTeam('${t.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  window.editTeam = id => {
    const teams = getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) return;
    byId('editTeamId').value = id;
    byId('editTeamName').value = team.name;
    byId('editTeamLogo').value = '';
    modal.style.display = 'flex';
  };
  window.deleteTeam = id => {
    if (confirm('Delete team?')) {
      setTeams(getTeams().filter(t => t.id !== id));
      renderTeams();
    }
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const name = byId('teamName').value.trim();
    if (!name) return toast('Name required', 'error');
    const logoFile = byId('teamLogo').files[0];
    const logo = logoFile ? await fileToDataURL(logoFile) : '';
    const teams = getTeams();
    const id = uuid();
    teams.push({ id, name, logo });
    setTeams(teams);
    form.reset();
    renderTeams();
    toast('Team added', 'success');
  };

  const editForm = byId('editTeamForm');
  editForm.onsubmit = async e => {
    e.preventDefault();
    const id = byId('editTeamId').value;
    const name = byId('editTeamName').value.trim();
    if (!name) return;
    const logoFile = byId('editTeamLogo').files[0];
    const logo = logoFile ? await fileToDataURL(logoFile) : getTeams().find(t => t.id === id).logo;
    setTeams(getTeams().map(t => t.id === id ? { ...t, name, logo } : t));
    modal.style.display = 'none';
    renderTeams();
    toast('Team updated', 'success');
  };
  byId('closeTeamModal').onclick = () => modal.style.display = 'none';

  renderTeams();
  window.addEventListener('storage', renderTeams);
}

/*=====================================================================
  PLAYERS PAGE
=====================================================================*/
if (page === 'players') {
  const form = byId('playerForm');
  const list = byId('playersList');
  const modal = byId('playerModal');

  function renderPlayers() {
    const players = getPlayers();
    const teams = getTeams();
    list.innerHTML = Object.entries(players).map(([teamId, ps]) => {
      const team = teams.find(t => t.id === teamId) || { name: 'Unknown' };
      return `
        <div class="team-block">
          <h3>${team.name}</h3>
          ${ps.map(p => `
            <div class="player-card">
              <img src="${p.photo || ''}" alt="${p.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxOCIgY3k9IjE4IiByPSIxOCIgZmlsbD0iI2ZmZDAwMCIvPjx0ZXh0IHg9IjE4IiB5PSIyMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCIgZm9udC1zaXplPSIxNCI+UDwvdGV4dD48L3N2Zz4='" />
              <div class="number">${p.number || ''}</div>
              <div class="info">
                <strong>${p.name}</strong><br>
                <small>${p.position || ''}</small>
              </div>
              <div class="actions">
                <button class="btn sm" onclick="editPlayer('${teamId}', ${ps.indexOf(p)})">Edit</button>
                <button class="btn sm danger" onclick="deletePlayer('${teamId}', ${ps.indexOf(p)})">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
    byId('playerTeam').innerHTML = ['<option value="">— Select Team —</option>'] + getTeams().map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  window.editPlayer = (teamId, idx) => {
    const players = getPlayers();
    const p = players[teamId]?.[idx];
    if (!p) return;
    byId('editPlayerTeamId').value = teamId;
    byId('editPlayerIndex').value = idx;
    byId('editPlayerName').value = p.name;
    byId('editPlayerNumber').value = p.number;
    byId('editPlayerPosition').value = p.position;
    byId('editPlayerPhoto').value = '';
    modal.style.display = 'flex';
  };
  window.deletePlayer = (teamId, idx) => {
    if (confirm('Delete player?')) {
      const players = getPlayers();
      players[teamId].splice(idx, 1);
      if (!players[teamId].length) delete players[teamId];
      setPlayers(players);
      renderPlayers();
    }
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const teamId = byId('playerTeam').value;
    const name = byId('playerName').value.trim();
    if (!teamId || !name) return toast('Team & name required', 'error');
    const number = +byId('playerNumber').value || null;
    const position = byId('playerPosition').value;
    const photoFile = byId('playerPhoto').files[0];
    const photo = photoFile ? await fileToDataURL(photoFile) : '';
    const players = getPlayers();
    if (!players[teamId]) players[teamId] = [];
    players[teamId].push({ name, number, position, photo });
    setPlayers(players);
    form.reset();
    renderPlayers();
    toast('Player added', 'success');
  };

  const editForm = byId('editPlayerForm');
  editForm.onsubmit = async e => {
    e.preventDefault();
    const teamId = byId('editPlayerTeamId').value;
    const idx = +byId('editPlayerIndex').value;
    const name = byId('editPlayerName').value.trim();
    if (!name) return;
    const number = +byId('editPlayerNumber').value || null;
    const position = byId('editPlayerPosition').value;
    const photoFile = byId('editPlayerPhoto').files[0];
    const photo = photoFile ? await fileToDataURL(photoFile) : getPlayers()[teamId][idx].photo;
    const players = getPlayers();
    players[teamId][idx] = { ...players[teamId][idx], name, number, position, photo };
    setPlayers(players);
    modal.style.display = 'none';
    renderPlayers();
    toast('Player updated', 'success');
  };
  byId('closePlayerModal').onclick = () => modal.style.display = 'none';

  renderPlayers();
  window.addEventListener('storage', renderPlayers);
}

/*=====================================================================
  MATCHES PAGE
=====================================================================*/
if (page === 'matches') {
  const container = byId('matchesContainer');
  const modal = byId('matchModal');

  const roundNames = {0:'Round 1', 1:'Round 2'}; // Extend as needed

  function renderMatches() {
    const matches = getMatches();
    container.innerHTML = matches.map(m => {
      const home = getTeams().find(t => t.id === m.homeId) || {name:'TBD', logo:''};
      const away = getTeams().find(t => t.id === m.awayId) || {name:'TBD', logo:''};
      return `
        <div class="match-row">
          <img src="${home.logo || ''}" alt="${home.name}" onerror="this.src='data:image/svg+xml;base64,...'" />
          <span>${home.name}</span>
          <input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore || 0}" min="0" type="number">
          <span>vs</span>
          <span>${away.name}</span>
          <img src="${away.logo || ''}" alt="${away.name}" onerror="this.src='data:image/svg+xml;base64,...'" />
          <input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore || 0}" min="0" type="number">
          <button class="btn sm" data-edit="${m.id}">Edit</button>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.score-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const side = e.target.dataset.side;
        const val = Math.max(0, +e.target.value || 0); // Fix NaN
        setMatches(getMatches().map(mm => mm.id === id ? {...mm, [side+'Score']: val} : mm));
      });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => editMatch(e.target.dataset.edit));
    });
  }

  window.editMatch = id => {
    const m = getMatches().find(mm => mm.id === id);
    if (!m) return;
    byId('editMatchId').value = id;
    byId('editMatchDate').value = m.date || '2025-12-15';
    byId('editMatchTime').value = m.time || '19:00';
    modal.style.display = 'flex';
  };

  const editForm = byId('editMatchForm');
  editForm.onsubmit = e => {
    e.preventDefault();
    const id = byId('editMatchId').value;
    const date = byId('editMatchDate').value;
    const time = byId('editMatchTime').value;
    setMatches(getMatches().map(m => m.id === id ? {...m, date, time} : m));
    modal.style.display = 'none';
    renderMatches();
  };
  byId('closeMatchModal').onclick = () => modal.style.display = 'none';

  byId('generatePoolBtn').onclick = () => {
    const date = byId('compDate').value;
    const kickoff = byId('firstKickoff').value;
    const duration = +byId('matchDuration').value;
    const brk = +byId('breakMinutes').value;
    const teams = getTeams();
    if (teams.length < 2) return toast('Need 2+ teams', 'error');
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const time = new Date(date + 'T' + kickoff);
        time.setMinutes(time.getMinutes() + (matches.length * (duration + brk)));
        matches.push({
          id: uuid(),
          homeId: teams[i].id, awayId: teams[j].id,
          date, time: time.toTimeString().slice(0,5),
          homeScore: 0, awayScore: 0
        });
      }
    }
    setMatches(matches);
    renderMatches();
    toast(`${matches.length} matches generated`, 'success');
  };

  byId('clearMatchesBtn').onclick = () => {
    if (confirm('Clear all matches?')) {
      setMatches([]);
      renderMatches();
    }
  };

  renderMatches();
  window.addEventListener('storage', renderMatches);
}

/*=====================================================================
  STANDINGS PAGE
=====================================================================*/
if (page === 'standings') {
  const container = byId('standingsContainer');

  function renderStandings() {
    const teams = getTeams();
    const matches = getMatches();
    const stats = {};
    teams.forEach(t => stats[t.id] = {pts:0, gd:0, gf:0, ga:0});
    matches.forEach(m => {
      const h = stats[m.homeId], a = stats[m.awayId];
      if (!h || !a) return;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore) h.pts += 3;
      else if (m.homeScore < m.awayScore) a.pts += 3;
      else { h.pts += 1; a.pts += 1; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    const ranked = teams.map(t => ({...stats[t.id], ...t})).sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    container.innerHTML = `
      <div class="standings-grid">
        <div class="grid-header"><span>Team</span><span>PTS</span><span>GD</span><span>GF</span><span>GA</span></div>
        ${ranked.map(t => `
          <div>
            <div class="team-cell">
              <img src="${t.logo || ''}" alt="${t.name}" onerror="this.src='data:image/svg+xml;base64,...'" />
              <span>${t.name}</span>
            </div>
            <span>${t.pts}</span><span>${t.gd}</span><span>${t.gf}</span><span>${t.ga}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderStandings();
  window.addEventListener('storage', renderStandings);
}

/*=====================================================================
  KNOCKOUT PAGE
=====================================================================*/
if (page === 'knockout') {
  const container = byId('bracketContainer');
  const genBtn = byId('generateBracketBtn');
  const resetBtn = byId('resetBracketBtn');

  function updateFinal() {
    const b = getBracket();
    if (!b.rounds.length) return;
    const final = b.rounds[b.rounds.length-1][0];
    const semis = b.rounds[b.rounds.length-2];
    if (!semis || semis.length < 2) return;
    const w1 = semis[0].homeScore > semis[0].awayScore ? semis[0].homeId : semis[0].awayId;
    const w2 = semis[1].homeScore > semis[1].awayScore ? semis[1].homeId : semis[1].awayId;
    if (w1 && w2 && (final.homeId !== w1 || final.awayId !== w2)) {
      final.homeId = w1; final.awayId = w2; final.homeScore = 0; final.awayScore = 0;
      setBracket(b); render();
    }
  }

  const render = () => {
    const {rounds} = getBracket();
    if (!rounds.length) { 
      container.innerHTML = '<p style="text-align:center;color:#aaa;">Generate bracket from standings.</p>'; 
      return; 
    }

    const teamCount = rounds[0].length * 2;
    const roundCount = rounds.length;
    const width = 320 + roundCount * 340;
    const height = Math.max(700, teamCount * 90 + 100);

    let html = `
      <style>
        .bracket-wrapper {width:100%;overflow-x:auto;padding:20px 0;}
        .bracket-svg {width:100%;max-width:${width}px;height:auto;display:block;margin:0 auto;}
        .round-header {font-weight:bold;fill:#ffd700;font-size:18px;text-anchor:middle;}
        .score-input {width:40px;height:32px;text-align:center;font-weight:bold;border:1px solid #ffd700;border-radius:4px;background:#111;color:#fff;}
      </style>
      <div class="bracket-wrapper">
        <svg class="bracket-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    `;

    const sx = 140, sy = 100, rg = 340, vg = 140;
    rounds.forEach((r, ri) => {
      const x = sx + ri * rg;
      html += `<text x="${x+140}" y="${sy-40}" class="round-header">${roundNames[ri] || 'Round ' + (ri + 1)}</text>`;
      r.forEach((m, i) => {
        const y = sy + i * vg;
        const home = getTeams().find(t => t.id === m.homeId) || {name: 'TBD', logo: ''};
        const away = getTeams().find(t => t.id === m.awayId) || {name: 'TBD', logo: ''};

        html += `<g class="match">
          <rect x="${x}" y="${y}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>
          <image href="${home.logo || ''}" x="${x+12}" y="${y+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>
          <text x="${x+65}" y="${y+38}" fill="#fff" font-size="16" font-weight="bold">${home.name}</text>
          <foreignObject x="${x+225}" y="${y+14}" width="44" height="32">
            <input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore || 0}" type="number" min="0"/>
          </foreignObject>`;

        const ay = y + 70;
        html += `<rect x="${x}" y="${ay}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>
          <image href="${away.logo || ''}" x="${x+12}" y="${ay+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>
          <text x="${x+65}" y="${ay+38}" fill="#fff" font-size="16" font-weight="bold">${away.name}</text>
          <foreignObject x="${x+225}" y="${ay+14}" width="44" height="32">
            <input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore || 0}" type="number" min="0"/>
          </foreignObject>`;

        if (ri < rounds.length - 1) {
          const nx = x + rg;
          const my = y + 65;
          html += `<path d="M${x+280} ${my} H${nx-20}" stroke="#ffd700" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
        }
        html += `</g>`;
      });
    });

    html += `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#ffd700"/></marker></defs></svg></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.score-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const side = e.target.dataset.side;
        const val = Math.max(0, +e.target.value || 0);
        const b = getBracket();
        b.rounds.forEach(r => r.forEach(m => {
          if (m.id === id) m[side + 'Score'] = val;
        }));
        setBracket(b);
        updateFinal();
      });
    });
  };

  genBtn.onclick = () => {
    const matches = getMatches();
    const teams = getTeams();
    if (teams.length < 2) return toast('Need 2+ teams', 'error');

    const stats = {};
    teams.forEach(t => stats[t.id] = {pts: 0, gd: 0, gf: 0, ga: 0});
    matches.forEach(m => {
      const h = stats[m.homeId], a = stats[m.awayId];
      if (!h || !a) return;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore) h.pts += 3;
      else if (m.homeScore < m.awayScore) a.pts += 3;
      else { h.pts += 1; a.pts += 1; }
    });
    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    const ranked = teams.map(t => ({...stats[t.id], name: t.name, logo: t.logo}))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    let size = 2; while (size < ranked.length && size < 16) size *= 2;
    const top = ranked.slice(0, size);

    const rounds = [];
    let cur = top.map(t => ({id: t.id}));
    while (cur.length > 1) {
      const r = [];
      for (let i = 0; i < cur.length; i += 2) {
        if (i + 1 < cur.length) r.push({id: uuid(), homeId: cur[i].id, awayId: cur[i + 1].id, homeScore: 0, awayScore: 0});
      }
      rounds.push(r);
      cur = r.map(() => ({id: null}));
    }
    setBracket({rounds});
    render();
    toast('Bracket generated', 'success');
  };

  resetBtn.onclick = () => { 
    setBracket({rounds: []}); 
    render(); 
  };

  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  BOOT – run auto-load on every page
=====================================================================*/
document.addEventListener('DOMContentLoaded', () => {
  const needsReload = initGitHubConfig();
  autoLoadFromGitHub();   // runs on EVERY page
  if (needsReload) location.reload(); // Refresh after setting config
});