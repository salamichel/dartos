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
  createSeason: (payload) => api.req("/seasons", { method: "POST", body: JSON.stringify(payload) }),
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

// ----- Toast notifications -----
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

// ----- Custom confirm dialog -----
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-overlay");
    document.getElementById("confirm-message").textContent = message;
    overlay.classList.remove("hidden");

    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");

    function cleanup(result) {
      overlay.classList.add("hidden");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}

// ----- Loading button helper -----
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.classList.add("loading");
    btn._origText = btn.textContent;
  } else {
    btn.disabled = false;
    btn.classList.remove("loading");
    if (btn._origText !== undefined) btn.textContent = btn._origText;
  }
}

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

  if (!players.length) {
    ul.innerHTML = '<li style="justify-content:center;color:var(--muted);font-size:0.85rem;">Aucun joueur. Créez-en un ci-dessus.</li>';
  }

  for (const p of players) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="player-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">${p.matchCount} match${p.matchCount !== 1 ? "s" : ""} · ${p.totalXP} XP</span>
      </div>
      <button class="muted small edit-player" data-id="${p.id}" data-name="${escapeHtml(p.name)}">Modifier</button>
    `;
    ul.appendChild(li);
  }

  ul.querySelectorAll(".edit-player").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const newName = prompt("Nouveau pseudo pour " + btn.dataset.name, btn.dataset.name);
      if (newName && newName.trim() !== btn.dataset.name) {
        try {
          await api.req("/players/" + btn.dataset.id, { method: "PATCH", body: JSON.stringify({ name: newName.trim() }) });
          showToast("Joueur renommé ✓", "ok");
          await refreshPlayers();
        } catch (err) {
          showToast(err.message, "err");
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
  const btn = e.submitter || e.target.querySelector('[type="submit"]');
  setLoading(btn, true);
  try {
    await api.createPlayer(input.value.trim());
    input.value = "";
    setStatus(status, "Ajouté ✓", true);
    showToast("Joueur créé ✓", "ok");
    await refreshPlayers();
  } catch (err) {
    setStatus(status, err.message, false);
  } finally {
    setLoading(btn, false);
  }
});

// ----- Seasons -----
async function refreshSeasons() {
  seasons = await api.listSeasons();
  const ul = document.getElementById("s-list");
  ul.innerHTML = "";

  if (!seasons.length) {
    ul.innerHTML = '<li style="color:var(--muted);font-size:0.85rem;">Aucune saison. Créez-en une ci-dessus.</li>';
  }

  for (const s of seasons) {
    const li = document.createElement("li");
    const date = new Date(s.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    li.innerHTML = `<span>${escapeHtml(s.name)}</span><span class="muted">Depuis le ${date}</span>`;
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

  updateRuleDisplay(document.getElementById("lb-season").value);
}

function updateRuleDisplay(seasonId) {
  const season = seasons.find((s) => s.id == seasonId) || seasons[0];
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

const SEASON_DEFAULTS = {
  xpPerDefeatedOpponent: 50,
  xpBonusSimple: 0,
  xpBonusDouble: 50,
  xpBonusTriple: 100,
  xpVampireMultiplier: 1,
  xpSurvivorBase: 20,
  xpBonusPoulidor: 100,
  xpBonusJackpot: 300,
  xpBonusEgalite: 50,
  xpBonusTueurDeGeants: 200,
};

const SEASON_FIELD_MAP = {
  xpPerDefeatedOpponent: "s-xpOpponent",
  xpBonusSimple: "s-xpSimple",
  xpBonusDouble: "s-xpDouble",
  xpBonusTriple: "s-xpTriple",
  xpVampireMultiplier: "s-xpVampire",
  xpSurvivorBase: "s-xpSurvivor",
  xpBonusPoulidor: "s-xpPoulidor",
  xpBonusJackpot: "s-xpJackpot",
  xpBonusEgalite: "s-xpEgalite",
  xpBonusTueurDeGeants: "s-xpTueur",
};

document.getElementById("season-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("s-name").value.trim();
  const status = document.getElementById("s-status");
  const btn = e.submitter || e.target.querySelector('[type="submit"]');
  setLoading(btn, true);

  const payload = { name };
  for (const [key, id] of Object.entries(SEASON_FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el && el.value !== "") payload[key] = Number(el.value);
  }

  try {
    await api.req("/seasons", { method: "POST", body: JSON.stringify(payload) });
    document.getElementById("s-name").value = "";
    for (const [key, id] of Object.entries(SEASON_FIELD_MAP)) {
      const el = document.getElementById(id);
      if (el) el.value = SEASON_DEFAULTS[key] ?? "";
    }
    setStatus(status, "Créée ✓", true);
    showToast("Saison créée ✓", "ok");
    await refreshSeasons();
  } catch (err) {
    setStatus(status, err.message, false);
  } finally {
    setLoading(btn, false);
  }
});

// ----- Match form -----
const participantsEl = document.getElementById("m-participants");

function addParticipantRow() {
  const row = document.createElement("div");
  const i = participantsEl.children.length;
  row.className = "participant-row" + (i === 0 ? " winner-row" : "");

  if (i === 0) {
    row.innerHTML = `
      <div class="rank">🏆</div>
      <select class="p-select" required></select>
      <select class="p-finish" title="Finition">
        <option value="SIMPLE">Finition SIMPLE</option>
        <option value="DOUBLE">Finition DOUBLE ✖️2</option>
        <option value="TRIPLE">Finition TRIPLE / BULLE ✖️3</option>
      </select>
      <div style="width: 32px"></div>
    `;
  } else {
    row.innerHTML = `
      <div class="rank">💀</div>
      <select class="p-select" required></select>
      <input type="number" class="p-score" placeholder="Score restant" min="1" max="301" required />
      <button type="button" class="remove" title="Supprimer">×</button>
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

  // Warn if same player selected twice
  selects.forEach((sel) => {
    sel.addEventListener("change", checkDuplicatePlayers, { once: false });
  });
}

function checkDuplicatePlayers() {
  const selects = [...participantsEl.querySelectorAll(".p-select")];
  const values = selects.map((s) => s.value).filter(Boolean);
  const hasDup = values.length !== new Set(values).size;
  const status = document.getElementById("m-status");
  if (hasDup) {
    setStatus(status, "⚠️ Un joueur est sélectionné plusieurs fois", false);
  } else if (status.textContent.startsWith("⚠️")) {
    status.textContent = "";
    status.className = "status";
  }
}

function refreshRanks() {
  [...participantsEl.querySelectorAll(".participant-row")].forEach((row, i) => {
    const rankEl = row.querySelector(".rank");
    row.classList.toggle("winner-row", i === 0);
    rankEl.textContent = i === 0 ? "🏆" : "💀";
  });
}

document.getElementById("m-add").addEventListener("click", addParticipantRow);

document.getElementById("match-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("m-status");
  const btn = e.submitter || e.target.querySelector('[type="submit"]');
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

  const losers = rows.slice(1).map((row) => ({
    playerId: Number(row.querySelector(".p-select").value),
    scoreLeft: Number(row.querySelector(".p-score").value),
  }));

  if (!winnerId || losers.some((l) => !l.playerId || !l.scoreLeft)) {
    return setStatus(status, "Tous les champs sont requis", false);
  }

  // Check duplicates
  const allIds = [winnerId, ...losers.map((l) => l.playerId)];
  if (allIds.length !== new Set(allIds).size) {
    return setStatus(status, "Un joueur est sélectionné plusieurs fois", false);
  }

  const payload = { seasonId, winner: { playerId: winnerId, finishType }, losers };
  if (playedAtRaw) payload.playedAt = new Date(playedAtRaw).toISOString();

  setLoading(btn, true);
  try {
    let result;
    if (matchId) {
      result = await api.req("/matches/" + matchId, { method: "PUT", body: JSON.stringify(payload) });
      document.getElementById("m-id").value = "";
      document.getElementById("match-form-title").textContent = "Enregistrer un match terminé";
      showToast("Match mis à jour ✓", "ok");
    } else {
      result = await api.recordMatch(payload);
    }
    showMatchSummary(result);
    participantsEl.innerHTML = "";
    addParticipantRow();
    addParticipantRow();
    status.textContent = "";
  } catch (err) {
    setStatus(status, err.message, false);
  } finally {
    setLoading(btn, false);
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
    POULIDOR: "🥈",
    JACKPOT: "🎰",
    EGALITE: "🤝",
    TUEUR_DE_GEANTS: "⚔️🏆",
  };

  sorted.forEach((p) => {
    const row = document.createElement("div");
    row.className = "modal-row" + (p.rank === 1 ? " winner" : "");
    const medalsHtml = (p.medals || []).map((m) => `<span>${medalsMap[m] || m}</span>`).join(" ");
    row.innerHTML = `
      <div class="modal-player">
        <span class="name">${escapeHtml(p.player.name)}</span>
        <div class="medals">${medalsHtml}</div>
      </div>
      <div class="xp">+${p.xpEarned} XP</div>
    `;
    list.appendChild(row);
  });

  overlay.classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("modal-overlay").classList.add("hidden");
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") {
    document.getElementById("modal-overlay").classList.add("hidden");
  }
});

// ----- Matches list -----
async function refreshMatchesList() {
  const btn = document.getElementById("ml-refresh");
  setLoading(btn, true);
  try {
    const seasonId = document.getElementById("ml-season").value;
    const matches = await api.listMatches(seasonId);
    const container = document.getElementById("ml-list");
    container.innerHTML = "";
    if (!matches.length) {
      container.innerHTML = '<p class="muted" style="text-align:center;padding:2rem 0;">Aucun match enregistré.</p>';
      return;
    }
    for (const m of matches) {
      const card = document.createElement("div");
      card.className = "match-card";
      const when = new Date(m.playedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const sorted = [...m.participants].sort((a, b) => a.rank - b.rank);
      const lis = sorted
        .map((p) => {
          const detail = p.rank === 1 ? ` · Finition ${p.finishType}` : ` · Reste ${p.scoreLeft} pts`;
          const xp = `<span class="xp-gain plus">+${p.xpEarned} XP</span>`;
          const medalsMap = { POULIDOR: "🥈", JACKPOT: "🎰", EGALITE: "🤝", TUEUR_DE_GEANTS: "⚔️🏆" };
          const medalsHtml = (p.medals || []).map((m) => `<span class="medal-icon" title="${m}">${medalsMap[m] || m}</span>`).join("");
          return `<li><strong>${p.rank === 1 ? "🏆" : p.rank + "."}</strong> ${escapeHtml(p.player.name)}<span class="muted" style="font-size:0.8rem">${detail}</span> — ${xp}${medalsHtml}</li>`;
        })
        .join("");
      card.innerHTML = `
        <header>
          <div><strong>Match #${m.id}</strong> <span class="muted" style="font-size:0.8rem">${when}</span></div>
          <button class="muted small edit-match" data-id="${m.id}">Modifier</button>
        </header>
        <ul>${lis}</ul>
      `;
      card.querySelector(".edit-match").addEventListener("click", () => editMatch(m));
      container.appendChild(card);
    }
  } finally {
    setLoading(btn, false);
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
    if (p.rank === 1) row.querySelector(".p-finish").value = p.finishType;
    else row.querySelector(".p-score").value = p.scoreLeft;
  });

  document.querySelector('button[data-tab="match"]').click();
}

document.getElementById("ml-refresh").addEventListener("click", refreshMatchesList);

// ----- Leaderboard -----
async function refreshLeaderboard() {
  const btn = document.getElementById("lb-refresh");
  setLoading(btn, true);
  try {
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

    // Podium top 3
    const top3 = data.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    podium.innerHTML = podiumOrder
      .map((idx) => {
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
      })
      .join("");

    // Table rows — render first with width 0, then animate
    const bars = [];
    data.forEach((r, i) => {
      const nextLevelIdx = LEVELS.findIndex((l) => l.minXP > r.totalXP);
      const currentLevel = LEVELS[nextLevelIdx - 1] || LEVELS[LEVELS.length - 1];
      const nextLevel = LEVELS[nextLevelIdx];

      let progressPercent = 100;
      let xpRemaining = 0;
      let xpLabel = "Niveau Max !";

      if (nextLevel) {
        const range = nextLevel.minXP - currentLevel.minXP;
        const currentProgress = r.totalXP - currentLevel.minXP;
        progressPercent = Math.min(100, Math.floor((currentProgress / range) * 100));
        xpRemaining = nextLevel.minXP - r.totalXP;
        xpLabel = `${xpRemaining} XP avant ${nextLevel.title}`;
      }

      const levelSlug = r.level.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>
          <div class="lb-stats">
            <span>${r.matchCount} match${r.matchCount !== 1 ? "s" : ""}</span>
            <span class="lb-xp-total">${r.totalXP} XP</span>
          </div>
        </td>
        <td>${r.totalXP} XP</td>
        <td>
          <div class="xp-progress-bg">
            <div class="xp-progress-bar" data-pct="${progressPercent}" style="width:0%"></div>
          </div>
          <div class="xp-next-label">${xpLabel}</div>
        </td>
        <td><span class="level-badge level-${levelSlug}">${r.level}</span></td>
      `;
      tbody.appendChild(tr);
      bars.push(tr.querySelector(".xp-progress-bar"));
    });

    // Animate bars after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bars.forEach((bar) => {
          bar.style.width = bar.dataset.pct + "%";
        });
      });
    });
  } finally {
    setLoading(btn, false);
  }
}

function renderLevelsLegend() {
  const container = document.getElementById("levels-legend");
  if (!container) return;
  container.innerHTML = LEVELS.map((l, i) => {
    const next = LEVELS[i + 1];
    const range = next ? `${l.minXP} – ${next.minXP - 1} XP` : `${l.minXP}+ XP`;
    const slug = l.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return `
      <div class="level-card">
        <span class="level-badge level-${slug}">${l.title}</span>
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
  if (!seasonId) return showToast("Choisissez une saison", "err");
  const ok = await showConfirm("Recalculer tous les scores XP de cette saison avec les règles actuelles ?");
  if (!ok) return;
  const btn = document.getElementById("lb-recalculate");
  setLoading(btn, true);
  try {
    const res = await api.req(`/seasons/${seasonId}/recalculate`, { method: "POST" });
    showToast(`${res.matchesProcessed} matchs recalculés ✓`, "ok");
    await refreshLeaderboard();
  } catch (err) {
    showToast(err.message, "err");
  } finally {
    setLoading(btn, false);
  }
});

// ----- Tab show hooks -----
function onTabShow(tab) {
  if (tab === "leaderboard") {
    refreshLeaderboard();
    renderLevelsLegend();
  } else if (tab === "matches") {
    refreshMatchesList();
  } else if (tab === "match" && participantsEl.children.length === 0) {
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
  renderLevelsLegend();
})();
