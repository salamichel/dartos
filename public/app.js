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
  leaderboard: (seasonId) => api.req(`/seasons/${seasonId}/leaderboard`),
};

let players = [];
let seasons = [];

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
    li.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="muted">#${p.id}</span>`;
    ul.appendChild(li);
  }
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
}

document.getElementById("season-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("s-name");
  const status = document.getElementById("s-status");
  try {
    await api.createSeason(input.value.trim());
    input.value = "";
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
  row.className = "participant-row";
  row.innerHTML = `
    <div class="rank"></div>
    <select class="p-select"></select>
    <input type="number" class="p-score" placeholder="score restant" min="1" max="301" />
    <button type="button" class="remove">×</button>
  `;
  participantsEl.appendChild(row);
  row.querySelector(".remove").addEventListener("click", () => {
    row.remove();
    refreshRanks();
  });
  refreshParticipantOptions();
  refreshRanks();
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
    row.querySelector(".rank").textContent = i + 1 + (i === 0 ? "er" : "ᵉ");
    const isLast = i === rows.length - 1 && rows.length >= 2;
    const score = row.querySelector(".p-score");
    score.disabled = !isLast;
    if (!isLast) score.value = "";
  });
}

document.getElementById("m-add").addEventListener("click", addParticipantRow);

document.getElementById("match-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("m-status");
  const seasonId = Number(document.getElementById("m-season").value);
  const playedAtRaw = document.getElementById("m-playedAt").value;
  const rows = [...participantsEl.querySelectorAll(".participant-row")];

  if (rows.length < 2) {
    return setStatus(status, "Il faut au moins 2 participants", false);
  }
  const participants = rows.map((row, i) => {
    const playerId = Number(row.querySelector(".p-select").value);
    const rank = i + 1;
    const scoreRaw = row.querySelector(".p-score").value;
    const p = { playerId, rank };
    if (i === rows.length - 1 && scoreRaw) p.scoreLeft = Number(scoreRaw);
    return p;
  });
  if (participants.some((p) => !p.playerId)) {
    return setStatus(status, "Chaque ligne doit avoir un joueur", false);
  }

  const payload = { seasonId, participants };
  if (playedAtRaw) payload.playedAt = new Date(playedAtRaw).toISOString();

  try {
    await api.recordMatch(payload);
    setStatus(status, "Match enregistré ✓", true);
    participantsEl.innerHTML = "";
    addParticipantRow();
    addParticipantRow();
  } catch (err) {
    setStatus(status, err.message, false);
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
        const tail = p.scoreLeft != null ? ` <span class="muted">(reste ${p.scoreLeft})</span>` : "";
        return `<li>${escapeHtml(p.player.name)}${tail}</li>`;
      })
      .join("");
    card.innerHTML = `<header><strong>Match #${m.id}</strong> <span class="when">${when}</span></header><ol>${lis}</ol>`;
    container.appendChild(card);
  }
}
document.getElementById("ml-refresh").addEventListener("click", refreshMatchesList);

// ----- Leaderboard -----
async function refreshLeaderboard() {
  const seasonId = document.getElementById("lb-season").value;
  if (!seasonId) return;
  const data = await api.leaderboard(seasonId);
  const tbody = document.querySelector("#lb-table tbody");
  tbody.innerHTML = "";
  const empty = document.getElementById("lb-empty");
  if (!data.leaderboard.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  for (const r of data.leaderboard) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.position}</td><td>${escapeHtml(r.playerName)}</td><td>${r.matchesPlayed}</td><td>${r.wins}</td><td>${r.totalPoints}</td><td>${r.averagePoints.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  }
}
document.getElementById("lb-refresh").addEventListener("click", refreshLeaderboard);
document.getElementById("lb-season").addEventListener("change", refreshLeaderboard);

// ----- Tab show hooks -----
function onTabShow(tab) {
  if (tab === "leaderboard") refreshLeaderboard();
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
