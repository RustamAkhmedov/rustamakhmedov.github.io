(() => {
  const USER = "rustamakhmedov";
  const HOST = `${USER}.github.io`;
  const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`;
  const CACHE_KEY = "pages-projects-v1";
  const CACHE_TTL = 10 * 60 * 1000; // schont das anonyme API-Limit (60/h)

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function loadProjects() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.t < CACHE_TTL) return cached.data;
    } catch {}

    const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const repos = await res.json();

    const data = repos
      .filter((r) => r.has_pages && !r.fork && !r.archived && r.name.toLowerCase() !== HOST)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        updated: r.pushed_at,
        repo: r.html_url,
        // eigene Domain (falls gesetzt) sonst Standard-Pages-URL
        url: r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : `https://${HOST}/${r.name}/`,
      }));

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch {}
    return data;
  }

  const LANG_COLORS = { JavaScript: "#f1e05a", TypeScript: "#3178c6", HTML: "#e34c26", CSS: "#a855f7", Java: "#b07219", Python: "#3572a5", Kotlin: "#a97bff", "C#": "#178600", "C++": "#f34b7d", Go: "#00add8", Rust: "#dea584", Shell: "#89e051" };

  // stabile Farbe pro Projekt aus dem Namen
  const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  function card(p, i = 0) {
    const date = new Date(p.updated).toLocaleDateString("de-DE", { year: "numeric", month: "short", day: "numeric" });
    const color = LANG_COLORS[p.language] || "#8b8bff";
    return `<a class="card" style="--i:${Math.min(i, 12)};--h:${hue(p.name)}" href="${esc(p.url)}">
      <h2>${esc(p.name)} <span class="arrow" aria-hidden="true">↗</span></h2>
      <p>${esc(p.description) || "Keine Beschreibung"}</p>
      <div class="meta">
        ${p.language ? `<span><i class="dot" style="background:${color}"></i>${esc(p.language)}</span>` : ""}
        ${p.stars ? `<span>★ ${p.stars}</span>` : ""}
        <span>${esc(date)}</span>
      </div>
      <span class="gh">${esc(p.repo.replace("https://", ""))}</span>
    </a>`;
  }

  function render(list, target) {
    const count = $("#count");
    if (count) count.textContent = `${list.length} Projekt${list.length === 1 ? "" : "e"}`;
    target.innerHTML = list.length
      ? list.map((p, i) => card(p, i)).join("")
      : `<div class="state">Keine Projekte gefunden.</div>`;
  }

  // Levenshtein-Distanz für Tippfehler-Vorschläge
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  async function init() {
    const grid = $("#projects");
    const is404 = document.body.dataset.page === "404";
    let projects;
    try {
      projects = await loadProjects();
    } catch (e) {
      grid.innerHTML = `<div class="state">Projekte konnten nicht geladen werden (${esc(e.message)}). Bitte später erneut versuchen oder direkt auf
        <a href="https://github.com/${USER}">github.com/${USER}</a> nachsehen.</div>`;
      return;
    }

    if (is404) {
      const segment = decodeURIComponent(location.pathname.split("/").filter(Boolean)[0] || "");
      const wanted = segment.toLowerCase();
      const notice = $("#notice");
      if (wanted) {
        // Exakter Treffer (nur Groß-/Kleinschreibung falsch) -> direkt weiterleiten
        const exact = projects.find((p) => p.name.toLowerCase() === wanted);
        if (exact && exact.name !== segment && exact.url.startsWith(`https://${HOST}/`)) {
          location.replace(exact.url + location.pathname.split("/").slice(2).join("/") + location.search + location.hash);
          return;
        }
        const similar = projects
          .map((p) => ({ p, s: p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase()) ? 0 : dist(wanted, p.name.toLowerCase()) }))
          .filter((x) => x.s <= Math.max(2, Math.floor(wanted.length / 3)))
          .sort((a, b) => a.s - b.s)
          .slice(0, 3);
        notice.hidden = false;
        notice.innerHTML = `<strong>Die Seite „/${esc(wanted)}“ gibt es nicht.</strong>
          ${similar.length
            ? `Meintest du:<ul>${similar.map(({ p }) => `<li><a href="${esc(p.url)}">${esc(p.name)}</a></li>`).join("")}</ul>`
            : "Hier sind alle verfügbaren Projekte:"}`;
      }
    }

    render(projects, grid);

    const search = $("#search");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        render(projects.filter((p) => `${p.name} ${p.description || ""} ${p.language || ""}`.toLowerCase().includes(q)), grid);
      });
    }
  }

  init();
})();
