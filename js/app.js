/* Утилька — роутер, каталог, темы */
(function () {
  "use strict";
  const { h, $, $$, esc, store } = window.U;
  const TOOLS = window.TOOLS;
  const app = $("#app");

  const CATS = {
    all: "Все", fav: "⭐ Избранное", images: "🖼 Картинки", text: "✍️ Текст", productivity: "🚀 Продуктивность",
    security: "🔐 Безопасность", calc: "🧮 Калькуляторы", dev: "💻 Для сайтов", web: "🌐 Веб", fun: "🎮 Развлечения",
  };
  let cleanup = null;
  let state = { cat: "all", q: "" };

  // ---------- theme ----------
  const themeBtn = $("#themeBtn");
  const applyThemeIcon = () => {
    const light = document.documentElement.dataset.theme === "light" ||
      (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches);
    themeBtn.textContent = light ? "🌙" : "☀️";
    return light;
  };
  if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  applyThemeIcon();
  themeBtn.onclick = () => {
    const next = applyThemeIcon() ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    applyThemeIcon();
  };
  $("#year").textContent = new Date().getFullYear();

  // ---------- favorites / recent ----------
  const favs = () => store.get("favs", []);
  const toggleFav = (id) => { const f = favs(); const i = f.indexOf(id); i >= 0 ? f.splice(i, 1) : f.push(id); store.set("favs", f); return i < 0; };
  const pushRecent = (id) => { const r = store.get("recent", []).filter((x) => x !== id); r.unshift(id); store.set("recent", r.slice(0, 6)); };

  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");
  const matches = (t, q) => !q || norm(t.name + " " + t.desc + " " + t.tags).includes(norm(q));

  const card = (t) => {
    const fav = favs().includes(t.id);
    return `<a class="tool-card" href="#/tool/${t.id}">
      ${t.hot ? '<span class="badge">ТОП</span>' : ""}
      <button class="fav ${fav ? "on" : ""}" data-fav="${t.id}" title="В избранное" aria-label="В избранное">${fav ? "★" : "☆"}</button>
      <span class="ico">${t.icon}</span><span class="tag">${CATS[t.cat].replace(/^\S+\s/, "")}</span>
      <h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></a>`;
  };

  // ---------- pages ----------
  function home() {
    document.title = "Утилька — бесплатные онлайн-инструменты";
    app.innerHTML = "";
    app.append(h(`<section class="hero">
      <h1>Полезные инструменты.<br><span class="grad">Бесплатно и без регистрации.</span></h1>
      <p>Сожми фото, создай QR-код, ускорь компьютер, проверь пароль и ещё ${TOOLS.length - 4} инструментов — всё работает прямо в браузере, файлы никуда не загружаются.</p>
      <div class="search"><span>🔍</span><input id="q" type="text" placeholder="Что нужно сделать? Например: сжать фото" autocomplete="off"><kbd>/</kbd></div>
      <div class="stats"><div><b>${TOOLS.length}</b>инструментов</div><div><b>0 ₴</b>навсегда</div><div><b>100%</b>в браузере</div><div><b>📱</b>и на телефоне</div></div>
    </section>`));
    const recent = store.get("recent", []).map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean);
    if (recent.length) app.append(h(`<div><p class="lbl" style="margin:0 0 10px">Недавно открывал</p><div class="chips" style="justify-content:flex-start;margin-top:0">
      ${recent.map((t) => `<a class="chip" style="text-decoration:none" href="#/tool/${t.id}">${t.icon} ${esc(t.name)}</a>`).join("")}</div></div>`));
    const chips = h(`<div class="chips"></div>`);
    Object.entries(CATS).forEach(([k, v]) => {
      if (k !== "all" && k !== "fav" && !TOOLS.some((t) => t.cat === k)) return;
      const b = h(`<button class="chip ${state.cat === k ? "on" : ""}">${v}</button>`);
      b.onclick = () => { state.cat = k; $$(".chip", chips).forEach((c) => c.classList.remove("on")); b.classList.add("on"); renderGrid(); };
      chips.append(b);
    });
    app.append(chips);
    const grid = h(`<div class="grid" id="grid"></div>`);
    app.append(grid);
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
      `<div class="empty">${state.cat === "fav" ? "Нажми ☆ на карточке, чтобы добавить инструмент в избранное." : "Ничего не нашлось 🤔 Попробуй другое слово."}</div>`;
  }

  function toolPage(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) return notFound();
    document.title = t.name + " — Утилька";
    pushRecent(id);
    app.innerHTML = "";
    app.append(h(`<a class="back" href="#/">← Все инструменты</a>`));
    const fav = favs().includes(id);
    app.append(h(`<div class="tool-head"><span class="ico">${t.icon}</span><div class="grow" style="flex:1;min-width:200px"><h1>${esc(t.name)}</h1><p>${esc(t.desc)}</p></div>
      <button class="btn ghost" id="favBtn">${fav ? "★ В избранном" : "☆ В избранное"}</button></div>`));
    $("#favBtn").onclick = (e) => { const on = toggleFav(id); e.currentTarget.textContent = on ? "★ В избранном" : "☆ В избранное"; };
    const body = h(`<div class="tool-body"></div>`);
    app.append(body);
    try { cleanup = t.render(body) || null; }
    catch (e) { body.innerHTML = `<div class="panel err">Ошибка инструмента: ${esc(e.message)}</div>`; console.error(e); }
    const more = TOOLS.filter((x) => x.id !== id && x.cat === t.cat).concat(TOOLS.filter((x) => x.id !== id && x.cat !== t.cat && x.hot)).slice(0, 4);
    app.append(h(`<section class="block" style="padding-top:30px"><h2>Ещё может пригодиться</h2><div class="grid" style="padding-bottom:10px">${more.map(card).join("")}</div></section>`));
    scrollTo(0, 0);
  }

  function trends() {
    document.title = "Тренды — Утилька";
    const T = (id) => TOOLS.find((t) => t.id === id);
    const link = (id) => { const t = T(id); return t ? `<a href="#/tool/${id}">${t.icon} ${esc(t.name)}</a>` : ""; };
    const blocks = [
      ["🖼 Работа с картинками", "Фото с телефонов весят по 3–10 МБ, а сайты, школьные платформы и мессенджеры просят меньше. Сжатие и перевод в WebP — одна из самых частых задач в интернете.", ["image-compress", "colors"]],
      ["🚀 Ускорение компьютера", "«Компьютер тормозит» — вечный запрос. Платные «оптимизаторы» часто бесполезны или опасны, а встроенные средства Windows 11 решают большинство проблем бесплатно.", ["pc-optimize", "screen-test"]],
      ["🔐 Безопасность аккаунтов", "Утечки паролей случаются постоянно, а аккаунты в играх и соцсетях угоняют через простые пароли. Надёжный и уникальный пароль — базовая защита.", ["password"]],
      ["🍅 Фокус и учёба", "Короткие видео приучают мозг отвлекаться. Техника Помодоро и простые заметки помогают сосредоточиться на уроках и делах.", ["pomodoro", "notes", "dates"]],
      ["✍️ Тексты", "Сочинения с лимитом символов, посты, описания товаров — нужно посчитать знаки, убрать лишние пробелы, поменять регистр.", ["word-count", "text-clean"]],
      ["💻 Свои сайты и код", "Всё больше людей делают свои страницы и ботов. Нужны простые инструменты: форматировать JSON, сжать CSS, закодировать данные.", ["json", "minify", "encode"]],
      ["🎮 Геймерам", "Скорость реакции и печати, крутой ник для нового аккаунта — то, чем делятся с друзьями.", ["reaction", "typing", "nickname"]],
      ["🌐 QR-коды везде", "Меню в кафе, ссылки на соцсети, оплата, билеты — QR-коды стали обычным делом, и их постоянно нужно создавать.", ["qr"]],
    ];
    app.innerHTML = "";
    app.append(h(`<section class="block" style="padding-top:36px"><h2>📈 Что сейчас нужно людям</h2>
      <p class="lead">Мы посмотрели, какие задачи люди чаще всего решают онлайн, и собрали для каждой бесплатный инструмент. Без рекламы, регистрации и загрузки файлов на чужие серверы.</p>
      <div class="trend">${blocks.map(([t, p, ids]) => `<div class="panel"><h3>${t}</h3><p>${p}</p><div class="links">${ids.map(link).join("")}</div></div>`).join("")}</div>
      <div class="panel" style="margin-top:16px"><h3>Почему инструменты в браузере — это тренд</h3>
      <p class="muted" style="margin:0">Раньше для каждой мелочи ставили отдельную программу. Сейчас браузеры стали настолько мощными, что сжать фото или посчитать что-то можно прямо на странице: ничего не нужно скачивать, это безопасно (никаких вирусов в .exe) и работает на любом устройстве — компьютере, телефоне или планшете.</p></div>
    </section>`));
  }

  function about() {
    document.title = "О сайте — Утилька";
    app.innerHTML = "";
    app.append(h(`<section class="block" style="padding-top:36px;max-width:760px"><h2>О сайте</h2>
      <div class="panel"><p style="margin-top:0"><b>Утилька</b> — набор бесплатных онлайн-инструментов. Сайт сделал Даня 🇺🇦.</p>
      <p>🔒 <b>Приватность.</b> Все инструменты работают прямо в твоём браузере. Картинки, тексты и пароли никуда не отправляются — их видишь только ты. Избранное, заметки и рекорды хранятся в твоём браузере.</p>
      <p>💸 <b>Бесплатно.</b> Без регистрации, подписок и скрытых платежей.</p>
      <p>📱 <b>Везде.</b> Работает на компьютере и телефоне. Сайт можно установить как приложение (в меню браузера: «Установить приложение»).</p>
      <p style="margin-bottom:0">💡 Есть идея для нового инструмента? Напиши автору — лучшие идеи появятся на сайте.</p></div>
      <div class="panel"><h3>Горячие клавиши</h3><p class="muted" style="margin:0"><b>/</b> — поиск на главной · <b>Esc</b> — назад к списку</p></div>
    </section>`));
  }

  function notFound() {
    app.innerHTML = `<section class="block" style="padding-top:60px;text-align:center"><h2>Такой страницы нет 🤷</h2><p class="lead">Но есть ${TOOLS.length} других полезных инструментов.</p><a class="btn" href="#/">К инструментам</a></section>`;
  }

  // ---------- router ----------
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

  // favorite stars on cards
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const on = toggleFav(b.dataset.fav);
    b.classList.toggle("on", on); b.textContent = on ? "★" : "☆";
    window.U.toast(on ? "Добавлено в избранное ⭐" : "Убрано из избранного");
    if (state.cat === "fav") renderGrid();
  });

  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && $("#q")) { e.preventDefault(); $("#q").focus(); }
    if (e.key === "Escape" && location.hash.startsWith("#/tool/") && !$(".screen-test")) location.hash = "#/";
  });

  // offline support
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
