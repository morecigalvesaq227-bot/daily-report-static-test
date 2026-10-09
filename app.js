const state = {
  index: null,
  report: null,
  date: null,
  category: "全部",
  query: "",
  selected: 0,
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date) {
  return date.replaceAll("-", " / ");
}

function shortWeekday(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(new Date(`${date}T00:00:00`))
    .toUpperCase();
}

function renderDates() {
  const reports = state.index.reports;
  $("#dates").innerHTML = reports
    .map(
      (report) => `
        <button class="date-btn ${report.date === state.date ? "active" : ""}" data-date="${report.date}">
          ${report.date.slice(5).replace("-", "/")}
          <small>${shortWeekday(report.date)}</small>
        </button>
      `,
    )
    .join("");
  document.querySelectorAll(".date-btn").forEach((button) => {
    button.addEventListener("click", () => loadReport(button.dataset.date));
  });
}

function renderHero() {
  const report = state.report.report;
  const topics = (report.topics || []).slice(0, 3);
  $(".today strong").textContent = formatDate(report.date);
  $(".ghost-day").textContent = report.date.slice(-2);
  $(".brief-copy h2").textContent = `${report.date} · 今日三大主题`;
  $(".topic-lines").innerHTML = topics
    .map(
      (topic) =>
        `<p><b>${escapeHtml(topic.source_type)}</b>${escapeHtml(topic.overview || topic.title)}</p>`,
    )
    .join("");
}

function renderFilters() {
  const articles = state.report.articles || [];
  const categories = ["全部", ...new Set(articles.map((article) => article.source_type))];
  $("#filters").innerHTML = categories
    .map((category) => {
      const count = category === "全部"
        ? articles.length
        : articles.filter((article) => article.source_type === category).length;
      return `<button class="filter ${category === state.category ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)} ${count}</button>`;
    })
    .join("");
  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.selected = 0;
      renderFilters();
      renderArticles();
    });
  });
}

function visibleArticles() {
  const query = state.query.toLowerCase();
  return (state.report.articles || []).filter((article) => {
    const categoryMatch = state.category === "全部" || article.source_type === state.category;
    const text = `${article.title} ${article.summary} ${article.source_name} ${article.topic}`.toLowerCase();
    return categoryMatch && text.includes(query);
  });
}

function renderReader(article) {
  if (!article) return;
  const interpretation = escapeHtml(article.interpretation || article.summary || "暂无拆解内容");
  const paragraphs = interpretation
    .split(/\n+/)
    .filter(Boolean)
    .map((paragraph) => `<p class="body">${paragraph}</p>`)
    .join("");
  $("#readerBody").innerHTML = `
    <p class="reader-meta"><span class="status-dot"></span>${escapeHtml(article.source_name)} · ${escapeHtml(article.source_type)}</p>
    <h2>${escapeHtml(article.title)}</h2>
    <p class="deck">${escapeHtml(article.summary || "")}</p>
    <hr>
    ${paragraphs || `<p class="body">暂无文章拆解。</p>`}
    <p class="static-note">原文：<a href="${escapeHtml(article.url || "#")}" target="_blank" rel="noopener">打开公众号原文</a></p>
  `;
}

function renderArticles() {
  const articles = visibleArticles();
  $("#resultCount").textContent = `共 ${articles.length} 篇 · ${state.date} 日报 · 静态数据同步`;
  $("#articleList").innerHTML = articles.length
    ? articles
        .map(
          (article, index) => `
            <article class="article ${index === state.selected ? "selected" : ""}" data-index="${index}" tabindex="0">
              <span class="number">${String(index + 1).padStart(2, "0")}</span>
              <span class="article-icon" style="--accent:${article.category === "AI" ? "#1687a7" : article.category === "债券" ? "#b43d31" : "#2c7a69"}">${escapeHtml((article.category || "文").slice(0, 1))}</span>
              <div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary || "")}</p></div>
              <span class="source">${escapeHtml(article.source)}<b>阅读预览</b></span>
            </article>
          `,
        )
        .join("")
    : '<div class="empty">没有匹配的文章</div>';

  document.querySelectorAll(".article").forEach((item) => {
    const show = () => {
      state.selected = Number(item.dataset.index);
      renderArticles();
      renderReader(visibleArticles()[state.selected]);
      $("#reader").classList.add("open");
    };
    item.addEventListener("click", show);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter") show();
    });
  });
  renderReader(articles[Math.min(state.selected, Math.max(articles.length - 1, 0))]);
}

async function loadReport(date) {
  const response = await fetch(`./data/reports/${date}.json`);
  if (!response.ok) throw new Error(`日报加载失败：${date}`);
  state.date = date;
  state.report = await response.json();
  state.category = "全部";
  state.query = "";
  state.selected = 0;
  $("#search").value = "";
  renderDates();
  renderHero();
  renderFilters();
  renderArticles();
  history.replaceState({}, "", `?date=${date}`);
}

async function boot() {
  const response = await fetch("./data/index.json");
  if (!response.ok) throw new Error("日报索引加载失败");
  state.index = await response.json();
  const requested = new URLSearchParams(location.search).get("date");
  const available = new Set(state.index.reports.map((report) => report.date));
  await loadReport(available.has(requested) ? requested : state.index.latestDate);
}

$("#search").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selected = 0;
  renderArticles();
});

boot().catch((error) => {
  $("#articleList").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});

