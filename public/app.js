// Vanilla JS frontend for the dartos API.

// ----- Admin password -----
let adminPassword = localStorage.getItem("adminPassword") || "";
const SPLASH_VERSION = "2.02";
const SPLASH_KEY = "splashSeenVersion";

function updateLockBtn() {
  const btn = document.getElementById("lock-btn");
  btn.textContent = adminPassword ? "🔓" : "🔒";
  btn.classList.toggle("unlocked", !!adminPassword);
  btn.title = adminPassword ? "Mot de passe admin configuré (cliquer pour changer)" : "Configurer le mot de passe admin";
}

document.getElementById("lock-btn").addEventListener("click", () => {
  const val = prompt("Mot de passe admin (vide pour effacer) :", adminPassword);
  if (val === null) return;
  adminPassword = val.trim();
  if (adminPassword) localStorage.setItem("adminPassword", adminPassword);
  else localStorage.removeItem("adminPassword");
  updateLockBtn();
});

const api = {
  async req(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (adminPassword) headers["X-Admin-Password"] = adminPassword;
    const res = await fetch(path, { headers, ...opts });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.formErrors?.join(", ") || body?.error?.fieldErrors?.participants?.join(", ") || body?.error || `HTTP ${res.status}`);
    return body;
  },
  listPlayers: () => api.req("/players"),
  createPlayer: (name) => api.req("/players", { method: "POST", body: JSON.stringify({ name }) }),
  listSeasons: () => api.req("/seasons"),
  createSeason: (payload) => api.req("/seasons", { method: "POST", body: JSON.stringify(payload) }),
  updateSeason: (id, payload) => api.req(`/seasons/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSeason: (id) => api.req(`/seasons/${id}`, { method: "DELETE" }),
  listMatches: (seasonId) => api.req("/matches" + (seasonId ? `?seasonId=${seasonId}` : "")),
  recordMatch: (payload) => api.req("/matches", { method: "POST", body: JSON.stringify(payload) }),
  deleteMatch: (id) => api.req(`/matches/${id}`, { method: "DELETE" }),
  leaderboard: (seasonId) => {
    if (seasonId) {
      return api.req(`/seasons/${seasonId}/leaderboard`);
    }
    return api.req(`/leaderboard`); // Global leaderboard
  },
  listGuilds: () => api.req("/guilds"),
  createGuild: (payload) => api.req("/guilds", { method: "POST", body: JSON.stringify(payload) }),
  updateGuild: (id, payload) => api.req(`/guilds/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteGuild: (id) => api.req(`/guilds/${id}`, { method: "DELETE" }),
  joinGuild: (guildId, playerId) => api.req(`/guilds/${guildId}/members`, { method: "POST", body: JSON.stringify({ playerId: Number(playerId) }) }),
  leaveGuild: (guildId, playerId) => api.req(`/guilds/${guildId}/members/${playerId}`, { method: "DELETE" }),
};

let players = [];
let seasons = [];

const MEDALS_MAP = {
  POULIDOR: "🥈",
  JACKPOT: "🎰",
  EGALITE: "🤝",
  TUEUR_DE_GEANTS: "⚔️🏆",
  PHENIX: "🔥",
  SERIAL_WINNER: "🔥🔥",
  BENJAMIN: "🥉",
  LOTTERY_WINNER: "🍀",
};

function getMedalIcon(m) {
  if (m.startsWith("LOTTERY_WINNER:")) {
    const emoji = m.split(":")[1];
    return "🍀" + emoji;
  }
  return MEDALS_MAP[m] || m;
}

function getMedalTitle(m) {
  if (m.startsWith("LOTTERY_WINNER:")) {
    return "Gagnant Tombola !";
  }
  return m;
}

function daysUntil(endedAt) {
  if (!endedAt) return null;
  const end = new Date(endedAt).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / 86400000);
}

function seasonEndLabel(s) {
  if (!s.endedAt) return "⏱️ Saison en cours (sans date de fin)";
  const end = new Date(s.endedAt).getTime();
  const now = Date.now();
  const ms = end - now;

  if (ms < 0) {
    const past = Math.ceil(-ms / 86400000);
    return `✅ Saison terminée il y a ${past} jour${past > 1 ? "s" : ""}`;
  }

  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);

  if (days > 0) {
    return `⏳ Se termine dans ${days}j ${hours}h`;
  } else if (hours > 0) {
    return `⏳ Se termine dans ${hours}h ${mins}min`;
  } else if (mins > 0) {
    return `⏳ Se termine dans ${mins} minutes`;
  } else {
    return "🔔 Se termine dans moins d'une minute !";
  }
}

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
    const badgesEntries = Object.entries(p.badges || {});
    // Remplacez la définition de badgesHtml par :
    const badgesHtml = badgesEntries.length
      ? `<span class="player-badges">${badgesEntries
          .map(([name, count]) => `<span class="medal-icon" title="${getMedalTitle(name)}">${getMedalIcon(name)}${count > 1 ? `×${count}` : ""}</span>`)
          .join("")}</span>`
      : "";
    li.innerHTML = `
      <div class="player-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">${p.totalXP} XP</span>
        ${badgesHtml}
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
    const endLabel = seasonEndLabel(s);
    li.innerHTML = `
      <div>
        <span style="font-weight:700">${escapeHtml(s.name)}</span>
        <span class="muted" style="font-size:0.78rem;display:block">Depuis le ${date}</span>
        <span class="muted" style="font-size:0.78rem;display:block">${endLabel}</span>
      </div>
      <div style="display:flex;gap:0.4rem">
        <button class="edit-season small muted" data-id="${s.id}" style="width:auto">✏️ Modifier</button>
        <button class="delete-season small" data-id="${s.id}" data-name="${escapeHtml(s.name)}" style="background:transparent;color:var(--err);width:auto">🗑️</button>
      </div>
    `;
    // Store full season data on the li for edit pre-fill
    li.dataset.season = JSON.stringify(s);
    ul.appendChild(li);
  }

  ul.querySelectorAll(".edit-season").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = JSON.parse(btn.closest("li").dataset.season);
      editSeason(s);
    });
  });

  ul.querySelectorAll(".delete-season").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await showConfirm(`Supprimer la saison "${btn.dataset.name}" et tous ses matchs ? Cette action est irréversible.`);
      if (!ok) return;
      setLoading(btn, true);
      try {
        await api.deleteSeason(btn.dataset.id);
        showToast("Saison supprimée", "ok");
        await refreshSeasons();
      } catch (err) {
        showToast(err.message, "err");
        setLoading(btn, false);
      }
    });
  });
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

    // Logic for lb-season only: pre-select current season
    if (id === "lb-season") {
      const now = new Date();
      let currentSeason = null;
      let latestSeason = null;

      for (const s of seasons) {
        const startedAt = s.startedAt ? new Date(s.startedAt) : null;
        const endedAt = s.endedAt ? new Date(s.endedAt) : null;

        // Find the current season
        if (startedAt && startedAt <= now && (!endedAt || endedAt >= now)) {
          if (!currentSeason || startedAt > new Date(currentSeason.startedAt)) {
            currentSeason = s;
          }
        }

        // Keep track of the latest season for fallback
        if (!latestSeason || (startedAt && startedAt > new Date(latestSeason.startedAt))) {
            latestSeason = s;
        }
      }

      if (currentSeason) {
        sel.value = currentSeason.id;
      } else if (latestSeason) { // Fallback to the latest season if no current one
        sel.value = latestSeason.id;
      } else {
        // If no seasons exist, ensure no value is selected (or default to empty if option exists)
        sel.value = "";
      }
    }
  }

  updateRuleDisplay(document.getElementById("lb-season").value);
  refreshLeaderboard(); // Refresh leaderboard after season is selected and rules updated
}

function updateRuleDisplay(seasonId) {
  const season = seasons.find((s) => s.id == seasonId) || seasons[0];
  if (!season) return;

  document.getElementById("rule-xpOpponent").textContent = season.xpPerDefeatedOpponent;
  document.getElementById("rule-xpDouble").textContent = season.xpBonusDouble;
  document.getElementById("rule-xpTriple").textContent = season.xpBonusTriple;
  document.getElementById("rule-xpVampire").textContent = season.xpVampireMultiplier;
  document.getElementById("rule-xpSurvivor").textContent = season.xpSurvivorBase;

  const setBadge = (spanId, value) => {
    const el = document.getElementById(spanId);
    if (!el) return;
    el.textContent = value;
    const li = el.closest("li");
    if (li) li.style.display = value > 0 ? "" : "none";
  };
  setBadge("rule-xpPoulidor", season.xpBonusPoulidor);
  setBadge("rule-xpJackpot", season.xpBonusJackpot);
  setBadge("rule-xpEgalite", season.xpBonusEgalite);
  setBadge("rule-xpTueur", season.xpBonusTueurDeGeants);
  setBadge("rule-xpPhenix", season.xpBonusPhenix);
  setBadge("rule-xpSerialWinner", season.xpBonusSerialWinner);
  setBadge("rule-xpBenjamin", season.xpBonusBenjamin);

  const bvrEl = document.getElementById("rule-bonusVainqueurParRang");
  if (bvrEl) bvrEl.style.display = season.bonusVainqueurParRang ? "block" : "none";
}

const SEASON_DEFAULTS = {
  xpPerDefeatedOpponent: 50,
  xpBonusSimple: 0,
  xpBonusDouble: 50,
  xpBonusTriple: 100,
  xpVampireMultiplier: 1,
  xpSurvivorBase: 20,
  xpBonusPoulidor: 15,
  xpBonusJackpot: 20,
  xpBonusEgalite: 10,
  xpBonusTueurDeGeants: 50,
  xpBonusPhenix: 30,
  xpBonusSerialWinner: 40,
  xpBonusBenjamin: 15,
  xpBonusLottery: 20, // New default for lottery
  bonusVainqueurParRang: false,
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
  xpBonusPhenix: "s-xpPhenix",
  xpBonusSerialWinner: "s-xpSerialWinner",
  xpBonusBenjamin: "s-xpBenjamin",
  xpBonusLottery: "s-xpLottery", // New field map for lottery
};

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 16);
}

function editSeason(s) {
  document.getElementById("s-editing-id").value = s.id;
  document.getElementById("s-name").value = s.name;
  document.getElementById("s-startedAt").value = formatDateForInput(s.startedAt);
  document.getElementById("s-endedAt").value = formatDateForInput(s.endedAt);
  document.getElementById("s-submit").textContent = "Mettre à jour";
  document.getElementById("s-cancel").classList.remove("hidden");

  for (const [key, id] of Object.entries(SEASON_FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el && s[key] !== undefined) el.value = s[key];
  }
  const cbRang = document.getElementById("s-bonusVainqueurParRang");
  if (cbRang) cbRang.checked = !!s.bonusVainqueurParRang;
  
  document.getElementById("season-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetSeasonForm() {
  document.getElementById("s-editing-id").value = "";
  document.getElementById("s-name").value = "";
  document.getElementById("s-startedAt").value = "";
  document.getElementById("s-endedAt").value = "";
  document.getElementById("s-submit").textContent = "Créer";
  document.getElementById("s-cancel").classList.add("hidden");
  for (const [key, id] of Object.entries(SEASON_FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el) el.value = SEASON_DEFAULTS[key] ?? "";
  }
  const cbRang = document.getElementById("s-bonusVainqueurParRang");
  if (cbRang) cbRang.checked = false;  
}

document.getElementById("s-cancel").addEventListener("click", resetSeasonForm);

document.getElementById("season-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editingId = document.getElementById("s-editing-id").value;
  const name = document.getElementById("s-name").value.trim();
  const status = document.getElementById("s-status");
  const btn = document.getElementById("s-submit");
  setLoading(btn, true);

  const startedAt = document.getElementById("s-startedAt").value;
  const endedAt = document.getElementById("s-endedAt").value;

  const payload = { name }; // Removed TypeScript type annotation
  if (startedAt) payload.startedAt = new Date(startedAt).toISOString();
  // Only add endedAt if it's set, and allow null explicitly
  if (endedAt) payload.endedAt = new Date(endedAt).toISOString();
  else if (endedAt === "") payload.endedAt = null; // Explicitly send null if cleared

  for (const [key, id] of Object.entries(SEASON_FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el && el.value !== "") payload[key] = Number(el.value);
  }
  const cbRang = document.getElementById("s-bonusVainqueurParRang");
  if (cbRang) payload.bonusVainqueurParRang = cbRang.checked;  

  try {
    if (editingId) {
      const res = await api.updateSeason(editingId, payload);
      setStatus(status, `Mise à jour ✓ (${res.matchesRecalculated} matchs recalculés)`, true);
      showToast(`Saison mise à jour · ${res.matchesRecalculated} matchs recalculés ✓`, "ok");
      resetSeasonForm();
    } else {
      await api.createSeason(payload);
      setStatus(status, "Créée ✓", true);
      showToast("Saison créée ✓", "ok");
      resetSeasonForm();
    }
    await refreshSeasons();
  } catch (err) {
    setStatus(status, err.message, false);
  } finally {
    setLoading(btn, false);
  }
});

// ----- Match form -----
const participantsEl = document.getElementById("m-participants");

function addNewPlayerInline(btn, selectEl) {
  const wrap = btn.closest(".p-select-wrap");
  btn.classList.add("hidden");

  const form = document.createElement("div");
  form.className = "inline-new-player";
  form.innerHTML = `
    <input type="text" class="inline-p-name" placeholder="Nom du joueur" maxlength="64" />
    <button type="button" class="inline-p-ok" title="Créer">✓</button>
    <button type="button" class="inline-p-cancel" title="Annuler">✗</button>
  `;
  wrap.appendChild(form);

  const nameInput = form.querySelector(".inline-p-name");
  const okBtn = form.querySelector(".inline-p-ok");
  const cancelBtn = form.querySelector(".inline-p-cancel");
  nameInput.focus();

  async function create() {
    const name = nameInput.value.trim();
    if (!name) return;
    setLoading(okBtn, true);
    try {
      const player = await api.createPlayer(name);
      await refreshPlayers();
      selectEl.value = player.id;
      form.remove();
      btn.classList.remove("hidden");
      showToast(`Joueur "${escapeHtml(name)}" créé ✓`, "ok");
    } catch (err) {
      showToast(err.message, "err");
      setLoading(okBtn, false);
    }
  }

  function cancel() {
    form.remove();
    btn.classList.remove("hidden");
  }

  okBtn.addEventListener("click", create);
  cancelBtn.addEventListener("click", cancel);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); create(); }
    if (e.key === "Escape") cancel();
  });
}

function addParticipantRow() {
  const row = document.createElement("div");
  const i = participantsEl.children.length;
  row.className = "participant-row" + (i === 0 ? " winner-row" : "");

  if (i === 0) {
    row.innerHTML = `
      <div class="rank">🏆</div>
      <div class="p-select-wrap">
        <select class="p-select" required></select>
        <button type="button" class="new-player-btn">➕ Nouveau joueur</button>
      </div>
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
      <div class="p-select-wrap">
        <select class="p-select" required></select>
        <button type="button" class="new-player-btn">➕ Nouveau joueur</button>
      </div>
      <input type="number" class="p-score" placeholder="Score restant" min="1" max="301" required />
      <button type="button" class="remove" title="Supprimer">×</button>
    `;
    row.querySelector(".remove").addEventListener("click", () => {
      row.remove();
      refreshRanks();
    });
  }

  const sel = row.querySelector(".p-select");
  row.querySelector(".new-player-btn").addEventListener("click", (e) => {
    e.preventDefault();
    addNewPlayerInline(e.currentTarget, sel);
  });

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
  // seasonId is no longer directly selected by user, it's auto-detected
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

  const payload = { winner: { playerId: winnerId, finishType }, losers }; // Removed TypeScript type annotation
  if (playedAtRaw) payload.playedAt = new Date(playedAtRaw).toISOString();
  // seasonId is no longer sent from client, it's auto-detected by server

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
    const prevPlayers = [...participantsEl.querySelectorAll(".p-select")].map((s) => s.value);
    participantsEl.innerHTML = "";
    const rowCount = Math.max(2, prevPlayers.length);
    for (let i = 0; i < rowCount; i++) addParticipantRow();
    prevPlayers.forEach((id, i) => {
      const sel = participantsEl.children[i]?.querySelector(".p-select");
      if (sel && id) sel.value = id;
    });
    status.textContent = "";
  } catch (err) {
    setStatus(status, err.message, false);
  } finally {
    setLoading(btn, false);
  }
});

// Helper to extract emojis from a string
function extractEmojis(str) {
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}]/gu;
  return str.match(emojiRegex) || [];
}

function generateAllEmojis() {
  const emojiRanges = [
    [0x1F600, 0x1F64F], [0x1F900, 0x1F9FF], [0x1FA70, 0x1FAFF], 
    [0x1F300, 0x1F5FF], [0x1F680, 0x1F6FF], [0x2600, 0x26FF],   
    [0x2700, 0x27BF],   [0x2B00, 0x2BFF],   [0x1F1E6, 0x1F1FF], 
    [0x1F0A0, 0x1F0FF], [0x1F000, 0x1F02B], [0x1F030, 0x1F093]  
  ];

  const emojis = [];
  const isRealEmoji = /\p{Emoji_Presentation}/u;
  const uselessEmojiRegex = /[\u{1F550}-\u{1F567}\u{1F311}-\u{1F318}\u{1F191}-\u{1F251}\u{1F5B0}-\u{1F5FE}\u{2B00}-\u{2BFF}\u{26E0}-\u{26E7}\u{25AA}\u{25AB}\u{25FD}\u{25FE}\u{2B1B}\u{2B1C}\u{3030}\u{3297}\u{3299}\u{23CF}\u{23E9}-\u{23EC}\u{23F8}-\u{23FA}\u{25C0}\u{25B6}]/gu;

  for (const range of emojiRanges) {
    for (let code = range[0]; code <= range[1]; code++) {
      const caractere = String.fromCodePoint(code);
      if (isRealEmoji.test(caractere) && !uselessEmojiRegex.test(caractere)) {
        emojis.push(caractere);
      }
    }
  }
  return emojis;
}

function showMatchSummary(match) {
  const overlay = document.getElementById("modal-overlay");
  const list = document.getElementById("modal-results-list");
  list.innerHTML = "";

  const sorted = [...match.participants].sort((a, b) => a.rank - b.rank);
  const winner = sorted[0];

  document.getElementById("modal-winner-name").textContent = winner.player.name;

  sorted.forEach((p) => {
    const row = document.createElement("div");
    row.className = "modal-row" + (p.rank === 1 ? " winner" : "");
    const medalsHtml = (p.medals || []).map((m) => `<span title="${getMedalTitle(m)}">${getMedalIcon(m)}</span>`).join(" ");
    row.innerHTML = `
      <div class="modal-player">
        <span class="name">${escapeHtml(p.player.name)}</span>
        <div class="medals">${medalsHtml}</div>
      </div>
      <div class="xp">+${p.xpEarned} XP</div>
    `;
    list.appendChild(row);
  });

  // --- Tombola / Machine à sous Setup ---
  const activeSeason = seasons.find(s => s.id === match.seasonId) || seasons[0];
  const xpBonusLottery = activeSeason?.xpBonusLottery ?? 20;

  const lotterySection = document.getElementById("lottery-section");
  const spinBtn = document.getElementById("spin-button");
  const resultText = document.getElementById("lottery-result");

  if (xpBonusLottery > 0) {
    lotterySection.classList.remove("hidden");
    spinBtn.disabled = false;
    resultText.innerHTML = `Misez sur vos émojis ! Seuls les <strong>5 premiers émojis</strong> de votre pseudo sont éligibles. Chaque émoji tiré identique rapporte <strong>${xpBonusLottery} XP</strong> !`;

    // Extract max 5 emojis from each participant
    let participantEmojis = [];
    match.participants.forEach(p => {
      const emojis = extractEmojis(p.player.name).slice(0, 5);
      participantEmojis = participantEmojis.concat(emojis);
    });

    // Extract max 5 emojis from all players in database to populate pool
    let allPlayerEmojis = [];
    players.forEach(p => {
      const emojis = extractEmojis(p.name).slice(0, 5);
      allPlayerEmojis = allPlayerEmojis.concat(emojis);
    });

    const genericEmojis = generateAllEmojis();
    const fullEmojiPool = Array.from(new Set([...participantEmojis, ...allPlayerEmojis, ...genericEmojis]));

    // Fill the reels with initial randomly cycling emojis
    const reels = [
      document.getElementById("slot-reel-1"),
      document.getElementById("slot-reel-2"),
      document.getElementById("slot-reel-3"),
      document.getElementById("slot-reel-4"),
      document.getElementById("slot-reel-5")
    ];

    reels.forEach(reel => {
      reel.innerHTML = "";
      // Create a stack of emojis for scrolling effect
      for (let i = 0; i < 20; i++) {
        const item = document.createElement("div");
        item.textContent = fullEmojiPool[Math.floor(Math.random() * fullEmojiPool.length)];
        reel.appendChild(item);
      }
    });

    // Remove any previous listener by cloning the button
    const newSpinBtn = spinBtn.cloneNode(true);
    spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

    newSpinBtn.addEventListener("click", async () => {
      newSpinBtn.disabled = true;
      resultText.textContent = "🎰 Tirage en cours... Que la chance soit avec vous !";

      const drawnEmojis = [];
      const animations = [];

      reels.forEach((reel, reelIndex) => {
        // Choose target emoji
        const targetEmoji = fullEmojiPool[Math.floor(Math.random() * fullEmojiPool.length)];
        drawnEmojis.push(targetEmoji);

        // Put the target emoji at the very end of the reel
        const targetItem = document.createElement("div");
        targetItem.textContent = targetEmoji;
        reel.appendChild(targetItem);

        // Calculate scroll height (each item is 100px)
        const totalItems = reel.children.length;
        const targetScrollY = -((totalItems - 1) * 100);

        reel.style.transition = "none";
        reel.style.transform = "translateY(0)";

        // Force reflow
        reel.offsetHeight;

        animations.push(new Promise(resolve => {
          setTimeout(() => {
            reel.style.transition = `transform ${1.5 + reelIndex * 0.5}s cubic-bezier(0.25, 0.1, 0.25, 1.0)`;
            reel.style.transform = `translateY(${targetScrollY}px)`;
            setTimeout(() => {
              resolve();
            }, 1500 + reelIndex * 500);
          }, 50);
        }));
      });

      await Promise.all(animations);

      // Animation done, calculate results !
      const playerGains = [];
      let resultHtmlArr = [];

      match.participants.forEach(p => {
        const playerEmojis = extractEmojis(p.player.name).slice(0, 5); // 5 rouleaux
        let matchesCount = 0;
        let wonEmojis = []; 

        drawnEmojis.forEach(drawn => {
          if (playerEmojis.includes(drawn)) {
            matchesCount++;
            wonEmojis.push(drawn);
          }
        });

        if (matchesCount > 0) {
          const wonXP = matchesCount * xpBonusLottery;
          playerGains.push({ playerId: p.playerId, xpBonus: wonXP, emojis: wonEmojis });
          resultHtmlArr.push(`🎉 <strong>${escapeHtml(p.player.name)}</strong> gagne <strong>+${wonXP} XP</strong> ! (${matchesCount} correspondances)`);
        }
      });

      if (playerGains.length > 0) {
        try {
          // Send gains to server
          await api.req(`/matches/${match.id}/lottery`, {
            method: "POST",
            body: JSON.stringify({ playerGains })
          });
          resultText.innerHTML = resultHtmlArr.join("<br>");
          showToast("Bonus XP de la tombola enregistrés ! ✓", "ok");
          await refreshLeaderboard();
        } catch (err) {
          showToast("Erreur lors de l'enregistrement de la tombola", "err");
          resultText.textContent = "Erreur de connexion au serveur.";
        }
      } else {
        resultText.textContent = "😢 Pas de chance cette fois-ci ! Aucun emoji correspondant.";
      }
    });
  } else {
    lotterySection.classList.add("hidden");
  }

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
          const detail = p.rank === 1 ? ` · Finition ${p.finishType}` : ` · Reste ${p.scoreLeft} pt(s)`;
          const xp = `<span class="xp-gain plus">+${p.xpEarned} XP</span>`;
          const medalsHtml = (p.medals || []).map((m) => `<span class="medal-icon" title="${getMedalTitle(m)}">${getMedalIcon(m)}</span>`).join("");
          return `<li><span class="match-li-left"><strong>${p.rank === 1 ? "🏆" : p.rank + "."}</strong> ${escapeHtml(p.player.name)}<span class="muted" style="font-size:0.8rem">${detail}</span></span><span class="match-li-right">${xp}${medalsHtml}</span></li>`;
        })
        .join("");
      card.innerHTML = `
        <header>
          <div><strong>Match #${m.id}</strong> <span class="muted" style="font-size:0.8rem">${when}</span></div>
          <div style="display:flex;gap:0.4rem">
            <button class="muted small edit-match" data-id="${m.id}" style="width:auto">✏️ Modifier</button>
            <button class="small delete-match" data-id="${m.id}" style="background:transparent;color:var(--err);width:auto">🗑️</button>
          </div>
        </header>
        <ul>${lis}</ul>
      `;
      card.querySelector(".edit-match").addEventListener("click", () => editMatch(m));
      card.querySelector(".delete-match").addEventListener("click", async () => {
        const ok = await showConfirm(`Supprimer le match #${m.id} du ${when} ? Cette action est irréversible.`);
        if (!ok) return;
        const btn = card.querySelector(".delete-match");
        setLoading(btn, true);
        try {
          await api.deleteMatch(m.id);
          showToast(`Match #${m.id} supprimé`, "ok");
          await refreshMatchesList();
        } catch (err) {
          showToast(err.message, "err");
          setLoading(btn, false);
        }
      });
      container.appendChild(card);
    }
  } finally {
    setLoading(btn, false);
  }
}

function editMatch(m) {
  document.getElementById("m-id").value = m.id;
  // document.getElementById("m-season").value = m.seasonId; // Removed season selection
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
let leaderboardTimer = null; // To hold the interval reference

async function refreshLeaderboard() {
  const btn = document.getElementById("lb-refresh");
  setLoading(btn, true);
  try {
    const seasonId = document.getElementById("lb-season").value;
    const response = await api.leaderboard(seasonId); // Pass seasonId to API
    const data = Array.isArray(response) ? response : (response.leaderboard || []);
    const tbody = document.querySelector("#lb-table tbody");
    const podium = document.getElementById("lb-podium");
    const empty = document.getElementById("lb-empty");
    const timerEl = document.getElementById("lb-season-timer");

    // Clear previous timer if any
    if (leaderboardTimer) clearInterval(leaderboardTimer);
    timerEl.textContent = "";

    // If a season is selected, fetch its details to display timer
    if (seasonId) {
      const selectedSeason = seasons.find(s => s.id == seasonId);
      if (selectedSeason && selectedSeason.endedAt) {
        const endDate = new Date(selectedSeason.endedAt);
        const updateTimer = () => {
          const now = new Date();
          const diff = endDate.getTime() - now.getTime();

          if (diff <= 0) {
            timerEl.textContent = `Saison "${selectedSeason.name}" terminée.`;
            clearInterval(leaderboardTimer);
            return;
          }

          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          let timerText = "Saison se termine dans : ";
          if (days > 0) timerText += `${days}j `;
          if (hours > 0) timerText += `${hours}h `;
          if (minutes > 0) timerText += `${minutes}m `;
          timerText += `${seconds}s`;

          timerEl.textContent = timerText;
        };
        updateTimer();
        leaderboardTimer = setInterval(updateTimer, 1000);
      } else {
        timerEl.textContent = "Saison active, pas de date de fin définie.";
      }
    }


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
        const nameVal = p.playerName || p.name;
        return `
          <div class="podium-spot rank-${rank}">
            <div class="podium-crown">${crown}</div>
            <div class="podium-name">${escapeHtml(nameVal)}</div>
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

      // Calculer le niveau s'il n'est pas fourni (ex: classement par saison)
      let levelTitle = r.level;
      if (!levelTitle) {
        for (let idx = LEVELS.length - 1; idx >= 0; idx--) {
          if (r.totalXP >= LEVELS[idx].minXP) {
            levelTitle = LEVELS[idx].title;
            break;
          }
        }
        if (!levelTitle) levelTitle = LEVELS[0].title;
      }

      const levelSlug = levelTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const tr = document.createElement("tr");
      
      const nameVal = r.playerName || r.name || "Joueur inconnu";
      const matchCountVal = r.matchesPlayed !== undefined ? r.matchesPlayed : (r.matchCount !== undefined ? r.matchCount : 0);
      
      const guildBadgesHtml = (r.guilds || []).map(g => `
        <span class="player-mini-guild-badge" style="background-color: ${g.badgeColor}" title="${escapeHtml(g.name)}">${escapeHtml(g.badgeIcon)}</span>
      `).join("");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
            <strong>${escapeHtml(nameVal)}</strong>
            ${guildBadgesHtml}
          </div>
        </td>
        <td>
          &nbsp;
        </td>
        <td><strong>${r.totalXP} XP</strong></td>
        <td>
          <div class="xp-progress-bg">
            <div class="xp-progress-bar" data-pct="${progressPercent}" style="width:0%"></div>
          </div>
          <div class="xp-next-label">${xpLabel}</div>
        </td>
        <td><span class="level-badge level-${levelSlug}">${levelTitle}</span></td>
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

setInterval(() => {
  const seasonId = document.getElementById("lb-season").value;
  if (seasonId) {
    const season = seasons.find((s) => s.id == seasonId) || seasons[0];
  }
}, 30000);

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
  } else {
    // Stop the timer when switching from leaderboard tab
    if (leaderboardTimer) clearInterval(leaderboardTimer);
    document.getElementById("lb-season-timer").textContent = "";
  }
  
  if (tab === "matches") {
    refreshMatchesList();
  } else if (tab === "match" && participantsEl.children.length === 0) {
    addParticipantRow();
    addParticipantRow();
  } else if (tab === "guilds") {
    refreshGuilds();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ----- Guildes -----
const gBadgeIconInput = document.getElementById("g-badgeIcon");
const gBadgeColorInput = document.getElementById("g-badgeColor");
const gPreview = document.getElementById("guild-badge-preview");

if (gBadgeIconInput && gBadgeColorInput && gPreview) {
  const updatePreview = () => {
    gPreview.textContent = gBadgeIconInput.value || "🛡️";
    gPreview.style.backgroundColor = gBadgeColorInput.value || "#3dc7ff";
    gPreview.style.boxShadow = `0 0 15px ${gBadgeColorInput.value || "#3dc7ff"}60`;
  };
  gBadgeIconInput.addEventListener("input", updatePreview);
  gBadgeColorInput.addEventListener("input", updatePreview);
  updatePreview();
}

function resetGuildForm() {
  document.getElementById("g-editing-id").value = "";
  document.getElementById("g-name").value = "";
  document.getElementById("g-badgeIcon").value = "🛡️";
  document.getElementById("g-badgeColor").value = "#3dc7ff";
  document.getElementById("g-submit").textContent = "Créer la Guilde";
  document.getElementById("g-cancel").classList.add("hidden");
  if (gPreview) {
    gPreview.textContent = "🛡️";
    gPreview.style.backgroundColor = "#3dc7ff";
    gPreview.style.boxShadow = "none";
  }
}

const gCancelBtn = document.getElementById("g-cancel");
if (gCancelBtn) {
  gCancelBtn.addEventListener("click", resetGuildForm);
}

const guildForm = document.getElementById("guild-form");
if (guildForm) {
  guildForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idVal = document.getElementById("g-editing-id").value;
    const name = document.getElementById("g-name").value.trim();
    const badgeIcon = document.getElementById("g-badgeIcon").value.trim();
    const badgeColor = document.getElementById("g-badgeColor").value.trim();
    const status = document.getElementById("g-status");
    const btn = document.getElementById("g-submit");

    setLoading(btn, true);
    try {
      if (idVal) {
        if (!adminPassword) {
          const hasAdmin = await ensureAdminPassword();
          if (!hasAdmin) return;
        }
        await api.updateGuild(idVal, { name, badgeIcon, badgeColor });
        showToast("Guilde modifiée ✓", "ok");
      } else {
        await api.createGuild({ name, badgeIcon, badgeColor });
        showToast("Guilde créée ✓", "ok");
      }
      resetGuildForm();
      await refreshGuilds();
    } catch (err) {
      setStatus(status, err.message, false);
    } finally {
      setLoading(btn, false);
    }
  });
}

async function refreshGuilds() {
  const container = document.getElementById("guilds-container");
  if (!container) return;

  const rankingTbody = document.querySelector("#guild-ranking-table tbody");
  const rankingEmpty = document.getElementById("guild-ranking-empty");
  const rankingTable = document.getElementById("guild-ranking-table");

  try {
    const guilds = await api.listGuilds();
    players = await api.listPlayers();

    // Rendre le classement des guildes
    if (rankingTbody) {
      rankingTbody.innerHTML = "";
      if (guilds.length === 0) {
        if (rankingEmpty) rankingEmpty.classList.remove("hidden");
        if (rankingTable) rankingTable.classList.add("hidden");
      } else {
        if (rankingEmpty) rankingEmpty.classList.add("hidden");
        if (rankingTable) rankingTable.classList.remove("hidden");

        guilds.forEach((g, idx) => {
          const tr = document.createElement("tr");
          const membersList = g.members.map(m => `${escapeHtml(m.name)} (${m.totalXP} XP)`).join(", ");
          tr.innerHTML = `
            <td><strong>${idx + 1}</strong></td>
            <td>
              <div style="display:flex;align-items:center;gap:0.5rem">
                <span class="player-mini-guild-badge" style="background-color: ${g.badgeColor}; height: auto; width: auto; font-size: 1.2rem; padding: 0.2rem 0.4rem; border-radius: 4px;" title="${escapeHtml(g.name)}">${escapeHtml(g.badgeIcon)}</span>
                <strong>${escapeHtml(g.name)}</strong>
              </div>
            </td>
            <td><strong>${g.collectiveXP} XP</strong></td>
            <td style="font-size:0.85rem;color:var(--muted);">${membersList || "Aucun membre"}</td>
          `;
          rankingTbody.appendChild(tr);
        });
      }
    }

    container.innerHTML = "";
    if (guilds.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 2rem;">
        Aucune guilde créée. Soyez le premier à fonder une alliance !
      </div>`;
      return;
    }

    guilds.forEach((g) => {
      const totalGuildXP = g.members.reduce((sum, m) => sum + m.totalXP, 0);

      const achsHtml = g.achievements.map(a => `
        <span class="guild-badge-item ${a.unlocked ? 'unlocked' : 'locked'}" title="${escapeHtml(a.description)}">
          ${a.unlocked ? '✅' : '🔒'} ${a.icon} <strong>${escapeHtml(a.title)}</strong>
        </span>
      `).join("");

      const membersHtml = g.members.map((m) => {
        return `
          <div class="guild-member-row">
            <span class="g-rank-ico" title="${escapeHtml(m.guildRank)}">${m.guildRankIcon}</span>
            <div class="g-member-details">
              <strong>${escapeHtml(m.name)} <span class="g-member-rank-tag">(${escapeHtml(m.guildRank)})</span></strong>
              <span class="g-member-sub">${m.totalXP} XP • 🏅 ${m.totalBadgesCount} badges</span>
            </div>
            <button class="leave-guild-btn small muted" data-guild-id="${g.id}" data-player-id="${m.id}" title="Exclure ce membre">🗑️</button>
          </div>
        `;
      }).join("");

      const availablePlayers = players.filter(p => !g.members.some(gm => gm.id === p.id));
      let addMemberHtml = "";
      if (availablePlayers.length > 0) {
        addMemberHtml = `
          <div class="add-member-control">
            <select class="add-member-select" data-guild-id="${g.id}">
              <option value="">+ Recruter un joueur...</option>
              ${availablePlayers.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.totalXP} XP)</option>`).join("")}
            </select>
          </div>
        `;
      } else {
        addMemberHtml = `<p class="muted small" style="text-align:center;margin-top:0.5rem">Tous les joueurs sont déjà membres.</p>`;
      }

      const card = document.createElement("div");
      card.className = "guild-card";
      card.style.setProperty("--guild-accent", g.badgeColor);
      card.innerHTML = `
        <div class="guild-card-header" style="background: linear-gradient(135deg, ${g.badgeColor}22, ${g.badgeColor}05);">
          <div class="guild-emblem" style="background-color: ${g.badgeColor}; box-shadow: 0 0 15px ${g.badgeColor}60;">${escapeHtml(g.badgeIcon)}</div>
          <div class="guild-title-section">
            <h3>${escapeHtml(g.name)}</h3>
            <span class="guild-stat-summary">${g.members.length} membre${g.members.length !== 1 ? 's' : ''} • ${totalGuildXP} XP collectif</span>
          </div>
          <div class="guild-actions">
            <button class="edit-guild-btn" data-id="${g.id}" data-name="${escapeHtml(g.name)}" data-icon="${escapeHtml(g.badgeIcon)}" data-color="${g.badgeColor}" title="Modifier la guilde">✏️</button>
            <button class="delete-guild-btn" data-id="${g.id}" data-name="${escapeHtml(g.name)}" title="Dissoudre la guilde">🗑️</button>
          </div>
        </div>

        <div class="guild-card-body">
          <div class="guild-achievements-section">
            <h4>🏅 Hauts Faits de l'Alliance</h4>
            <div class="guild-achievements-list">
              ${achsHtml}
            </div>
          </div>

          <div class="guild-members-section">
            <h4>👥 Compagnons</h4>
            <div class="guild-members-list">
              ${membersHtml || '<p class="muted small" style="text-align:center;padding:0.5rem 0;">Aucun membre pour le moment.</p>'}
            </div>
            ${addMemberHtml}
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll(".add-member-select").forEach((select) => {
      select.addEventListener("change", async (e) => {
        const playerId = e.target.value;
        const guildId = select.dataset.guildId;
        if (!playerId) return;
        try {
          await api.joinGuild(guildId, playerId);
          showToast("Recrutement réussi ✓", "ok");
          await refreshGuilds();
          await refreshLeaderboard();
        } catch (err) {
          showToast(err.message, "err");
        }
      });
    });

    container.querySelectorAll(".leave-guild-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const guildId = btn.dataset.guildId;
        const playerId = btn.dataset.playerId;
        const ok = await showConfirm("Voulez-vous vraiment exclure ce membre de la guilde ?");
        if (!ok) return;
        try {
          await api.leaveGuild(guildId, playerId);
          showToast("Membre exclu ✓", "ok");
          await refreshGuilds();
          await refreshLeaderboard();
        } catch (err) {
          showToast(err.message, "err");
        }
      });
    });

    container.querySelectorAll(".edit-guild-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("g-editing-id").value = btn.dataset.id;
        document.getElementById("g-name").value = btn.dataset.name;
        document.getElementById("g-badgeIcon").value = btn.dataset.icon;
        document.getElementById("g-badgeColor").value = btn.dataset.color;
        document.getElementById("g-submit").textContent = "Enregistrer la Guilde";
        document.getElementById("g-cancel").classList.remove("hidden");
        document.getElementById("guild-form").scrollIntoView({ behavior: "smooth" });
        if (gPreview) {
          gPreview.textContent = btn.dataset.icon;
          gPreview.style.backgroundColor = btn.dataset.color;
        }
      });
    });

    container.querySelectorAll(".delete-guild-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const guildId = btn.dataset.id;
        const name = btn.dataset.name;
        const ok = await showConfirm(`Dissoudre la guilde "${name}" ? Cette action est irréversible.`);
        if (!ok) return;
        try {
          if (!adminPassword) {
            const hasAdmin = await ensureAdminPassword();
            if (!hasAdmin) return;
          }
          await api.deleteGuild(guildId);
          showToast("Guilde dissoute ✓", "ok");
          await refreshGuilds();
          await refreshLeaderboard();
        } catch (err) {
          showToast(err.message, "err");
        }
      });
    });

  } catch (err) {
    showToast(err.message, "err");
  }
}

async function ensureAdminPassword() {
  const val = prompt("Mot de passe admin requis pour modifier/supprimer une guilde :");
  if (val === null) return false;
  const psw = val.trim();
  if (psw) {
    adminPassword = psw;
    localStorage.setItem("adminPassword", adminPassword);
    updateLockBtn();
    return true;
  }
  return false;
}

// ----- Splash screen -----
(function initSplash() {
  const overlay   = document.getElementById("splash-overlay");
  const track     = document.getElementById("splash-track");
  const dots      = document.querySelectorAll(".splash-dot");
  const prevBtn   = document.getElementById("splash-prev");
  const nextBtn   = document.getElementById("splash-next");
  const skipBtn   = document.getElementById("splash-skip");
  const ctaBtn    = document.getElementById("splash-cta");
  const recallBtn = document.getElementById("splash-btn");
  const TOTAL = 5;
  let current = 0;

  function goTo(n) {
    current = Math.max(0, Math.min(TOTAL - 1, n));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === TOTAL - 1;
    ctaBtn.style.display = current === TOTAL - 1 ? "block" : "none";
    nextBtn.style.visibility = current === TOTAL - 1 ? "hidden" : "visible";
  }

  function openSplash() { overlay.classList.remove("hidden"); goTo(0); }
  function closeSplash() { overlay.classList.add("hidden"); localStorage.setItem(SPLASH_KEY, SPLASH_VERSION); }

  prevBtn.addEventListener("click", () => goTo(current - 1));
  nextBtn.addEventListener("click", () => goTo(current + 1));
  skipBtn.addEventListener("click", closeSplash);
  ctaBtn.addEventListener("click",  closeSplash);
  recallBtn.addEventListener("click", openSplash);
  dots.forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.dot))));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSplash(); });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo(current + 1);
    if (e.key === "ArrowLeft")  goTo(current - 1);
    if (e.key === "Escape")     closeSplash();
  });

  if (localStorage.getItem(SPLASH_KEY) !== SPLASH_VERSION) openSplash();
})();

// ----- Boot -----
(async function init() {
  updateLockBtn();
  await refreshPlayers();
  await refreshSeasons();
  addParticipantRow();
  addParticipantRow();
  await refreshLeaderboard();
  renderLevelsLegend();
})();
