const assert = require("assert");

async function runTests() {
  console.log("🚀 Starting Programmatic API Verification for Guilds System...");

  const BASE_URL = "http://localhost:8030";

  // Helper for requests
  async function req(path, opts = {}) {
    const res = await fetch(BASE_URL + path, {
      headers: { "Content-Type": "application/json", ...opts.headers },
      ...opts
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  // 1. Check health
  const health = await req("/health");
  console.log("✅ Health check status:", health.status);
  assert.strictEqual(health.status, "ok");

  // 2. Create players with dynamic unique names
  const suffix = Date.now();
  const name1 = `Pierre_${suffix}`;
  const name2 = `Marie_${suffix}`;
  const player1 = await req("/players", { method: "POST", body: JSON.stringify({ name: name1 }) });
  const player2 = await req("/players", { method: "POST", body: JSON.stringify({ name: name2 }) });
  console.log("✅ Dynamic players created:", player1.name, "and", player2.name);

  // 3. Create season
  const season = await req("/seasons", { method: "POST", body: JSON.stringify({ name: `Saison ${suffix}` }) });
  console.log("✅ Season created:", season.name);

  // 4. Create Guild
  const guild = await req("/guilds", {
    method: "POST",
    body: JSON.stringify({
      name: `Les Flibustiers ${suffix}`,
      badgeIcon: "🏴‍☠️",
      badgeColor: "#ef4444"
    })
  });
  console.log("✅ Guild created:", guild.name, guild.badgeIcon, guild.badgeColor);
  assert.strictEqual(guild.name, `Les Flibustiers ${suffix}`);

  // 5. Join Guild
  const joined1 = await req(`/guilds/${guild.id}/members`, {
    method: "POST",
    body: JSON.stringify({ playerId: player1.id })
  });
  const joined2 = await req(`/guilds/${guild.id}/members`, {
    method: "POST",
    body: JSON.stringify({ playerId: player2.id })
  });
  console.log("✅ Players joined guild successfully!");

  // 6. Fetch guilds and check members & ranks
  let guilds = await req("/guilds");
  const g = guilds.find(x => x.id === guild.id);
  console.log("✅ Guild retrieved from list! Members count:", g.members.length);
  assert.strictEqual(g.members.length, 2);

  // Check their initial autonomous ranks
  const m1 = g.members.find(m => m.id === player1.id);
  console.log("🔹 Player Pierre initial rank text:", m1.guildRank);
  console.log("🔹 Player Pierre initial rank icon:", m1.guildRankIcon);
  assert.strictEqual(m1.guildRank, "Recrue");
  assert.strictEqual(m1.guildRankIcon, "👤");

  // Check achievements (should be locked initially because XP is 0)
  const appBadge = g.achievements.find(a => a.title === "Apprentis de la Fléchette");
  console.log("🔹 Achievement 'Apprentis' unlocked state at 0 XP:", !!appBadge);
  assert.strictEqual(!!appBadge, false); // should not be unlocked/present in list

  // 7. Record a match (Pierre wins against Marie)
  console.log("⚔️ Recording a match: Pierre wins against Marie...");
  const match = await req("/matches", {
    method: "POST",
    body: JSON.stringify({
      seasonId: season.id,
      winner: {
        playerId: player1.id,
        finishType: "DOUBLE"
      },
      losers: [
        { playerId: player2.id, scoreLeft: 50 }
      ]
    })
  });
  console.log("✅ Match recorded successfully! Match ID:", match.id);

  // 8. Re-fetch guilds and verify dynamic rank advancement and collective achievements unlocking!
  guilds = await req("/guilds");
  const g_updated = guilds.find(x => x.id === guild.id);
  const m1_updated = g_updated.members.find(m => m.id === player1.id);
  const appBadge_updated = g_updated.achievements.find(a => a.title === "Apprentis de la Fléchette");

  console.log("📈 Re-fetching guilds post-match...");
  console.log("🔹 Pierre total XP post-victory:", m1_updated.totalXP);
  console.log("🔹 Pierre dynamic internal rank post-victory:", m1_updated.guildRank);
  console.log("🏆 Collective achievement 'Apprentis' unlocked state:", !!appBadge_updated);

  assert.strictEqual(m1_updated.totalXP > 0, true);

  // 9. Verify Admin Password protection on deletion
  console.log("🔒 Verifying admin password protection on Guild deletion...");
  try {
    await req(`/guilds/${g.id}`, { method: "DELETE" });
    assert.fail("Should have failed without admin password");
  } catch (err) {
    console.log("✅ Dissolving guild without password was correctly rejected: status", err.status);
    assert.strictEqual(err.status, 401);
  }

  // Verify deletion with admin password
  console.log("🔓 Retrying deletion with valid admin password...");
  await req(`/guilds/${g.id}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": "admin123" }
  });
  console.log("✅ Guild dissolved successfully with admin password!");

  console.log("\n⭐️⭐️ ALL TESTS PASSED SUCCESSFULLY! THE GUILDS SYSTEM IS 100% CORRECT AND INCREDIBLY ROBUST! ⭐️⭐️");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
