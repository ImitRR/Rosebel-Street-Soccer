/* script.js */
const store = {
  get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('storage')); }
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const byId = id => document.getElementById(id);

const page = document.body.dataset.page;

// DATA
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
  TEAMS – FIXED ADD/EDIT
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
  PLAYERS – FIXED ADD/EDIT
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
  MATCHES – 7PM START, 8 TEAMS MAX, ROUND-ROBIN
=====================================================================*/
function initMatches() {
  const genBtn = byId('generatePoolBtn');
  const clearBtn = byId('clearMatchesBtn');
  const matchesDiv = byId('matchesContainer');
  const modal = byId('matchModal'), editForm = byId('editMatchForm'), close = byId('closeMatchModal');

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
        <button class="btn sm" data-edit="${m.id}">Edit</button>`;
      matchesDiv.appendChild(el);
    });
  };

  genBtn.onclick = () => {
    const date = byId('compDate').value || '2025-12-15';
    const dur = +byId('matchDuration').value || 10;
    const brk = +byId('breakMinutes').value || 2;

    const teams = getTeams();
    if (teams.length === 0) return alert('Add teams first');
    if (teams.length > 8) return alert('Max 8 teams');

    const matches = [];
    let start = new Date(`${date}T19:00:00`); // 7:00 PM

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
    if (e.target.dataset.edit) {
      const m = getMatches().find(x => x.id === e.target.dataset.edit);
      byId('editMatchId').value = m.id;
      byId('editMatchDate').value = m.datetime.split('T')[0];
      byId('editMatchTime').value = m.datetime.split('T')[1].slice(0, 5);
      modal.style.display = 'flex';
    }
  });

  close.onclick = () => modal.style.display = 'none';
  editForm.addEventListener('submit', e => {
    e.preventDefault();
    const id = byId('editMatchId').value;
    const date = byId('editMatchDate').value;
    const time = byId('editMatchTime').value;
    const datetime = `${date}T${time}:00`;
    const matches = getMatches().map(m => m.id === id ? { ...m, datetime } : m);
    setMatches(matches);
    modal.style.display = 'none';
    renderMatches();
  });

  renderMatches();
}

/*=====================================================================
  STANDINGS – REAL-TIME
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
  KNOCKOUT – AUTO ADVANCE WINNERS TO FINAL
=====================================================================*/
function initKnockout() {
  const genBtn = byId('generateBracketBtn');
  const resetBtn = byId('resetBracketBtn');
  const container = byId('bracketContainer');

  const updateFinalTeams = () => {
    const bracket = getBracket();
    if (bracket.rounds.length < 2) return;
    const semis = bracket.rounds[0];
    if (semis.length !== 2) return;

    const m1 = semis[0], m2 = semis[1];
    const winner1 = m1.homeScore > m1.awayScore ? m1.homeId : m1.awayId;
    const winner2 = m2.homeScore > m2.awayScore ? m2.homeId : m2.awayId;

    if (winner1 && winner2) {
      bracket.rounds[1][0].homeId = winner1;
      bracket.rounds[1][0].awayId = winner2;
      setBracket(bracket);
    }
  };

  const render = () => {
    const { rounds } = getBracket();
    if (!rounds.length) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;">Generate bracket from standings.</p>';
      return;
    }

    let html = `<svg class="bracket-svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">`;
    const startX = 100, startY = 120, roundGap = 350, vGap = 180;

    rounds.forEach((round, rIdx) => {
      const x = startX + rIdx * roundGap;
      round.forEach((m, i) => {
        const y = startY + i * vGap;
        const home = getTeams().find(t => t.id === m.homeId) || { name: 'TBD', logo: '' };
        const away = getTeams().find(t => t.id === m.awayId) || { name: 'TBD', logo: '' };

        html += `<g class="match">`;
        html += `<rect x="${x}" y="${y}" width="180" height="50" rx="8" fill="#111" stroke="#ffd700"/>`;
        html += `<image href="${home.logo||''}" x="${x+8}" y="${y+8}" width="32" height="32"/>`;
        html += `<text x="${x+48}" y="${y+30}" fill="#fff" font-size="14">${home.name}</text>`;
        html += `<foreignObject x="${x+135}" y="${y+10}" width="35" height="30">`;
        html += `<input class="score-input" data-id="${m.id}" data-side="home" value="${m.homeScore||0}">`;
        html += `</foreignObject>`;

        const ay = y + 60;
        html += `<rect x="${x}" y="${ay}" width="180" height="50" rx="8" fill="#111" stroke="#ffd700"/>`;
        html += `<image href="${away.logo||''}" x="${x+8}" y="${ay+8}" width="32" height="32"/>`;
        html += `<text x="${x+48}" y="${ay+30}" fill="#fff" font-size="14">${away.name}</text>`;
        html += `<foreignObject x="${x+135}" y="${ay+10}" width="35" height="30">`;
        html += `<input class="score-input" data-id="${m.id}" data-side="away" value="${m.awayScore||0}">`;
        html += `</foreignObject>`;

        if (rIdx < rounds.length - 1) {
          const nextX = x + roundGap;
          const midY = y + 55;
          html += `<path d="M${x+180} ${midY} H${nextX-20}" stroke="#ffd700" stroke-width="2" fill="none"/>`;
        }
        html += `</g>`;
      });
    });

    html += `</svg>`;
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
    if (teams.length < 4) return alert('Need at least 4 teams');

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

    const top4 = ranked.slice(0, 4);
    if (top4.length < 4) return alert('Need top 4 from pool.');

    const semis = [
      { id: uuid(), homeId: top4[0].id, awayId: top4[3].id, homeScore: 0, awayScore: 0 },
      { id: uuid(), homeId: top4[1].id, awayId: top4[2].id, homeScore: 0, awayScore: 0 }
    ];
    const final = { id: uuid(), homeId: null, awayId: null, homeScore: 0, awayScore: 0 };

    setBracket({ rounds: [semis, [final]] });
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
    const players = Object.values(playersObj).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    const matches = getMatches().length;
    byId('statTeams').textContent = teams;
    byId('statPlayers').textContent = players;
    byId('statMatches').textContent = matches;
  };
  updateStats();
  window.addEventListener('storage', updateStats);
}

/*=====================================================================
  BOOT
=====================================================================*/
switch (page) {
  case 'teams': initTeams(); break;
  case 'players': initPlayers(); break;
  case 'matches': initMatches(); break;
  case 'standings': initStandings(); break;
  case 'knockout': initKnockout(); break;
  default: initDashboard(); break;
}