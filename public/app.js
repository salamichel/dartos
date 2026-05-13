// Vanilla JS frontend for the dartos API.

const api = {
  async req(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.formErrors?.join(", ") || body?.error?.fieldErrors?.participants?.join(", ") || body?.error || `HTTP ${res.status}`);
    return body;
  },
  listPlayers: () => api.req("/players"),
  createPlayer: (name) => api.req("/players", { method: "POST", body: JSON.stringify({ name }) }),
  listSeasons: () => api.req("/seasons"),
  createSeason: (name) => api.req("/seasons", { method: "POST", body: JSON.stringify({ name }) }),
  listMatches: (seasonId) => api.req("/matches" + (seasonId ? `?seasonId=${seasonId}` : "")),
  recordMatch: (payload) => api.req("/matches", { method: "POST", body: JSON.stringify(payload) }),
  leaderboard: () => api.req(`/leaderboard`),
};

let players = [];
let seasons = [];

const LEVELS = [
  { title: "Pousse-Caillou", minXP: 0 },
  { title: "Lanceur du Dimanche", minXP: 500 },
  { title: "Sniper de Comptoir", minXP: 2000 },
  { title: "Maître du 301", minXP: 5000 },
  { title: "Phil Taylor", minXP: 10000 },
];

// ----- Tabs -----
document.querySelectorAll("nav button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById("tab-" + b.dataset.tab).classList.add("active");
    onTabShow(b.dataset.tab);
  });
});

function setStatus(el, msg, ok) {
  el.textContent = msg;
  el.className = "status " + (ok ? "ok" : "err");
}

// ----- Players -----
async function refreshPlayers() {
  players = await api.listPlayers();
  const ul = document.getElementById("p-list");
  ul.innerHTML = "";
  for (const p of players) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">#${p.id}</span>
      </div>
      <button class="muted small edit-player" data-id="${p.id}" data-name="${escapeHtml(p.name)}">Modifier</button>
    `;
    ul.appendChild(li);
  }
  
  ul.querySelectorAll(".edit-player").forEach(btn => {
    btn.addEventListener("click", async () => {
      const newName = prompt("Nouveau pseudo pour " + btn.dataset.name, btn.dataset.name);
      if (newName && newName !== btn.dataset.name) {
        try {
          await api.req("/players/" + btn.dataset.id, { method: "PATCH", body: JSON.stringify({ name: newName.trim() }) });
          await refreshPlayers();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  });
  refreshParticipantOptions();
}

document.getElementById("player-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("p-name");
  const status = document.getElementById("p-status");
  try {
    await api.createPlayer(input.value.trim());
    input.value = "";
    setStatus(status, "Ajouté", true);
    await refreshPlayers();
  } catch (err) {
    setStatus(status, err.message, false);
  }
});

// ----- Seasons -----
async function refreshSeasons() {
  seasons = await api.listSeasons();
  const ul = document.getElementById("s-list");
  ul.innerHTML = "";
  for (const s of seasons) {
    const li = document.createElement("li");
    const date = new Date(s.startedAt).toLocaleDateString();
    li.innerHTML = `<span>${escapeHtml(s.name)}</span><span class="muted">depuis ${date}</span>`;
    ul.appendChild(li);
  }
  for (const id of ["lb-season", "m-season", "ml-season"]) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const prev = sel.value;
    const keepAll = id === "ml-season";
    sel.innerHTML = keepAll ? '<option value="">Toutes</option>' : "";
    for (const s of seasons) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
  }
  
  // Update rules for the currently selected season in leaderboard
  updateRuleDisplay(document.getElementById("lb-season").value);
}

function updateRuleDisplay(seasonId) {
  const season = seasons.find(s => s.id == seasonId) || seasons[0];
  if (!season) return;
  
  document.getElementById("rule-xpOpponent").textContent = season.xpPerDefeatedOpponent;
  document.getElementById("rule-xpDouble").textContent = season.xpBonusDouble;
  document.getElementById("rule-xpTriple").textContent = season.xpBonusTriple;
  document.getElementById("rule-xpVampire").textContent = season.xpVampireMultiplier;
  document.getElementById("rule-xpSurvivor").textContent = season.xpSurvivorBase;

  document.getElementById("rule-xpPoulidor").textContent = season.xpBonusPoulidor;
  document.getElementById("rule-xpJackpot").textContent = season.xpBonusJackpot;
  document.getElementById("rule-xpEgalite").textContent = season.xpBonusEgalite;
  document.getElementById("rule-xpTueur").textContent = season.xpBonusTueurDeGeants;
}

document.getElementById("season-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("s-name").value.trim();
  const status = document.getElementById("s-status");
  
  const payload = { name };
  const fields = {
    xpPerDefeatedOpponent: "s-xpOpponent",
    xpBonusSimple: "s-xpSimple",
    xpBonusDouble: "s-xpDouble",
    xpBonusTriple: "s-xpTriple",
    xpVampireMultiplier: "s-xpVampire",
    xpSurvivorBase: "s-xpSurvivor",
    xpBonusPoulidor: "s-xpPoulidor",
    xpBonusJackpot: "s-xpJackpot",
    xpBonusEgalite: "s-xpEgalite",
    xpBonusTueurDeGeants: "s-xpTueur"
  };
  
  for (const [key, id] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el && el.value !== "") payload[key] = Number(el.value);
  }

  try {
    await api.req("/seasons", { method: "POST", body: JSON.stringify(payload) });
    document.getElementById("s-name").value = "";
    Object.values(fields).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    setStatus(status, "Créée", true);
    await refreshSeasons();
  } catch (err) {
    setStatus(status, err.message, false);
  }
});

// ----- Match form -----
const participantsEl = document.getElementById("m-participants");

function addParticipantRow() {
  const row = document.createElement("div");
  const i = participantsEl.children.length;
  row.className = "participant-row";
  
  if (i === 0) {
    // Winner row
    row.innerHTML = `
      <div class="rank">🏆</div>
      <select class="p-select" required></select>
      <select class="p-finish" title="Finition">
        <option value="SIMPLE">Finition SIMPLE</option>
        <option value="DOUBLE">Finition DOUBLE</option>
        <option value="TRIPLE">Finition TRIPLE / BULLE</option>
      </select>
      <div style="width: 32px"></div>
    `;
  } else {
    // Loser row
    row.innerHTML = `
      <div class="rank">💀</div>
      <select class="p-select" required></select>
      <input type="number" class="p-score" placeholder="Score restant" min="1" max="301" required />
      <button type="button" class="remove">×</button>
    `;
    row.querySelector(".remove").addEventListener("click", () => {
      row.remove();
      refreshRanks();
    });
  }
  
  participantsEl.appendChild(row);
  refreshParticipantOptions();
}

function refreshParticipantOptions() {
  const selects = participantsEl.querySelectorAll(".p-select");
  selects.forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = '<option value="">— choisir —</option>';
    for (const p of players) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
  });
}

function refreshRanks() {
  const rows = [...participantsEl.querySelectorAll(".participant-row")];
  rows.forEach((row, i) => {
    const rankEl = row.querySelector(".rank");
    if (i === 0) {
      rankEl.textContent = "🏆";
    } else {
      rankEl.textContent = "💀";
    }
  });
}

document.getElementById("m-add").addEventListener("click", addParticipantRow);

document.getElementById("match-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("m-status");
  const matchId = document.getElementById("m-id").value;
  const seasonId = Number(document.getElementById("m-season").value);
  const playedAtRaw = document.getElementById("m-playedAt").value;
  const rows = [...participantsEl.querySelectorAll(".participant-row")];

  if (rows.length < 2) {
    return setStatus(status, "Il faut au moins 2 participants (1 gagnant + 1 perdant)", false);
  }

  const winnerRow = rows[0];
  const winnerId = Number(winnerRow.querySelector(".p-select").value);
  const finishType = winnerRow.querySelector(".p-finish").value;

  const losers = rows.slice(1).map((row) => {
    const playerId = Number(row.querySelector(".p-select").value);
    const scoreLeft = Number(row.querySelector(".p-score").value);
    return { playerId, scoreLeft };
  });

  if (!winnerId || losers.some((l) => !l.playerId || !l.scoreLeft)) {
    return setStatus(status, "Tous les champs sont requis", false);
  }

  const payload = { 
    seasonId, 
    winner: { playerId: winnerId, finishType },
    losers
  };
  if (playedAtRaw) payload.playedAt = new Date(playedAtRaw).toISOString();

  try {
    let result;
    if (matchId) {
      result = await api.req("/matches/" + matchId, { method: "PUT", body: JSON.stringify(payload) });
      // Reset form
      document.getElementById("m-id").value = "";
      document.getElementById("match-form-title").textContent = "Enregistrer un match terminé";
    } else {
      result = await api.recordMatch(payload);
    }
    showMatchSummary(result);
    participantsEl.innerHTML = "";
    addParticipantRow(); // winner
    addParticipantRow(); // one loser
  } catch (err) {
    setStatus(status, err.message, false);
  }
});

function showMatchSummary(match) {
  const overlay = document.getElementById("modal-overlay");
  const list = document.getElementById("modal-results-list");
  list.innerHTML = "";
  
  const sorted = [...match.participants].sort((a, b) => a.rank - b.rank);
  const winner = sorted[0];
  
  document.getElementById("modal-winner-name").textContent = winner.player.name;
  
  const medalsMap = {
    "POULIDOR": "🥈",
    "JACKPOT": "🎰",
    "EGALITE": "🤝",
    "TUEUR_DE_GEANTS": "⚔️🏆"
  };

  sorted.forEach(p => {
    const row = document.createElement("div");
    row.className = "modal-row" + (p.rank === 1 ? " winner" : "");
    
    const medalsHtml = (p.medals || []).map(m => `<span>${medalsMap[m] || m}</span>`).join(" ");
    
    row.innerHTML = `
      <div class="modal-player">
        <span class="name">${p.player.name}</span>
        <div class="medals">${medalsHtml}</div>
      </div>
      <div class="xp">+${p.xpEarned} XP</div>
    `;
    list.appendChild(row);
  });
  
  overlay.classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", () => {
  console.log("Closing modal...");
  document.getElementById("modal-overlay").classList.add("hidden");
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") {
    document.getElementById("modal-overlay").classList.add("hidden");
  }
});

// ----- Matches list -----
async function refreshMatchesList() {
  const seasonId = document.getElementById("ml-season").value;
  const matches = await api.listMatches(seasonId);
  const container = document.getElementById("ml-list");
  container.innerHTML = "";
  if (!matches.length) {
    container.innerHTML = '<p class="muted">Aucun match.</p>';
    return;
  }
  for (const m of matches) {
    const card = document.createElement("div");
    card.className = "match-card";
    const when = new Date(m.playedAt).toLocaleString();
    const sorted = [...m.participants].sort((a, b) => a.rank - b.rank);
    const lis = sorted
      .map((p) => {
        const detail = p.rank === 1 ? ` (Finition ${p.finishType})` : ` (Reste ${p.scoreLeft})`;
        const xp = `<span class="xp-gain ${p.xpEarned >= 0 ? "plus" : "minus"}">${p.xpEarned >= 0 ? "+" : ""}${p.xpEarned} XP</span>`;
        
        const medalsMap = {
          "POULIDOR": "🥈",
          "JACKPOT": "🎰",
          "EGALITE": "🤝",
          "TUEUR_DE_GEANTS": "⚔️🏆"
        };
        const medalsHtml = (p.medals || []).map(m => `<span class="medal-icon" title="${m}">${medalsMap[m] || m}</span>`).join(" ");

        return `<li><strong>${p.rank}.</strong> ${escapeHtml(p.player.name)}${detail} — ${xp} ${medalsHtml}</li>`;
      })
      .join("");
    card.innerHTML = `
      <header>
        <div><strong>Match #${m.id}</strong> <span class="muted">${when}</span></div>
        <button class="muted small edit-match" data-id="${m.id}">Modifier</button>
      </header>
      <ul>${lis}</ul>
    `;
    card.querySelector(".edit-match").addEventListener("click", () => {
      editMatch(m);
    });
    container.appendChild(card);
  }
}

function editMatch(m) {
  document.getElementById("m-id").value = m.id;
  document.getElementById("m-season").value = m.seasonId;
  document.getElementById("m-playedAt").value = new Date(m.playedAt).toISOString().slice(0, 16);
  document.getElementById("match-form-title").textContent = "Modifier le match #" + m.id;
  
  participantsEl.innerHTML = "";
  const sorted = [...m.participants].sort((a, b) => a.rank - b.rank);
  
  sorted.forEach((p, i) => {
    addParticipantRow();
    const row = participantsEl.children[i];
    row.querySelector(".p-select").value = p.playerId;
    if (p.rank === 1) {
      row.querySelector(".p-finish").value = p.finishType;
    } else {
      row.querySelector(".p-score").value = p.scoreLeft;
    }
  });

  // Switch tab
  document.querySelector('button[data-tab="match"]').click();
}
document.getElementById("ml-refresh").addEventListener("click", refreshMatchesList);

// ----- Leaderboard -----
async function refreshLeaderboard() {
  const data = await api.leaderboard();
  const tbody = document.querySelector("#lb-table tbody");
  const podium = document.getElementById("lb-podium");
  const empty = document.getElementById("lb-empty");
  
  tbody.innerHTML = "";
  podium.innerHTML = "";
  
  if (!data || !data.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Render Podium for Top 3
  const top3 = data.slice(0, 3);
  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd for visual balance
  
  const podiumHtml = podiumOrder.map(idx => {
    const p = top3[idx];
    if (!p) return '<div class="podium-spot empty"></div>';
    const rank = idx + 1;
    const crown = rank === 1 ? "👑" : rank === 2 ? "🥈" : "🥉";
    return `
      <div class="podium-spot rank-${rank}">
        <div class="podium-crown">${crown}</div>
        <div class="podium-name">${escapeHtml(p.name)}</div>
        <div class="podium-xp">${p.totalXP} XP</div>
        <div class="podium-base"></div>
      </div>
    `;
  }).join("");
  podium.innerHTML = podiumHtml;

  // Render Table
  data.forEach((r, i) => {
    const nextLevelIdx = LEVELS.findIndex(l => l.minXP > r.totalXP);
    const currentLevel = LEVELS[nextLevelIdx - 1] || LEVELS[LEVELS.length - 1];
    const nextLevel = LEVELS[nextLevelIdx];
    
    let progressPercent = 100;
    let xpRemaining = 0;
    
    if (nextLevel) {
      const range = nextLevel.minXP - currentLevel.minXP;
      const currentProgress = r.totalXP - currentLevel.minXP;
      progressPercent = Math.min(100, Math.floor((currentProgress / range) * 100));
      xpRemaining = nextLevel.minXP - r.totalXP;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${r.matchCount}</td>
      <td>${r.totalXP} XP</td>
      <td>
        <div class="xp-progress-bg" title="${nextLevel ? `Encore ${xpRemaining} XP avant le prochain niveau` : 'Niveau Max !'}">
          <div class="xp-progress-bar" style="width: ${progressPercent}%"></div>
          <span class="xp-progress-text">${progressPercent}%</span>
        </div>
      </td>
      <td><span class="level-badge">${r.level}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLevelsLegend() {
  const container = document.getElementById("levels-legend");
  if (!container) return;
  
  container.innerHTML = LEVELS.map((l, i) => {
    const next = LEVELS[i + 1];
    const range = next ? `${l.minXP} - ${next.minXP - 1} XP` : `${l.minXP}+ XP`;
    return `
      <div class="level-card">
        <span class="level-badge">${l.title}</span>
        <span class="level-range">${range}</span>
      </div>
    `;
  }).join("");
}

document.getElementById("lb-refresh").addEventListener("click", refreshLeaderboard);
document.getElementById("lb-season").addEventListener("change", () => {
  refreshLeaderboard();
  updateRuleDisplay(document.getElementById("lb-season").value);
});
document.getElementById("lb-recalculate").addEventListener("click", async () => {
  const seasonId = document.getElementById("lb-season").value;
  if (!seasonId) return alert("Choisissez une saison");
  if (!confirm("Voulez-vous recalculer tous les scores d'XP de cette saison avec les règles actuelles ?")) return;
  try {
    const res = await api.req(`/seasons/${seasonId}/recalculate`, { method: "POST" });
    alert(`Terminé ! ${res.matchesProcessed} matchs recalculés.`);
    await refreshLeaderboard();
  } catch (err) {
    alert(err.message);
  }
});

// ----- Tab show hooks -----
function onTabShow(tab) {
  if (tab === "leaderboard") {
    refreshLeaderboard();
    renderLevelsLegend();
  }
  else if (tab === "matches") refreshMatchesList();
  else if (tab === "match" && participantsEl.children.length === 0) {
    addParticipantRow();
    addParticipantRow();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ----- Boot -----
(async function init() {
  await refreshPlayers();
  await refreshSeasons();
  addParticipantRow();
  addParticipantRow();
  await refreshLeaderboard();
})();
