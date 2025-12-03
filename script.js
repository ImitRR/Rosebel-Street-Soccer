/*=====================================================================
  script.js – FULL: AUTO-LOAD FROM GITHUB (CORS-FIXED) + ERROR TOAST
=====================================================================*/

const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('storage')); }
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const byId = id => document.getElementById(id);

const page = document.body.dataset.page;

// ---------------------------------------------------------------------
// GITHUB CONFIG
let GITHUB_TOKEN = localStorage.getItem('ghToken') || '';
let GITHUB_REPO = localStorage.getItem('ghRepo') || '';
let GITHUB_PATH = 'data.json';

// CORS-safe raw URL
function ghRawUrl() {
  if (!GITHUB_REPO) return '';
  const raw = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_PATH}`;
  return `https://corsproxy.io/?${encodeURIComponent(raw)}`;
}

function ghApiUrl() {
  return `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
}

// ---------------------------------------------------------------------
// TOAST NOTIFICATION
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: ${type === 'error' ? '#d32f2f' : '#1a1a1a'};
    color: #fff; padding: 12px 24px; border-radius: 8px;
    font-size: 14px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: fadeIn 0.3s, fadeOut 0.3s 2.7s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(style);

// ---------------------------------------------------------------------
// AUTO-LOAD FROM GITHUB (CORS-FIXED)
async function autoLoadFromGitHub() {
  if (!GITHUB_REPO) return;
  try {
    const res = await fetch(ghRawUrl(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const keys = ['teams', 'players', 'matches', 'bracket'];
    keys.forEach(k => {
      if (data[k] !== undefined) store.set(k, data[k]);
    });
    showToast('Data loaded from GitHub', 'success');
    console.log('Auto-loaded from GitHub:', GITHUB_REPO);
  } catch (e) {
    showToast(`GitHub load failed: ${e.message}`, 'error');
    console.warn('GitHub auto-load failed:', e);
  }
}

// ---------------------------------------------------------------------
// SAVE TO GITHUB
async function saveToGitHub() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return showToast('Set repo & token first', 'error');
  try {
    let sha = null;
    try {
      const current = await fetch(ghApiUrl(), {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      }).then(r => r.json());
      sha = current.sha;
    } catch (e) {}

    const data = {};
    ['teams', 'players', 'matches', 'bracket'].forEach(k => {
      const v = localStorage.getItem(k);
      if (v) data[k] = JSON.parse(v);
    });

    const payload = {
      message: `Update ${new Date().toISOString()}`,
      content: btoa(JSON.stringify(data, null, 2)),
      branch: 'main'
    };
    if (sha) payload.sha = sha;

    const response = await fetch(ghApiUrl(), {
      method: sha ? 'PUT' : 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    showToast('Saved to GitHub!', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

// ---------------------------------------------------------------------
// DATA GETTERS
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

/*=====================================================================
  TEAMS – ADD / EDIT / DELETE
=====================================================================*/
function initTeams() {
  const form = byId('teamForm'), list = byId('teamList');
  const modal = byId('teamModal'), editForm = byId('editTeamForm'), close = byId('closeTeamModal');

  const render = () => {
    const teams = getTeams();
    list.innerHTML = '';
    teams.forEach(t => {
      const el = document.createElement('div');
      el.className = 'team-card';
      el.innerHTML = `
        <div class="team-meta">
          <img src="${t.logo||''}" alt="">
          <div><strong>${t.name}</strong></div>
        </div>
        <div class="actions">
          <button class="btn sm" data-edit="${t.id}">Edit</button>
          <button class="btn sm danger" data-delete="${t.id}">Delete</button>
        </div>`;
      list.appendChild(el);
    });
  };

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = byId('teamName').value.trim();
    const file = byId('teamLogo').files[0];
    if (!name) return;
    const logo = await fileToDataURL(file);
    const teams = getTeams();
    teams.push({ id: uuid(), name, logo });
    setTeams(teams);
    render();
    form.reset();
  });

  list?.addEventListener('click', async e => {
    const editId = e.target.dataset.edit;
    const delId = e.target.dataset.delete;
    if (editId) {
      const t = getTeams().find(x => x.id === editId);
      byId('editTeamId').value = t.id;
      byId('editTeamName').value = t.name;
      modal.style.display = 'flex';
    }
    if (delId) {
      setTeams(getTeams().filter(x => x.id !== delId));
      render();
    }
  });

  close.onclick = () => modal.style.display = 'none';
  editForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = byId('editTeamId').value;
    const name = byId('editTeamName').value.trim();
    const file = byId('editTeamLogo').files[0];
    const logo = file ? await fileToDataURL(file) : getTeams().find(t => t.id === id).logo;
    const teams = getTeams().map(t => t.id === id ? { id, name, logo } : t);
    setTeams(teams);
    modal.style.display = 'none';
    render();
  });

  render();
}

/*=====================================================================
  PLAYERS – ADD / EDIT / DELETE
=====================================================================*/
function initPlayers() {
  const form = byId('playerForm'), list = byId('playersList');
  const teamSel = byId('playerTeam');
  const modal = byId('playerModal'), editForm = byId('editPlayerForm'), close = byId('closePlayerModal');

  const render = () => {
    const teams = getTeams();
    const players = getPlayers();
    if (teamSel) {
      teamSel.innerHTML = '<option value="">Select Team</option>';
      teams.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.name;
        teamSel.appendChild(opt);
      });
    }

    if (!list) return;
    list.innerHTML = '';
    teams.forEach(t => {
      const teamPlayers = players[t.id] || [];
      if (!teamPlayers.length) return;
      const block = document.createElement('div');
      block.className = 'team-block';
      block.innerHTML = `<h3>${t.name}</h3>`;
      const container = document.createElement('div');
      teamPlayers.forEach((p, idx) => {
        const el = document.createElement('div');
        el.className = 'player-card';
        el.innerHTML = `
          <img src="${p.photo||''}" alt="">
          <div class="number">${p.number || ''}</div>
          <div class="info"><strong>${p.name}</strong><br><small>${p.position || ''}</small></div>
          <div class="actions">
            <button class="btn sm" data-edit-team="${t.id}" data-edit-idx="${idx}">Edit</button>
            <button class="btn sm danger" data-del-team="${t.id}" data-del-idx="${idx}">Delete</button>
          </div>`;
        container.appendChild(el);
      });
      block.appendChild(container);
      list.appendChild(block);
    });
  };

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const teamId = byId('playerTeam').value;
    const name = byId('playerName').value.trim();
    const number = byId('playerNumber').value;
    const position = byId('playerPosition').value;
    const file = byId('playerPhoto').files[0];
    if (!teamId || !name) return;
    const photo = await fileToDataURL(file);
    const players = getPlayers();
    if (!players[teamId]) players[teamId] = [];
    players[teamId].push({ name, number, position, photo });
    setPlayers(players);
    render();
    form.reset();
  });

  list?.addEventListener('click', async e => {
    const editTeam = e.target.dataset.editTeam;
    const editIdx = e.target.dataset.editIdx;
    const delTeam = e.target.dataset.delTeam;
    const delIdx = e.target.dataset.delIdx;

    if (editTeam !== undefined && editIdx !== undefined) {
      const p = getPlayers()[editTeam][editIdx];
      byId('editPlayerTeamId').value = editTeam;
      byId('editPlayerIndex').value = editIdx;
      byId('editPlayerName').value = p.name;
      byId('editPlayerNumber').value = p.number || '';
      byId('editPlayerPosition').value = p.position || '';
      modal.style.display = 'flex';
    }
    if (delTeam !== undefined && delIdx !== undefined) {
      const players = getPlayers();
      players[delTeam].splice(delIdx, 1);
      if (players[delTeam].length === 0) delete players[delTeam];
      setPlayers(players);
      render();
    }
  });

  close.onclick = () => modal.style.display = 'none';
  editForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const teamId = byId('editPlayerTeamId').value;
    const idx = byId('editPlayerIndex').value;
    const name = byId('editPlayerName').value.trim();
    const number = byId('editPlayerNumber').value;
    const position = byId('editPlayerPosition').value;
    const file = byId('editPlayerPhoto').files[0];
    const photo = file ? await fileToDataURL(file) : getPlayers()[teamId][idx].photo;
    const players = getPlayers();
    players[teamId][idx] = { name, number, position, photo };
    setPlayers(players);
    modal.style.display = 'none';
    render();
  });

  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  MATCHES – SHOW & EDIT TIME
=====================================================================*/
function initMatches() {
  const genBtn = byId('generatePoolBtn');
  const clearBtn = byId('clearMatchesBtn');
  const matchesDiv = byId('matchesContainer');

  const formatTime = iso => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
  };

  const renderMatches = () => {
    const matches = getMatches();
    matchesDiv.innerHTML = '';
    matches.forEach(m => {
      const h = getTeams().find(t => t.id === m.homeId);
      const a = getTeams().find(t => t.id === m.awayId);
      if (!h || !a) return;

      const el = document.createElement('div');
      el.className = 'match-row';
      el.innerHTML = `
        <div class="team-cell"><img src="${h.logo||''}" alt=""> ${h.name}</div>
        <input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore||0}">
        <span>vs</span>
        <input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore||0}">
        <div class="team-cell"><img src="${a.logo||''}" alt=""> ${a.name}</div>
        <div class="match-time" data-id="${m.id}">${formatTime(m.datetime)}</div>
        <button class="btn sm" data-edit-time="${m.id}">Change Time</button>`;
      matchesDiv.appendChild(el);
    });
  };

  genBtn.onclick = () => {
    const date = byId('compDate').value || '2025-12-15';
    const dur = +byId('matchDuration').value || 10;
    const brk = +byId('breakMinutes').value || 2;
    const teams = getTeams();
    if (teams.length < 2) return alert('Need at least 2 teams');

    const matches = [];
    let start = new Date(`${date}T19:00:00`);
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: uuid(),
          homeId: teams[i].id,
          awayId: teams[j].id,
          datetime: start.toISOString(),
          homeScore: 0,
          awayScore: 0
        });
        start = new Date(start.getTime() + (dur + brk) * 60 * 1000);
      }
    }
    setMatches(matches);
    renderMatches();
  };

  clearBtn.onclick = () => {
    if (confirm('Delete all matches?')) {
      setMatches([]);
      renderMatches();
    }
  };

  matchesDiv.addEventListener('change', e => {
    if (!e.target.classList.contains('score-input')) return;
    const id = e.target.dataset.id;
    const side = e.target.dataset.side;
    const val = +e.target.value || 0;
    const matches = getMatches().map(m => m.id === id ? { ...m, [side + 'Score']: val } : m);
    setMatches(matches);
  });

  matchesDiv.addEventListener('click', e => {
    const editTimeId = e.target.dataset.editTime;
    if (editTimeId) {
      const m = getMatches().find(x => x.id === editTimeId);
      const d = new Date(m.datetime);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toTimeString().slice(0, 5);

      const newDate = prompt('New date (YYYY-MM-DD):', dateStr);
      const newTime = prompt('New time (HH:MM):51', timeStr);
      if (newDate && newTime) {
        const newDatetime = `${newDate}T${newTime}:00`;
        const matches = getMatches().map(m => m.id === editTimeId ? { ...m, datetime: newDatetime } : m);
        setMatches(matches);
        renderMatches();
      }
    }
  });

  renderMatches();
}

/*=====================================================================
  STANDINGS
=====================================================================*/
function initStandings() {
  const container = byId('standingsContainer');
  const render = () => {
    const matches = getMatches();
    const teams = getTeams();
    if (teams.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;">No teams yet.</p>';
      return;
    }

    const stats = {};
    teams.forEach(t => stats[t.id] = { teamId: t.id, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, gd: 0 });

    matches.forEach(m => {
      const h = stats[m.homeId], a = stats[m.awayId];
      if (!h || !a) return;
      h.mp++; a.mp++;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore) { h.w++; a.l++; h.pts += 3; }
      else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
    });

    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);

    const sorted = Object.values(stats).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    const table = document.createElement('div');
    table.className = 'standings-grid';
    const header = document.createElement('div');
    header.className = 'grid-header';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '30px 1fr 30px 30px 30px 30px 30px 30px 30px 30px';
    header.style.gap = '6px';
    header.innerHTML = `<div>#</div><div>Team</div><div>MP</div><div>W</div><div>D</div><div>L</div><div>GF</div><div>GA</div><div>GD</div><div>Pts</div>`;
    table.appendChild(header);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '30px 1fr 30px 30px 30px 30px 30px 30px 30px 30px';
    grid.style.gap = '6px';
    grid.style.alignItems = 'center';
    grid.style.fontSize = '0.9rem';
    sorted.forEach((s, i) => {
      const t = teams.find(x => x.id === s.teamId);
      grid.innerHTML += `
        <div>${i + 1}</div>
        <div class="team-cell"><img src="${t.logo||''}" alt=""> ${t.name}</div>
        <div>${s.mp}</div><div>${s.w}</div><div>${s.d}</div><div>${s.l}</div>
        <div>${s.gf}</div><div>${s.ga}</div><div>${s.gd}</div><div>${s.pts}</div>`;
    });
    table.appendChild(grid);
    container.innerHTML = '';
    container.appendChild(table);
  };

  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  KNOCKOUT – HEADERS + ALIGNMENT
=====================================================================*/
function initKnockout() {
  const genBtn = byId('generateBracketBtn');
  const resetBtn = byId('resetBracketBtn');
  const container = byId('bracketContainer');

  const roundNames = ['Quarter-Finals', 'Semi-Finals', 'Final'];

  const updateFinalTeams = () => {
    const b = getBracket();
    if (!b.rounds.length) return;
    const final = b.rounds[b.rounds.length - 1][0];
    const semis = b.rounds[b.rounds.length - 2];
    if (!semis || semis.length < 2) return;

    const w1 = semis[0].homeScore > semis[0].awayScore ? semis[0].homeId : semis[0].awayId;
    const w2 = semis[1].homeScore > semis[1].awayScore ? semis[1].homeId : semis[1].awayId;

    if (w1 && w2 && (1 !== w1 || final.awayId !== w2)) {
      final.homeId = w1;
      final.awayId = w2;
      final.homeScore = 0;
      final.awayScore = 0;
      setBracket(b);
      render();
    }
  };

  const render = () => {
    const { rounds } = getBracket();
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
        .bracket-wrapper { width: 100%; overflow-x: auto; padding: 20px 0; }
        .bracket-svg { width: 100%; max-width: ${width}px; height: auto; display: block; margin: 0 auto; }
        .round-header { font-weight: bold; fill: #ffd700; font-size: 18px; text-anchor: middle; }
        .score-input { width: 40px; height: 32px; text-align: center; font-weight: bold; border: 1px solid #ffd700; border-radius: 4px; background: #111; color: #fff; }
      </style>
      <div class="bracket-wrapper">
        <svg class="bracket-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    `;

    const startX = 140, startY = 100, roundGap = 340, vGap = 140;

    rounds.forEach((round, rIdx) => {
      const x = startX + rIdx * roundGap;
      const headerY = startY - 40;
      const headerText = roundNames[rIdx] || `Round ${rIdx + 1}`;
      html += `<text x="${x + 140}" y="${headerY}" class="round-header">${headerText}</text>`;

      round.forEach((m, i) => {
        const y = startY + i * vGap;
        const home = getTeams().find(t => t.id === m.homeId) || { name: 'TBD', logo: '' };
        const away = getTeams().find(t => t.id === m.awayId) || { name: 'TBD', logo: '' };

        html += `<g class="match">`;
        html += `<rect x="${x}" y="${y}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>`;
        html += `<image href="${home.logo||''}" x="${x+12}" y="${y+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>`;
        html += `<text x="${x+65}" y="${y+38}" fill="#fff" font-size="16" font-weight="bold">${home.name}</text>`;
        html += `<foreignObject x="${x+225}" y="${y+14}" width="44" height="32">
                   <input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore||0}"/>
                 </foreignObject>`;

        const ay = y + 70;
        html += `<rect x="${x}" y="${ay}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>`;
        html += `<image href="${away.logo||''}" x="${x+12}" y="${ay+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>`;
        html += `<text x="${x+65}" y="${ay+38}" fill="#fff" font-size="16" font-weight="bold">${away.name}</text>`;
        html += `<foreignObject x="${x+225}" y="${ay+14}" width="44" height="32">
                   <input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore||0}"/>
                 </foreignObject>`;

        if (rIdx < rounds.length - 1) {
          const nextX = x + roundGap;
          const midY = y + 65;
          html += `<path d="M${x+280} ${midY} H${nextX-20}" stroke="#ffd700" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
        }
        html += `</g>`;
      });
    });

    html += `<defs>
               <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                 <path d="M0,0 L0,6 L9,3 z" fill="#ffd700"/>
               </marker>
             </defs>`;
    html += `</svg></div>`;

    container.innerHTML = html;

    container.querySelectorAll('.score-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const side = e.target.dataset.side;
        const val = +e.target.value || 0;
        const b = getBracket();
        b.rounds.forEach(r => r.forEach(m => {
          if (m.id === id) m[side + 'Score'] = val;
        }));
        setBracket(b);
        updateFinalTeams();
      });
    });
  };

  genBtn.onclick = () => {
    const matches = getMatches();
    const teams = getTeams();
    if (teams.length < 2) return alert('Need at least 2 teams');

    const stats = {};
    teams.forEach(t => stats[t.id] = { id: t.id, pts: 0, gd: 0, gf: 0, ga: 0 });
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

    const ranked = teams
      .map(t => ({ ...stats[t.id], name: t.name, logo: t.logo }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    let size = 2;
    while (size < ranked.length && size < 16) size *= 2;
    const top = ranked.slice(0, size);

    const rounds = [];
    let cur = top.map(t => ({ id: t.id }));
    while (cur.length > 1) {
      const round = [];
      for (let i = 0; i < cur.length; i += 2) {
        if (i + 1 < cur.length) {
          round.push({ id: uuid(), homeId: cur[i].id, awayId: cur[i + 1].id, homeScore: 0, awayScore: 0 });
        }
      }
      rounds.push(round);
      cur = round.map(() => ({ id: null }));
    }
    setBracket({ rounds });
    render();
  };

  resetBtn.onclick = () => { setBracket({ rounds: [] }); render(); };
  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  DASHBOARD
=====================================================================*/
function initDashboard() {
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

  const ghSection = document.createElement('section');
  ghSection.className = 'card';
  ghSection.innerHTML = `
    <h2>GitHub Live Sync (Admin)</h2>
    <div class="grid grid-3">
      <div><label>Repo</label><input id="ghRepo" value="${GITHUB_REPO}" placeholder="user/repo"></div>
      <div><label>Token</label><input id="ghToken" type="password" value="${GITHUB_TOKEN}" placeholder="ghp_..."></div>
      <div class="full actions" style="margin-top:1rem;">
        <button class="btn sm primary" id="ghSave">Save to GitHub</button>
        <button class="btn sm" id="ghClear">Clear</button>
      </div>
    </div>
    <p style="font-size:0.8rem; margin-top:0.5rem; color:#aaa;">
      Data auto-loads on every page. Token needed to save.
    </p>`;
  document.querySelector('main.container').appendChild(ghSection);

  byId('ghSave').onclick = () => {
    const repo = byId('ghRepo').value.trim();
    const token = byId('ghToken').value.trim();
    if (!repo) return showToast('Enter repo', 'error');
    localStorage.setItem('ghRepo', repo);
    localStorage.setItem('ghToken', token);
    GITHUB_REPO = repo;
    GITHUB_TOKEN = token;
    saveToGitHub();
  };

  byId('ghClear').onclick = () => {
    localStorage.removeItem('ghRepo');
    localStorage.removeItem('ghToken');
    GITHUB_REPO = '';
    GITHUB_TOKEN = '';
    byId('ghRepo').value = '';
    byId('ghToken').value = '';
    showToast('GitHub config cleared', 'info');
  };
}

/*=====================================================================
  BOOT
=====================================================================*/
document.addEventListener('DOMContentLoaded', () => {
  autoLoadFromGitHub().then(() => {
    switch (page) {
      case 'teams': initTeams(); break;
      case 'players': initPlayers(); break;
      case 'matches': initMatches(); break;
      case 'standings': initStandings(); break;
      case 'knockout': initKnockout(); break;
      default: initDashboard(); break;
    }
  });
});