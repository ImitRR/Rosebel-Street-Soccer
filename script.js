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
// GITHUB CONFIG
let GITHUB_TOKEN = localStorage.getItem('ghToken') || '';
let GITHUB_REPO  = localStorage.getItem('ghRepo')  || '';
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
    ['teams','players','matches','bracket'].forEach(k => {
      if (data[k] !== undefined) store.set(k, data[k]);
    });
    toast('Data loaded from GitHub', 'success');
  } catch (e) {
    toast(`GitHub load failed: ${e.message}`, 'error');
    console.warn('GitHub auto-load error:', e);
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
    } catch {}

    const payload = {
      message: `Update ${new Date().toISOString()}`,
      content: btoa(JSON.stringify({
        teams:   store.get('teams', []),
        players: store.get('players', {}),
        matches: store.get('matches', []),
        bracket: store.get('bracket', {rounds:[]})
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
    if (!res.ok) throw new Error(`Save failed ${res.status}`);
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
const getBracket = () => store.get('bracket', {rounds:[]});
const setBracket = v  => store.set('bracket', v);

const fileToDataURL = file => new Promise(res => {
  if (!file) return res('');
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(file);
});

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

  // ---- original backup/restore (kept unchanged) ----
  const keys = ['teams','players','matches','bracket'];
  byId('exportBtn').addEventListener('click', () => {
    const data = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if(v) data[k] = v; });
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
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
  importInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameDiv.textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.teams || !Array.isArray(data.teams)) throw new Error('Invalid teams');
        if (data.teams.length > 8) throw new Error('Backup has more than 8 teams');
        if (!confirm('This will ERASE all current data. Continue?')) return;
        localStorage.clear();
        keys.forEach(k => {
          if (data[k] !== undefined) {
            if (k === 'teams' && data[k].length > 8) return;
            localStorage.setItem(k, JSON.stringify(data[k]));
          }
        });
        toast('Backup restored! Reloading…', 'success');
        setTimeout(() => location.reload(), 1000);
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

  // ---- GitHub sync section (injected) ----
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
    GITHUB_REPO = repo; GITHUB_TOKEN = token;
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
  TEAMS PAGE
=====================================================================*/
if (page === 'teams') {
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

  list?.addEventListener('click', e => {
    const editId = e.target.dataset.edit;
    const delId  = e.target.dataset.delete;
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
    const logo = file ? await fileToDataURL(file) : getTeams().find(t=>t.id===id).logo;
    setTeams(getTeams().map(t => t.id===id ? {id,name,logo} : t));
    modal.style.display = 'none';
    render();
  });

  render();
}

/*=====================================================================
  PLAYERS PAGE
=====================================================================*/
if (page === 'players') {
  const form = byId('playerForm'), list = byId('playersList');
  const teamSel = byId('playerTeam');
  const modal = byId('playerModal'), editForm = byId('editPlayerForm'), close = byId('closePlayerModal');

  const render = () => {
    const teams = getTeams();
    const players = getPlayers();
    teamSel.innerHTML = '<option value="">Select Team</option>';
    teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      teamSel.appendChild(opt);
    });

    list.innerHTML = '';
    teams.forEach(t => {
      const ps = players[t.id] || [];
      if (!ps.length) return;
      const block = document.createElement('div');
      block.className = 'team-block';
      block.innerHTML = `<h3>${t.name}</h3>`;
      const c = document.createElement('div');
      ps.forEach((p,i) => {
        const el = document.createElement('div');
        el.className = 'player-card';
        el.innerHTML = `
          <img src="${p.photo||''}" alt="">
          <div class="number">${p.number||''}</div>
          <div class="info"><strong>${p.name}</strong><br><small>${p.position||''}</small></div>
          <div class="actions">
            <button class="btn sm" data-edit-team="${t.id}" data-edit-idx="${i}">Edit</button>
            <button class="btn sm danger" data-del-team="${t.id}" data-del-idx="${i}">Delete</button>
          </div>`;
        c.appendChild(el);
      });
      block.appendChild(c);
      list.appendChild(block);
    });
  };

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const teamId = byId('playerTeam').value;
    const name   = byId('playerName').value.trim();
    const number = byId('playerNumber').value;
    const pos    = byId('playerPosition').value;
    const file   = byId('playerPhoto').files[0];
    if (!teamId || !name) return;
    const photo = await fileToDataURL(file);
    const p = getPlayers();
    if (!p[teamId]) p[teamId] = [];
    p[teamId].push({name,number,position:pos,photo});
    setPlayers(p);
    render();
    form.reset();
  });

  list?.addEventListener('click', e => {
    const et = e.target.dataset.editTeam;
    const ei = e.target.dataset.editIdx;
    const dt = e.target.dataset.delTeam;
    const di = e.target.dataset.delIdx;
    if (et !== undefined && ei !== undefined) {
      const p = getPlayers()[et][ei];
      byId('editPlayerTeamId').value = et;
      byId('editPlayerIndex').value = ei;
      byId('editPlayerName').value = p.name;
      byId('editPlayerNumber').value = p.number||'';
      byId('editPlayerPosition').value = p.position||'';
      modal.style.display = 'flex';
    }
    if (dt !== undefined && di !== undefined) {
      const p = getPlayers();
      p[dt].splice(di,1);
      if (p[dt].length===0) delete p[dt];
      setPlayers(p);
      render();
    }
  });

  close.onclick = () => modal.style.display = 'none';
  editForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const teamId = byId('editPlayerTeamId').value;
    const idx    = byId('editPlayerIndex').value;
    const name   = byId('editPlayerName').value.trim();
    const number = byId('editPlayerNumber').value;
    const pos    = byId('editPlayerPosition').value;
    const file   = byId('editPlayerPhoto').files[0];
    const photo  = file ? await fileToDataURL(file) : getPlayers()[teamId][idx].photo;
    const p = getPlayers();
    p[teamId][idx] = {name,number,position:pos,photo};
    setPlayers(p);
    modal.style.display = 'none';
    render();
  });

  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  MATCHES PAGE
=====================================================================*/
if (page === 'matches') {
  const genBtn = byId('generatePoolBtn');
  const clearBtn = byId('clearMatchesBtn');
  const container = byId('matchesContainer');

  const fmt = iso => `${new Date(iso).toLocaleDateString()} ${new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;

  const render = () => {
    const matches = getMatches();
    container.innerHTML = '';
    matches.forEach(m => {
      const h = getTeams().find(t=>t.id===m.homeId);
      const a = getTeams().find(t=>t.id===m.awayId);
      if (!h||!a) return;
      const el = document.createElement('div');
      el.className = 'match-row';
      el.innerHTML = `
        <div class="team-cell"><img src="${h.logo||''}" alt=""> ${h.name}</div>
        <input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore||0}">
        <span>vs</span>
        <input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore||0}">
        <div class="team-cell"><img src="${a.logo||''}" alt=""> ${a.name}</div>
        <div class="match-time" data-id="${m.id}">${fmt(m.datetime)}</div>
        <button class="btn sm" data-edit-time="${m.id}">Change Time</button>`;
      container.appendChild(el);
    });
  };

  genBtn.onclick = () => {
    const date = byId('compDate').value || '2025-12-15';
    const dur  = +byId('matchDuration').value || 10;
    const brk  = +byId('breakMinutes').value || 2;
    const teams = getTeams();
    if (teams.length < 2) return alert('Need at least 2 teams');
    const matches = [];
    let start = new Date(`${date}T19:00:00`);
    for (let i=0;i<teams.length;i++) for (let j=i+1;j<teams.length;j++) {
      matches.push({id:uuid(),homeId:teams[i].id,awayId:teams[j].id,datetime:start.toISOString(),homeScore:0,awayScore:0});
      start = new Date(start.getTime() + (dur+brk)*60*1000);
    }
    setMatches(matches);
    render();
  };

  clearBtn.onclick = () => { if (confirm('Delete all matches?')) { setMatches([]); render(); } };

  container.addEventListener('change', e => {
    if (!e.target.classList.contains('score-input')) return;
    const id = e.target.dataset.id;
    const side = e.target.dataset.side;
    const val = +e.target.value||0;
    setMatches(getMatches().map(m=>m.id===id?{...m,[side+'Score']:val}:m));
  });

  container.addEventListener('click', e => {
    const id = e.target.dataset.editTime;
    if (!id) return;
    const m = getMatches().find(x=>x.id===id);
    const d = new Date(m.datetime);
    const newDate = prompt('New date (YYYY-MM-DD):', d.toISOString().split('T')[0]);
    const newTime = prompt('New time (HH:MM):', d.toTimeString().slice(0,5));
    if (newDate && newTime) {
      setMatches(getMatches().map(x=>x.id===id?{...x,datetime:`${newDate}T${newTime}:00`}:x));
      render();
    }
  });

  render();
}

/*=====================================================================
  STANDINGS PAGE
=====================================================================*/
if (page === 'standings') {
  const c = byId('standingsContainer');
  const render = () => {
    const matches = getMatches();
    const teams   = getTeams();
    if (!teams.length) { c.innerHTML='<p style="text-align:center;color:#aaa;">No teams yet.</p>'; return; }

    const stats = {};
    teams.forEach(t=>stats[t.id]={mp:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,gd:0});
    matches.forEach(m=>{
      const h=stats[m.homeId], a=stats[m.awayId];
      if(!h||!a) return;
      h.mp++; a.mp++;
      h.gf+=m.homeScore; h.ga+=m.awayScore;
      a.gf+=m.awayScore; a.ga+=m.homeScore;
      if(m.homeScore>m.awayScore){h.w++;a.l++;h.pts+=3;}
      else if(m.homeScore<m.awayScore){a.w++;h.l++;a.pts+=3;}
      else{h.d++;a.d++;h.pts+=1;a.pts+=1;}
    });
    Object.values(stats).forEach(s=>s.gd=s.gf-s.ga);
    const sorted = Object.values(stats).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);

    let html = `<div class="standings-grid"><div class="grid-header" style="display:grid;grid-template-columns:30px 1fr 30px 30px 30px 30px 30px 30px 30px 30px;gap:6px;"># Team MP W D L GF GA GD Pts</div><div style="display:grid;grid-template-columns:30px 1fr 30px 30px 30px 30px 30px 30px 30px 30px;gap:6px;align-items:center;font-size:.9rem;">`;
    sorted.forEach((s,i)=>{
      const t = teams.find(x=>x.id===s.teamId);
      html+=`<div>${i+1}</div><div class="team-cell"><img src="${t.logo||''}" alt=""> ${t.name}</div><div>${s.mp}</div><div>${s.w}</div><div>${s.d}</div><div>${s.l}</div><div>${s.gf}</div><div>${s.ga}</div><div>${s.gd}</div><div>${s.pts}</div>`;
    });
    html+=`</div></div>`;
    c.innerHTML = html;
  };
  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  KNOCKOUT PAGE (headers + alignment)
=====================================================================*/
if (page === 'knockout') {
  const genBtn = byId('generateBracketBtn');
  const resetBtn = byId('resetBracketBtn');
  const container = byId('bracketContainer');

  const roundNames = ['Quarter-Finals','Semi-Finals','Final'];

  const updateFinal = () => {
    const b = getBracket();
    if (!b.rounds.length) return;
    const final = b.rounds[b.rounds.length-1][0];
    const semis = b.rounds[b.rounds.length-2];
    if (!semis || semis.length<2) return;
    const w1 = semis[0].homeScore>semis[0].awayScore?semis[0].homeId:semis[0].awayId;
    const w2 = semis[1].homeScore>semis[1].awayScore?semis[1].homeId:semis[1].awayId;
    if (w1 && w2 && (final.homeId!==w1 || final.awayId!==w2)) {
      final.homeId=w1; final.awayId=w2; final.homeScore=0; final.awayScore=0;
      setBracket(b); render();
    }
  };

  const render = () => {
    const {rounds} = getBracket();
    if (!rounds.length) { container.innerHTML='<p style="text-align:center;color:#aaa;">Generate bracket from standings.</p>'; return; }

    const teamCount = rounds[0].length*2;
    const roundCount = rounds.length;
    const width = 320 + roundCount*340;
    const height = Math.max(700, teamCount*90 + 100);

    let html = `
      <style>
        .bracket-wrapper{width:100%;overflow-x:auto;padding:20px 0;}
        .bracket-svg{width:100%;max-width:${width}px;height:auto;display:block;margin:0 auto;}
        .round-header{font-weight:bold;fill:#ffd700;font-size:18px;text-anchor:middle;}
        .score-input{width:40px;height:32px;text-align:center;font-weight:bold;border:1px solid #ffd700;border-radius:4px;background:#111;color:#fff;}
      </style>
      <div class="bracket-wrapper">
        <svg class="bracket-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    `;

    const sx=140, sy=100, rg=340, vg=140;
    rounds.forEach((r,ri)=>{
      const x = sx + ri*rg;
      html+=`<text x="${x+140}" y="${sy-40}" class="round-header">${roundNames[ri]||'Round '+(ri+1)}</text>`;
      r.forEach((m,i)=>{
        const y = sy + i*vg;
        const home = getTeams().find(t=>t.id===m.homeId)||{name:'TBD',logo:''};
        const away = getTeams().find(t=>t.id===m.awayId)||{name:'TBD',logo:''};

        html+=`<g class="match">
          <rect x="${x}" y="${y}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>
          <image href="${home.logo||''}" x="${x+12}" y="${y+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>
          <text x="${x+65}" y="${y+38}" fill="#fff" font-size="16" font-weight="bold">${home.name}</text>
          <foreignObject x="${x+225}" y="${y+14}" width="44" height="32"><input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore||0}"/></foreignObject>`;

        const ay = y+70;
        html+=`<rect x="${x}" y="${ay}" width="280" height="60" rx="12" fill="#1a1a1a" stroke="#ffd700" stroke-width="2"/>
          <image href="${away.logo||''}" x="${x+12}" y="${ay+10}" width="40" height="40" clip-path="inset(0 round 12px)"/>
          <text x="${x+65}" y="${ay+38}" fill="#fff" font-size="16" font-weight="bold">${away.name}</text>
          <foreignObject x="${x+225}" y="${ay+14}" width="44" height="32"><input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore||0}"/></foreignObject>`;

        if (ri<rounds.length-1) {
          const nx = x+rg;
          const my = y+65;
          html+=`<path d="M${x+280} ${my} H${nx-20}" stroke="#ffd700" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
        }
        html+=`</g>`;
      });
    });

    html+=`<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#ffd700"/></marker></defs></svg></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.score-input').forEach(inp=>{
      inp.addEventListener('change', e=>{
        const id = e.target.dataset.id;
        const side = e.target.dataset.side;
        const val = +e.target.value||0;
        const b = getBracket();
        b.rounds.forEach(r=>r.forEach(m=>m.id===id&&(m[side+'Score']=val)));
        setBracket(b);
        updateFinal();
      });
    });
  };

  genBtn.onclick = () => {
    const matches = getMatches();
    const teams   = getTeams();
    if (teams.length<2) return alert('Need 2+ teams');

    const stats = {};
    teams.forEach(t=>stats[t.id]={pts:0,gd:0,gf:0,ga:0});
    matches.forEach(m=>{
      const h=stats[m.homeId], a=stats[m.awayId];
      if(!h||!a) return;
      h.gf+=m.homeScore; h.ga+=m.awayScore;
      a.gf+=m.awayScore; a.ga+=m.homeScore;
      if(m.homeScore>m.awayScore) h.pts+=3;
      else if(m.homeScore<m.awayScore) a.pts+=3;
      else {h.pts+=1; a.pts+=1;}
    });
    Object.values(stats).forEach(s=>s.gd=s.gf-s.ga);
    const ranked = teams.map(t=>({...stats[t.id],name:t.name,logo:t.logo}))
                       .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);

    let size=2; while(size<ranked.length&&size<16) size*=2;
    const top = ranked.slice(0,size);

    const rounds = [];
    let cur = top.map(t=>({id:t.id}));
    while (cur.length>1) {
      const r=[];
      for(let i=0;i<cur.length;i+=2) if(i+1<cur.length)
        r.push({id:uuid(),homeId:cur[i].id,awayId:cur[i+1].id,homeScore:0,awayScore:0});
      rounds.push(r);
      cur = r.map(()=>({id:null}));
    }
    setBracket({rounds});
    render();
  };

  resetBtn.onclick = () => { setBracket({rounds:[]}); render(); };
  render();
  window.addEventListener('storage', render);
}

/*=====================================================================
  BOOT – run auto-load on every page
=====================================================================*/
document.addEventListener('DOMContentLoaded', () => {
  autoLoadFromGitHub();   // runs on EVERY page
});