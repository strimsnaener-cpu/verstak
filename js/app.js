/* Верстак — роутер, каталог, темы */
(function () {
  "use strict";
  const { h, $, $$, esc, store } = window.U;
  const TOOLS = window.TOOLS;
  const app = $("#app");

  const CATS = {
    all: "Все", fav: "Избранное", images: "Картинки", text: "Текст", productivity: "Продуктивность",
    security: "Безопасность", calc: "Калькуляторы", dev: "Для сайтов", web: "Веб", fun: "Развлечения",
  };
  // буквенные метки вместо эмодзи — как маркировка на инструменте
  const MONO = {
    "image-compress": "IMG", qr: "QR", password: "***", "word-count": "123", "text-clean": "Aa", json: "{ }", minify: "</>",
    units: "м↔ft", typing: "WPM", pomodoro: "25:00", colors: "#HEX", "pc-optimize": "PC↑", encode: "B64", percent: "%",
    "screen-test": "RGB", random: "?!", dates: "DD.MM", notes: "TXT", reaction: "ms", nickname: "@",
  };
  const mono = (t) => MONO[t.id] || t.name.slice(0, 2);
  const PROJECTS = [
    ["kvadrat", "Квадрат", "Мастерская: обложки, сайты и оформление на заказ"],
    ["apgreyd", "Апгрейд", "Программы: ускорение ПК, трекер привычек, таймер учёбы. Бесплатно — драйверы и ускорение телефона"],
    ["zubrilka", "Зубрилка", "Карточки для учёбы с умным повторением"],
    ["kopilka", "Копилка", "Учёт карманных денег и цели накоплений"],
    ["rezume", "Резюме за 5 минут", "Конструктор резюме с шаблонами и PDF"],
    ["prevyu", "Превьюшка", "Обложки для YouTube, TikTok и Instagram"],
    ["orbita", "Орбита", "Аркада в браузере, работает на телефоне"],
  ];
  const projUrl = (id) => `https://strimsnaener-cpu.github.io/${id}/`;
  let cleanup = null;
  const state = { cat: "all", q: "" };

  // ---------- тема ----------
  const root = document.documentElement;
  $("#themeBtn").onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  };
  $("#year").textContent = new Date().getFullYear();

  // ---------- избранное / недавние ----------
  const favs = () => store.get("favs", []);
  const toggleFav = (id) => { const f = favs(); const i = f.indexOf(id); i >= 0 ? f.splice(i, 1) : f.push(id); store.set("favs", f); return i < 0; };
  const pushRecent = (id) => { const r = store.get("recent", []).filter((x) => x !== id); r.unshift(id); store.set("recent", r.slice(0, 6)); };
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");
  const matches = (t, q) => !q || norm(t.name + " " + t.desc + " " + t.tags).includes(norm(q));

  const card = (t) => {
    const fav = favs().includes(t.id);
    return `<a class="tool-card" href="#/tool/${t.id}">${t.hot ? '<span class="badge">ТОП</span>' : ""}
      <button class="fav ${fav ? "on" : ""}" data-fav="${t.id}" title="В избранное" aria-label="В избранное">${fav ? "★" : "☆"}</button>
      <span class="ico">${esc(mono(t))}</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></a>`;
  };
  const projectsBlock = () => `<section class="projects"><h2>Другие мои сайты</h2><p>Тоже бесплатные и без регистрации.</p>
    <div class="proj">${PROJECTS.map(([id, n, d]) => `<a href="${projUrl(id)}"><i>${id}.github.io</i><b>${n}</b><small>${d}</small></a>`).join("")}</div></section>`;

  // ---------- страницы ----------
  function home() {
    document.title = "Верстак — бесплатные онлайн-инструменты";
    app.innerHTML = "";
    app.append(h(`<section class="hero">
      <h1>Инструменты на&nbsp;каждый день. <mark>Бесплатно</mark>, прямо в&nbsp;браузере.</h1>
      <div><p>Сожми фото, сделай QR-код, ускорь компьютер или проверь пароль. Ничего не нужно скачивать, файлы не покидают твоё устройство.</p>
      <div class="search"><input id="q" type="text" placeholder="Что нужно сделать? Например: сжать фото" autocomplete="off" aria-label="Поиск инструмента"><kbd>/</kbd></div>
      <div class="facts"><span><b>${TOOLS.length}</b> инструментов</span><span><b>0</b> регистраций</span><span><b>0</b> загрузок на сервер</span></div></div>
    </section>`));
    const wrap = h(`<div class="home"><nav class="side" id="side" aria-label="Категории"><p class="lbl">Категории</p></nav><div id="main"></div></div>`);
    app.append(wrap);
    Object.entries(CATS).forEach(([k, v]) => {
      const n = k === "all" ? TOOLS.length : k === "fav" ? favs().length : TOOLS.filter((t) => t.cat === k).length;
      if (k !== "all" && k !== "fav" && !n) return;
      const b = h(`<button class="${state.cat === k ? "on" : ""}" data-cat="${k}">${v}<span>${n}</span></button>`);
      b.onclick = () => { state.cat = k; $$("#side button").forEach((c) => c.classList.toggle("on", c === b)); renderGrid(); };
      $("#side").append(b);
    });
    const recent = store.get("recent", []).map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean);
    if (recent.length) $("#main").append(h(`<div class="recent"><span class="lbl">Недавние</span>${recent.map((t) => `<a href="#/tool/${t.id}">${esc(t.name)}</a>`).join("")}</div>`));
    $("#main").append(h(`<div class="grid" id="grid"></div>`));
    app.append(h(projectsBlock()));
    const q = $("#q"); q.value = state.q;
    q.oninput = () => { state.q = q.value; renderGrid(); };
    q.onkeydown = (e) => { if (e.key === "Enter") { const first = $("#grid .tool-card"); if (first) location.hash = first.getAttribute("href"); } };
    renderGrid();
  }

  function renderGrid() {
    const grid = $("#grid"); if (!grid) return;
    const f = favs();
    let list = TOOLS.filter((t) => matches(t, state.q));
    if (state.cat === "fav") list = list.filter((t) => f.includes(t.id));
    else if (state.cat !== "all") list = list.filter((t) => t.cat === state.cat);
    grid.innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty">${state.cat === "fav" ? "Нажми ☆ на карточке, чтобы добавить инструмент в избранное." : "Ничего не нашлось. Попробуй другое слово, например «фото» или «пароль»."}</div>`;
  }

  function toolPage(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) return notFound();
    document.title = t.name + " — Верстак";
    pushRecent(id);
    app.innerHTML = "";
    app.append(h(`<a class="back" href="#/">← все инструменты</a>`));
    const fav = favs().includes(id);
    app.append(h(`<div class="tool-head"><span class="ico">${esc(mono(t))}</span><div style="flex:1;min-width:200px"><h1>${esc(t.name)}</h1><p>${esc(t.desc)}</p></div>
      <button class="btn ghost" id="favBtn">${fav ? "★ В избранном" : "☆ В избранное"}</button></div>`));
    $("#favBtn").onclick = (e) => { const on = toggleFav(id); e.currentTarget.textContent = on ? "★ В избранном" : "☆ В избранное"; };
    const body = h(`<div class="tool-body"></div>`);
    app.append(body);
    try { cleanup = t.render(body) || null; }
    catch (e) { body.innerHTML = `<div class="panel err">Ошибка инструмента: ${esc(e.message)}</div>`; console.error(e); }
    const more = TOOLS.filter((x) => x.id !== id && x.cat === t.cat).concat(TOOLS.filter((x) => x.id !== id && x.cat !== t.cat && x.hot)).slice(0, 4);
    app.append(h(`<section class="block"><h2 style="margin-bottom:16px">Ещё может пригодиться</h2><div class="grid">${more.map(card).join("")}</div></section>`));
    scrollTo(0, 0);
  }

  function trends() {
    document.title = "Тренды — Верстак";
    const link = (id) => { const t = TOOLS.find((x) => x.id === id); return t ? `<a href="#/tool/${id}">${esc(t.name)} →</a>` : ""; };
    const blocks = [
      ["Работа с картинками", "Фото с телефонов весят по 3–10 МБ, а сайты, школьные платформы и мессенджеры просят меньше. Сжатие и перевод в WebP — одна из самых частых задач в интернете.", ["image-compress", "colors"]],
      ["Ускорение компьютера", "«Компьютер тормозит» — вечный запрос. Платные «оптимизаторы» часто бесполезны или опасны, а встроенные средства Windows 11 решают большинство проблем бесплатно.", ["pc-optimize", "screen-test"]],
      ["Безопасность аккаунтов", "Утечки паролей случаются постоянно, а аккаунты в играх и соцсетях угоняют через простые пароли. Надёжный и уникальный пароль — базовая защита.", ["password"]],
      ["Фокус и учёба", "Короткие видео приучают мозг отвлекаться. Техника Помодоро и простые заметки помогают сосредоточиться на уроках.", ["pomodoro", "notes", "dates"]],
      ["Тексты", "Сочинения с лимитом символов, посты, описания товаров — нужно посчитать знаки, убрать лишние пробелы, поменять регистр.", ["word-count", "text-clean"]],
      ["Свои сайты и код", "Всё больше людей делают свои страницы и ботов. Нужны простые инструменты: форматировать JSON, сжать CSS, закодировать данные.", ["json", "minify", "encode"]],
      ["Геймерам", "Скорость реакции и печати, ник для нового аккаунта — то, чем делятся с друзьями.", ["reaction", "typing", "nickname"]],
      ["QR-коды везде", "Меню в кафе, ссылки на соцсети, билеты — QR-коды стали обычным делом, и их постоянно нужно создавать.", ["qr"]],
    ];
    app.innerHTML = "";
    app.append(h(`<section class="block"><h2>Что сейчас нужно людям</h2>
      <p class="lead">Мы посмотрели, какие задачи люди чаще всего решают онлайн, и собрали для каждой бесплатный инструмент. Без рекламы, регистрации и загрузки файлов на чужие серверы.</p>
      <div class="trend">${blocks.map(([t, p, ids]) => `<div class="panel"><h3>${t}</h3><p>${p}</p><div class="links">${ids.map(link).join("")}</div></div>`).join("")}</div>
      <div class="panel" style="margin-top:16px"><h3>Почему инструменты в браузере — это тренд</h3>
      <p class="muted" style="margin:0">Раньше для каждой мелочи ставили отдельную программу. Сейчас браузеры настолько мощные, что сжать фото или посчитать что-то можно прямо на странице: ничего не нужно скачивать, нет риска подхватить вирус из .exe, и всё работает на компьютере, телефоне и планшете.</p></div>
    </section>`));
    app.append(h(projectsBlock()));
  }

  function about() {
    document.title = "О сайте — Верстак";
    app.innerHTML = "";
    app.append(h(`<section class="block" style="max-width:760px"><h2>О сайте</h2>
      <div class="panel"><p style="margin-top:0"><b>Верстак</b> — набор бесплатных онлайн-инструментов. Сайт сделал Даня.</p>
      <p><b>Приватность.</b> Все инструменты работают прямо в твоём браузере. Картинки, тексты и пароли никуда не отправляются. Избранное, заметки и рекорды хранятся только у тебя.</p>
      <p><b>Бесплатно.</b> Без регистрации, подписок и скрытых платежей.</p>
      <p style="margin-bottom:0"><b>Везде.</b> Работает на компьютере и телефоне. Сайт можно установить как приложение: в меню браузера выбери «Установить приложение».</p></div>
      <div class="panel"><h3>Горячие клавиши</h3><p class="muted" style="margin:0"><b>/</b> — поиск на главной · <b>Esc</b> — назад к списку</p></div>
    </section>`));
    app.append(h(projectsBlock()));
  }

  function notFound() {
    app.innerHTML = `<section class="block" style="text-align:center"><h2>Такой страницы нет</h2><p class="lead" style="margin:10px auto 20px">Но есть ${TOOLS.length} других полезных инструментов.</p><a class="btn" href="#/">К инструментам</a></section>`;
  }

  // ---------- роутер ----------
  function route() {
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) {} }
    cleanup = null;
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    $$("nav.links a").forEach((a) => a.classList.toggle("on", a.dataset.nav === (parts[0] || "home") || (parts[0] === "tool" && a.dataset.nav === "home")));
    if (!parts[0]) home();
    else if (parts[0] === "tool") toolPage(parts[1]);
    else if (parts[0] === "trends") trends();
    else if (parts[0] === "about") about();
    else notFound();
  }
  window.addEventListener("hashchange", route);
  route();

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const on = toggleFav(b.dataset.fav);
    b.classList.toggle("on", on); b.textContent = on ? "★" : "☆";
    window.U.toast(on ? "Добавлено в избранное" : "Убрано из избранного");
    const favBtn = $('#side [data-cat="fav"] span'); if (favBtn) favBtn.textContent = favs().length;
    if (state.cat === "fav") renderGrid();
  });
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && $("#q")) { e.preventDefault(); $("#q").focus(); }
    if (e.key === "Escape" && location.hash.startsWith("#/tool/") && !$(".screen-test")) location.hash = "#/";
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
