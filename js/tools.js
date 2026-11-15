/* Верстак — все инструменты. Каждый инструмент: {id, name, icon, cat, desc, tags, render(root)} */
(function () {
  "use strict";

  // ---------- helpers ----------
  const U = {};
  U.h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.toast = (msg) => {
    const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(U._tt); U._tt = setTimeout(() => t.classList.remove("show"), 1800);
  };
  U.copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) {} ta.remove();
    }
    U.toast(msg || "Скопировано ✓");
  };
  U.download = (blob, name) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  U.bytes = (n) => {
    if (n < 1024) return n + " Б";
    const u = ["КБ", "МБ", "ГБ"]; let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(n < 10 ? 2 : 1).replace(".", ",") + " " + u[i];
  };
  U.num = (n, d) => {
    if (!isFinite(n)) return "—";
    const r = Number(n.toFixed(d == null ? 6 : d));
    return r.toLocaleString("ru-RU", { maximumFractionDigits: d == null ? 6 : d });
  };
  U.store = {
    get(k, def) { try { const v = localStorage.getItem("verstak:" + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem("verstak:" + k, JSON.stringify(v)); } catch (e) {} },
  };
  U.loadScript = (src) => new Promise((ok, fail) => {
    if (U.$(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
  });
  U.rand = (max) => { // честное случайное число 0..max-1
    const a = new Uint32Array(1), lim = Math.floor(0x100000000 / max) * max;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % max;
  };
  U.plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  window.U = U;

  const T = [];
  const add = (t) => T.push(t);

  // ================= 1. Сжатие картинок =================
  add({
    id: "image-compress", name: "Сжатие картинок", icon: "🗜️", cat: "images", hot: true,
    desc: "Уменьши вес фото до 90% и переведи в WebP, JPG или PNG. Можно сразу много файлов.",
    tags: "сжать фото картинка изображение webp jpg png размер вес оптимизация уменьшить resize",
    render(root) {
      root.append(U.h(`<div>
        <div class="panel">
          <label class="drop" id="drop"><b>Перетащи картинки сюда</b>или нажми, чтобы выбрать (JPG, PNG, WebP, GIF)
            <input type="file" accept="image/*" multiple hidden id="file"></label>
        </div>
        <div class="panel">
          <div class="two">
            <div class="col"><label class="lbl">Формат</label>
              <select id="fmt"><option value="image/webp">WebP (лучшее сжатие)</option><option value="image/jpeg">JPG</option><option value="image/png">PNG (без потерь)</option></select></div>
            <div class="col"><label class="lbl">Макс. ширина, px (0 — не менять)</label><input type="number" id="maxw" value="0" min="0" step="10"></div>
          </div>
          <div class="col" style="margin-top:14px"><label class="lbl">Качество: <span id="qv">80</span>%</label><input type="range" id="q" min="10" max="100" value="80"></div>
          <div class="row" style="margin-top:14px"><button class="btn" id="go" disabled>⚡ Сжать</button><button class="btn ghost" id="all" hidden>⬇ Скачать все</button><span class="muted" id="sum"></span></div>
        </div>
        <div class="list" id="res"></div></div>`));
      let files = [], outs = [];
      const file = U.$("#file", root), drop = U.$("#drop", root), go = U.$("#go", root), q = U.$("#q", root);
      q.oninput = () => (U.$("#qv", root).textContent = q.value);
      const setFiles = (list) => {
        files = Array.from(list).filter((f) => f.type.startsWith("image/"));
        go.disabled = !files.length;
        U.$("#sum", root).textContent = files.length ? `Выбрано: ${files.length}` : "";
      };
      file.onchange = () => setFiles(file.files);
      ["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
      ["dragleave", "drop"].forEach((e) => drop.addEventListener(e, () => drop.classList.remove("over")));
      drop.addEventListener("drop", (ev) => { ev.preventDefault(); setFiles(ev.dataTransfer.files); });
      go.onclick = async () => {
        const fmt = U.$("#fmt", root).value, quality = q.value / 100, maxw = +U.$("#maxw", root).value || 0;
        const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[fmt];
        const res = U.$("#res", root); res.innerHTML = ""; outs = []; go.disabled = true;
        let before = 0, after = 0;
        for (const f of files) {
          try {
            const bmp = await createImageBitmap(f);
            let w = bmp.width, hgt = bmp.height;
            if (maxw && w > maxw) { hgt = Math.round(hgt * maxw / w); w = maxw; }
            const c = document.createElement("canvas"); c.width = w; c.height = hgt;
            const ctx = c.getContext("2d");
            if (fmt === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, hgt); }
            ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, hgt);
            const blob = await new Promise((r) => c.toBlob(r, fmt, quality));
            const name = f.name.replace(/\.[^.]+$/, "") + "-min." + ext;
            outs.push({ blob, name }); before += f.size; after += blob.size;
            const pct = Math.round((1 - blob.size / f.size) * 100);
            const url = URL.createObjectURL(blob);
            res.append(U.h(`<div class="item"><img src="${url}" alt=""><div class="grow"><b>${U.esc(name)}</b><div class="muted">${w}×${hgt} · ${U.bytes(f.size)} → <b>${U.bytes(blob.size)}</b>
              <span class="${pct > 0 ? "ok" : "err"}">${pct > 0 ? "−" + pct : "+" + -pct}%</span></div></div><a class="btn small" href="${url}" download="${U.esc(name)}">⬇ Скачать</a></div>`));
          } catch (e) {
            res.append(U.h(`<div class="item"><span class="err">Не удалось открыть ${U.esc(f.name)}</span></div>`));
          }
        }
        go.disabled = false;
        if (outs.length) {
          U.$("#sum", root).innerHTML = `Итого: ${U.bytes(before)} → <b>${U.bytes(after)}</b> (сэкономлено ${U.bytes(Math.max(0, before - after))})`;
          U.$("#all", root).hidden = outs.length < 2;
        }
      };
      U.$("#all", root).onclick = async () => {
        for (const o of outs) { U.download(o.blob, o.name); await new Promise((r) => setTimeout(r, 300)); }
      };
    },
  });

  // ================= 2. QR-код =================
  add({
    id: "qr", name: "Генератор QR-кодов", icon: "🔳", cat: "web", hot: true,
    desc: "QR-код для ссылки, текста, Wi-Fi-визитки или телефона. Скачай PNG в один клик.",
    tags: "qr код куар генератор ссылка штрихкод",
    render(root) {
      root.append(U.h(`<div class="two">
        <div class="panel">
          <div class="col"><label class="lbl">Текст или ссылка</label><textarea id="t" class="prose" style="min-height:110px">https://</textarea></div>
          <div class="row" style="margin-top:14px">
            <div class="col"><label class="lbl">Размер</label><select id="s"><option>256</option><option selected>384</option><option>512</option><option>1024</option></select></div>
            <div class="col"><label class="lbl">Цвет</label><input type="color" id="fg" value="#111827"></div>
            <div class="col"><label class="lbl">Фон</label><input type="color" id="bg" value="#ffffff"></div>
          </div>
          <div class="row" style="margin-top:14px"><button class="btn" id="dl">⬇ Скачать PNG</button></div>
        </div>
        <div class="panel" style="display:grid;place-items:center;min-height:300px"><div id="qr" style="background:#fff;padding:14px;border-radius:12px;max-width:100%"></div><p class="muted" id="msg"></p></div>
      </div>`));
      const box = U.$("#qr", root), msg = U.$("#msg", root);
      let ready = false;
      const draw = () => {
        if (!ready) return;
        const text = U.$("#t", root).value.trim(), size = +U.$("#s", root).value;
        box.innerHTML = ""; box.style.background = U.$("#bg", root).value;
        if (!text) { msg.textContent = "Введи текст"; return; }
        msg.textContent = "";
        try {
          new window.QRCode(box, { text, width: size, height: size, colorDark: U.$("#fg", root).value, colorLight: U.$("#bg", root).value, correctLevel: window.QRCode.CorrectLevel.M });
          const c = U.$("canvas", box); if (c) { c.style.maxWidth = "100%"; c.style.height = "auto"; }
          const img = U.$("img", box); if (img) { img.style.maxWidth = "100%"; img.style.height = "auto"; }
        } catch (e) { msg.textContent = "Слишком длинный текст для QR-кода"; }
      };
      msg.textContent = "Загружаю генератор…";
      U.loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js")
        .then(() => { ready = true; msg.textContent = ""; draw(); })
        .catch(() => (msg.textContent = "Нет интернета — генератор не загрузился"));
      U.$$("#t, #s, #fg, #bg", root).forEach((el) => el.addEventListener("input", draw));
      U.$("#dl", root).onclick = () => {
        const c = U.$("canvas", box); if (!c) return;
        c.toBlob((b) => U.download(b, "qr-code.png"));
      };
    },
  });

  // ================= 3. Пароли =================
  add({
    id: "password", name: "Генератор паролей", icon: "🔐", cat: "security", hot: true,
    desc: "Надёжные пароли и проверка твоего пароля: сколько времени его будут взламывать.",
    tags: "пароль password генератор надёжный безопасность взлом проверка",
    render(root) {
      root.append(U.h(`<div>
        <div class="panel">
          <div class="col"><label class="lbl">Длина: <span id="lv">16</span></label><input type="range" id="len" min="6" max="64" value="16"></div>
          <div class="row" style="margin:14px 0">
            <label class="row"><input type="checkbox" id="lo" checked> a-z</label>
            <label class="row"><input type="checkbox" id="up" checked> A-Z</label>
            <label class="row"><input type="checkbox" id="di" checked> 0-9</label>
            <label class="row"><input type="checkbox" id="sy" checked> !@#$</label>
            <label class="row"><input type="checkbox" id="sim"> без похожих (l, 1, O, 0)</label>
          </div>
          <div class="list" id="list"></div>
          <div class="row" style="margin-top:14px"><button class="btn" id="gen">🎲 Сгенерировать</button></div>
        </div>
        <div class="panel"><h3>Проверить свой пароль</h3>
          <input type="password" id="mine" placeholder="Пароль никуда не отправляется" autocomplete="off">
          <div class="meter" style="margin:12px 0 8px"><i id="bar"></i></div><div id="verdict" class="muted">Введи пароль</div>
        </div></div>`));
      const sets = { lo: "abcdefghijklmnopqrstuvwxyz", up: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", di: "0123456789", sy: "!@#$%^&*()-_=+[]{};:,.?/" };
      const len = U.$("#len", root);
      const gen = () => {
        U.$("#lv", root).textContent = len.value;
        let pool = Object.keys(sets).filter((k) => U.$("#" + k, root).checked).map((k) => sets[k]).join("");
        if (U.$("#sim", root).checked) pool = pool.replace(/[lI1O0o|]/g, "");
        const list = U.$("#list", root); list.innerHTML = "";
        if (!pool) { list.innerHTML = `<div class="err">Выбери хотя бы один набор символов</div>`; return; }
        for (let i = 0; i < 5; i++) {
          let p = ""; for (let j = 0; j < +len.value; j++) p += pool[U.rand(pool.length)];
          const it = U.h(`<div class="item"><span class="out grow" style="border:0;padding:4px"></span><button class="btn small ghost">📋 Копировать</button></div>`);
          it.firstElementChild.textContent = p; it.lastElementChild.onclick = () => U.copy(p, "Пароль скопирован ✓");
          list.append(it);
        }
      };
      U.$$("input", root.firstElementChild.firstElementChild).forEach((el) => el.addEventListener("input", gen));
      U.$("#gen", root).onclick = gen; gen();
      const time = (sec) => {
        const steps = [[60, "секунд", 1], [3600, "минут", 60], [86400, "часов", 3600], [31536000, "дней", 86400], [3.15e9, "лет", 31536000], [Infinity, "веков", 3.15e9]];
        if (sec < 1) return "мгновенно";
        for (const [lim, name, div] of steps) if (sec < lim) return "≈ " + U.num(Math.round(sec / div), 0) + " " + name;
      };
      U.$("#mine", root).oninput = (e) => {
        const p = e.target.value, bar = U.$("#bar", root), v = U.$("#verdict", root);
        if (!p) { bar.style.width = 0; v.textContent = "Введи пароль"; return; }
        let pool = 0;
        if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10;
        if (/[а-яё]/i.test(p)) pool += 66; if (/[^a-zA-Z0-9а-яА-ЯёЁ]/.test(p)) pool += 33;
        let bits = p.length * Math.log2(Math.max(pool, 2));
        const common = /^(123|qwerty|password|пароль|admin|111|000|abc|iloveyou|йцукен)/i.test(p) || /(.)\1{3,}/.test(p);
        if (common) bits = Math.min(bits, 20);
        const pct = Math.min(100, bits / 100 * 100);
        const lvl = bits < 36 ? ["Очень слабый", "var(--bad)"] : bits < 60 ? ["Средний", "var(--warn)"] : bits < 80 ? ["Хороший", "var(--good)"] : ["Отличный 💪", "var(--good)"];
        bar.style.width = pct + "%"; bar.style.background = lvl[1];
        v.innerHTML = `<b>${lvl[0]}</b> · ${Math.round(bits)} бит · подбор на мощном ПК: <b>${time(Math.pow(2, bits) / 2 / 1e10)}</b>${common ? '<br><span class="err">Похоже на популярный пароль — такие подбирают первыми.</span>' : ""}`;
      };
    },
  });

  // ================= 4. Счётчик слов =================
  add({
    id: "word-count", name: "Счётчик слов и символов", icon: "🔢", cat: "text",
    desc: "Символы, слова, предложения, время чтения и самые частые слова в тексте.",
    tags: "счётчик символов слов знаков текст сочинение длина время чтения",
    render(root) {
      root.append(U.h(`<div><div class="panel"><textarea id="t" class="prose" placeholder="Вставь сюда текст…" style="min-height:240px"></textarea></div>
        <div class="kpis" id="k"></div><div class="panel" style="margin-top:16px"><h3>Частые слова</h3><div id="top" class="muted">—</div></div></div>`));
      const t = U.$("#t", root);
      const upd = () => {
        const s = t.value, words = s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
        const k = [
          [s.length, "символов"], [s.replace(/\s/g, "").length, "без пробелов"], [words.length, "слов"],
          [(s.match(/[^.!?…]+[.!?…]+/g) || []).length || (s.trim() ? 1 : 0), "предложений"],
          [s.split(/\n\s*\n/).filter((x) => x.trim()).length, "абзацев"],
          [Math.max(words.length ? 1 : 0, Math.round(words.length / 200)) + " мин", "чтение"],
          [Math.max(words.length ? 1 : 0, Math.round(words.length / 130)) + " мин", "вслух"],
        ];
        U.$("#k", root).innerHTML = k.map(([v, l]) => `<div class="kpi"><b>${typeof v === "number" ? U.num(v, 0) : v}</b><span>${l}</span></div>`).join("");
        const freq = {};
        words.forEach((w) => { w = w.toLowerCase(); if (w.length > 3) freq[w] = (freq[w] || 0) + 1; });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
        U.$("#top", root).innerHTML = top.length ? top.map(([w, n]) => `<span class="chip" style="cursor:default;display:inline-block;margin:3px">${U.esc(w)} · ${n}</span>`).join("") : "—";
      };
      t.oninput = upd; upd();
    },
  });

  // ================= 5. Очистка текста =================
  add({
    id: "text-clean", name: "Очистка и регистр текста", icon: "🧹", cat: "text",
    desc: "Убрать лишние пробелы и дубли, сменить регистр, отсортировать строки, транслит.",
    tags: "регистр пробелы дубли строки сортировка транслит заглавные текст очистка html теги",
    render(root) {
      const ops = [
        ["Лишние пробелы", (s) => s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim()],
        ["Пустые строки", (s) => s.split("\n").filter((l) => l.trim()).join("\n")],
        ["Дубли строк", (s) => [...new Set(s.split("\n"))].join("\n")],
        ["Сортировать А→Я", (s) => s.split("\n").sort((a, b) => a.localeCompare(b, "ru")).join("\n")],
        ["ВЕРХНИЙ", (s) => s.toUpperCase()],
        ["нижний", (s) => s.toLowerCase()],
        ["Каждое Слово", (s) => s.toLowerCase().replace(/(^|[\s(«"-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())],
        ["Как в предложении", (s) => s.toLowerCase().replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())],
        ["Убрать HTML-теги", (s) => s.replace(/<[^>]*>/g, "")],
        ["ё → е", (s) => s.replace(/ё/g, "е").replace(/Ё/g, "Е")],
        ["Транслит", (s) => {
          const m = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g" };
          return s.replace(/[а-яёіїєґ]/gi, (c) => { const l = c.toLowerCase(), r = m[l] ?? c; return c === l ? r : r.charAt(0).toUpperCase() + r.slice(1); });
        }],
      ];
      root.append(U.h(`<div><div class="panel"><textarea id="t" class="prose" placeholder="Вставь текст…" style="min-height:260px"></textarea>
        <div class="row" style="margin-top:12px" id="ops"></div>
        <div class="row" style="margin-top:12px"><button class="btn" id="cp">📋 Копировать</button><button class="btn ghost" id="undo">↶ Отменить</button></div></div></div>`));
      const t = U.$("#t", root), hist = [];
      ops.forEach(([name, fn]) => {
        const b = U.h(`<button class="btn small ghost">${name}</button>`);
        b.onclick = () => { hist.push(t.value); t.value = fn(t.value); };
        U.$("#ops", root).append(b);
      });
      U.$("#cp", root).onclick = () => U.copy(t.value);
      U.$("#undo", root).onclick = () => { if (hist.length) t.value = hist.pop(); };
    },
  });

  // ================= 6. JSON =================
  add({
    id: "json", name: "JSON форматтер", icon: "🧾", cat: "dev",
    desc: "Красиво отформатировать, сжать и проверить JSON. Покажет, где ошибка.",
    tags: "json формат валидатор проверить красиво сжать программист dev",
    render(root) {
      root.append(U.h(`<div class="panel"><textarea id="t" placeholder='{"привет": "мир"}' style="min-height:300px"></textarea>
        <div class="row" style="margin-top:12px"><button class="btn" id="f">✨ Форматировать</button><button class="btn ghost" id="m">Сжать в строку</button>
        <button class="btn ghost" id="srt">Сортировать ключи</button><button class="btn ghost" id="cp">📋 Копировать</button><span id="st"></span></div></div>`));
      const t = U.$("#t", root), st = U.$("#st", root);
      const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
      const run = (fn) => {
        try { const v = JSON.parse(t.value); t.value = fn(v); st.innerHTML = `<span class="ok">✓ JSON корректный</span>`; }
        catch (e) {
          const m = /position (\d+)/.exec(e.message); let where = "";
          if (m) { const pos = +m[1], before = t.value.slice(0, pos); where = ` (строка ${before.split("\n").length}, символ ${pos - before.lastIndexOf("\n")})`; }
          st.innerHTML = `<span class="err">✗ Ошибка${where}: ${U.esc(e.message)}</span>`;
        }
      };
      U.$("#f", root).onclick = () => run((v) => JSON.stringify(v, null, 2));
      U.$("#m", root).onclick = () => run((v) => JSON.stringify(v));
      U.$("#srt", root).onclick = () => run((v) => JSON.stringify(sortKeys(v), null, 2));
      U.$("#cp", root).onclick = () => U.copy(t.value);
    },
  });

  // ================= 7. Минификатор =================
  add({
    id: "minify", name: "Минификатор CSS / HTML", icon: "📦", cat: "dev",
    desc: "Ускорь свой сайт: убери комментарии и пробелы из CSS и HTML.",
    tags: "минификатор сжать css html код оптимизация сайта скорость minify",
    render(root) {
      root.append(U.h(`<div><div class="panel"><div class="row" style="margin-bottom:12px"><select id="lang" style="width:auto"><option value="css">CSS</option><option value="html">HTML</option></select>
        <button class="btn" id="go">📦 Минифицировать</button><button class="btn ghost" id="cp">📋 Копировать результат</button><span id="st" class="muted"></span></div>
        <div class="two"><textarea id="in" placeholder="Вставь код…"></textarea><textarea id="out" readonly placeholder="Результат"></textarea></div></div></div>`));
      const css = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>~])\s*/g, "$1").replace(/;}/g, "}").trim();
      const html = (s) => s.replace(/<!--(?!\[if)[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
      U.$("#go", root).onclick = () => {
        const src = U.$("#in", root).value, out = U.$("#lang", root).value === "css" ? css(src) : html(src);
        U.$("#out", root).value = out;
        const a = new Blob([src]).size, b = new Blob([out]).size;
        U.$("#st", root).textContent = a ? `${U.bytes(a)} → ${U.bytes(b)} (−${Math.round((1 - b / a) * 100)}%)` : "";
      };
      U.$("#cp", root).onclick = () => U.copy(U.$("#out", root).value);
    },
  });

  // ================= 8. Конвертер единиц =================
  add({
    id: "units", name: "Конвертер единиц", icon: "📏", cat: "calc",
    desc: "Длина, вес, температура, объём, площадь, скорость, время и размер файлов.",
    tags: "конвертер единиц перевод метры километры мили фунты килограммы цельсий фаренгейт гигабайт",
    render(root) {
      const D = {
        "Длина": { "мм": 0.001, "см": 0.01, "м": 1, "км": 1000, "дюйм": 0.0254, "фут": 0.3048, "ярд": 0.9144, "миля": 1609.344 },
        "Масса": { "г": 0.001, "кг": 1, "т": 1000, "унция": 0.0283495, "фунт": 0.453592 },
        "Температура": { "°C": "c", "°F": "f", "K": "k" },
        "Объём": { "мл": 0.001, "л": 1, "м³": 1000, "галлон (США)": 3.78541, "чашка": 0.24 },
        "Площадь": { "см²": 0.0001, "м²": 1, "сотка": 100, "гектар": 10000, "км²": 1e6, "фут²": 0.092903 },
        "Скорость": { "м/с": 1, "км/ч": 1 / 3.6, "миль/ч": 0.44704, "узел": 0.514444 },
        "Время": { "сек": 1, "мин": 60, "час": 3600, "день": 86400, "неделя": 604800, "год": 31536000 },
        "Данные": { "бит": 0.125, "байт": 1, "КБ": 1024, "МБ": 1048576, "ГБ": 1073741824, "ТБ": 1099511627776 },
      };
      root.append(U.h(`<div class="panel"><div class="chips" id="cats" style="justify-content:flex-start;margin:0 0 16px"></div>
        <div class="two"><div class="col"><input type="number" id="v" value="1"><select id="from"></select></div>
        <div class="col"><div class="out big-num" id="r">—</div><select id="to"></select></div></div>
        <div class="row" style="margin-top:12px"><button class="btn ghost small" id="sw">⇄ Поменять местами</button></div>
        <div class="list" id="all" style="margin-top:16px"></div></div>`));
      let cat = "Длина";
      const toBase = (v, u) => cat === "Температура" ? (u === "c" ? v : u === "f" ? (v - 32) * 5 / 9 : v - 273.15) : v * u;
      const fromBase = (v, u) => cat === "Температура" ? (u === "c" ? v : u === "f" ? v * 9 / 5 + 32 : v + 273.15) : v / u;
      const fill = () => {
        const units = Object.keys(D[cat]);
        U.$("#from", root).innerHTML = U.$("#to", root).innerHTML = units.map((u) => `<option>${u}</option>`).join("");
        U.$("#to", root).selectedIndex = Math.min(1, units.length - 1);
        U.$$(".chip", root).forEach((c) => c.classList.toggle("on", c.textContent === cat));
        calc();
      };
      const calc = () => {
        const v = parseFloat(U.$("#v", root).value), f = U.$("#from", root).value, t = U.$("#to", root).value;
        const base = toBase(v, D[cat][f]);
        U.$("#r", root).textContent = isNaN(v) ? "—" : U.num(fromBase(base, D[cat][t])) + " " + t;
        U.$("#all", root).innerHTML = isNaN(v) ? "" : Object.keys(D[cat]).filter((u) => u !== f).map((u) => `<div class="item"><span class="grow">${u}</span><b>${U.num(fromBase(base, D[cat][u]))}</b></div>`).join("");
      };
      Object.keys(D).forEach((c) => { const b = U.h(`<button class="chip">${c}</button>`); b.onclick = () => { cat = c; fill(); }; U.$("#cats", root).append(b); });
      U.$$("#v, #from, #to", root).forEach((el) => el.addEventListener("input", calc));
      U.$("#sw", root).onclick = () => { const f = U.$("#from", root), t = U.$("#to", root), x = f.value; f.value = t.value; t.value = x; calc(); };
      fill();
    },
  });

  // ================= 9. Тест скорости печати =================
  add({
    id: "typing", name: "Тест скорости печати", icon: "⌨️", cat: "fun", hot: true,
    desc: "Сколько знаков в минуту ты печатаешь? Русский и английский текст, точность.",
    tags: "скорость печати клавиатура тест набор текста знаков в минуту wpm тренажёр",
    render(root) {
      const texts = {
        ru: ["Утро было тихим и солнечным. Кот лениво потянулся на подоконнике и посмотрел на улицу, где спешили люди.",
          "Чтобы научиться быстро печатать, не смотри на клавиатуру. Сначала будет медленно, но через неделю скорость вырастет.",
          "Компьютер работает быстрее, если в автозагрузке нет лишних программ, а на диске достаточно свободного места.",
          "Весной в лесу просыпаются птицы, на деревьях появляются первые листья, а ручьи весело бегут к реке."],
        en: ["The quick brown fox jumps over the lazy dog while the sun slowly rises above the quiet little town.",
          "Practice every day and do not look at the keyboard. Speed comes later, accuracy comes first.",
          "A good password is long, unique and hard to guess, so use a password manager to remember them all."],
      };
      root.append(U.h(`<div><div class="panel"><div class="row" style="margin-bottom:12px"><select id="lang" style="width:auto"><option value="ru">Русский</option><option value="en">English</option></select>
        <button class="btn ghost small" id="new">🔄 Другой текст</button><span class="muted">Таймер стартует с первой буквы</span></div>
        <div class="typing-text" id="txt"></div><input type="text" id="inp" placeholder="Начни печатать здесь…" style="margin-top:12px;font-size:18px" autocomplete="off" spellcheck="false"></div>
        <div class="kpis"><div class="kpi"><b id="cpm">0</b><span>знаков/мин</span></div><div class="kpi"><b id="wpm">0</b><span>слов/мин</span></div>
        <div class="kpi"><b id="acc">100%</b><span>точность</span></div><div class="kpi"><b id="tm">0,0 с</b><span>время</span></div><div class="kpi"><b id="best">—</b><span>твой рекорд, зн/мин</span></div></div></div>`));
      let text = "", start = 0, errors = 0, done = false, timer;
      const inp = U.$("#inp", root), txt = U.$("#txt", root);
      const best = () => { const b = U.store.get("typing-best", 0); U.$("#best", root).textContent = b || "—"; };
      const pick = () => {
        const arr = texts[U.$("#lang", root).value]; let nt; do nt = arr[U.rand(arr.length)]; while (arr.length > 1 && nt === text);
        text = nt; start = 0; errors = 0; done = false; inp.value = ""; inp.disabled = false; clearInterval(timer); paint(); stats(); best();
      };
      const paint = () => {
        const v = inp.value;
        txt.innerHTML = [...text].map((ch, i) => `<span class="${i < v.length ? (v[i] === ch ? "c" : "w") : ""}${i === v.length ? " cur" : ""}">${U.esc(ch)}</span>`).join("");
      };
      const stats = () => {
        const sec = start ? (Date.now() - start) / 1000 : 0, v = inp.value;
        let right = 0; for (let i = 0; i < v.length; i++) if (v[i] === text[i]) right++;
        const cpm = sec > 0.5 ? Math.round(right / sec * 60) : 0;
        U.$("#cpm", root).textContent = cpm; U.$("#wpm", root).textContent = Math.round(cpm / 5);
        U.$("#acc", root).textContent = (v.length + errors ? Math.round(right / (v.length + errors) * 100) : 100) + "%";
        U.$("#tm", root).textContent = sec.toFixed(1).replace(".", ",") + " с";
        return cpm;
      };
      inp.addEventListener("beforeinput", (e) => {
        if (e.inputType === "insertText" && e.data) { const pos = inp.value.length; if (e.data !== text[pos]) errors++; }
      });
      inp.oninput = () => {
        if (done) return;
        if (!start) { start = Date.now(); timer = setInterval(stats, 200); }
        paint(); stats();
        if (inp.value.length >= text.length) {
          done = true; clearInterval(timer); inp.disabled = true; const cpm = stats();
          if (cpm > U.store.get("typing-best", 0)) { U.store.set("typing-best", cpm); U.toast("🏆 Новый рекорд: " + cpm + " зн/мин!"); } else U.toast("Готово: " + cpm + " зн/мин");
          best();
        }
      };
      txt.onclick = () => inp.focus();
      U.$("#new", root).onclick = pick; U.$("#lang", root).onchange = pick; pick();
      return () => clearInterval(timer);
    },
  });

  // ================= 10. Помодоро =================
  add({
    id: "pomodoro", name: "Помодоро-таймер", icon: "🍅", cat: "productivity", hot: true,
    desc: "25 минут учёбы — 5 минут отдыха. Помогает делать уроки и не отвлекаться.",
    tags: "помодоро таймер фокус учёба продуктивность концентрация уроки",
    render(root) {
      root.append(U.h(`<div><div class="panel">
        <div class="chips" id="modes" style="margin:0 0 6px"><button class="chip on" data-m="work">🍅 Работа</button><button class="chip" data-m="short">☕ Перерыв</button><button class="chip" data-m="long">🛋 Длинный перерыв</button></div>
        <div class="timer" id="clock">25:00</div>
        <div class="row" style="justify-content:center"><button class="btn" id="start">▶ Старт</button><button class="btn ghost" id="reset">↺ Сброс</button></div>
        <p class="muted" style="text-align:center" id="count"></p></div>
        <div class="panel"><h3>Настройки (минуты)</h3><div class="row"><div class="col"><label class="lbl">Работа</label><input type="number" id="w" min="1" max="120"></div>
        <div class="col"><label class="lbl">Перерыв</label><input type="number" id="s" min="1" max="60"></div><div class="col"><label class="lbl">Длинный</label><input type="number" id="l" min="1" max="90"></div></div></div></div>`));
      const cfg = U.store.get("pomo", { work: 25, short: 5, long: 15, done: 0 });
      U.$("#w", root).value = cfg.work; U.$("#s", root).value = cfg.short; U.$("#l", root).value = cfg.long;
      let mode = "work", left = cfg.work * 60, end = 0, iv = null;
      const title = document.title;
      const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      const show = () => { U.$("#clock", root).textContent = fmt(left); if (iv) document.title = fmt(left) + " · " + (mode === "work" ? "Работа" : "Перерыв"); U.$("#count", root).textContent = `Помидорок сегодня: ${cfg.done}`; };
      const beep = () => {
        try {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          [0, 0.35, 0.7].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
            g.gain.setValueAtTime(0.25, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.3); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.3); });
        } catch (e) {}
      };
      const setMode = (m) => { mode = m; stop(); left = cfg[m] * 60; U.$$("#modes .chip", root).forEach((c) => c.classList.toggle("on", c.dataset.m === m)); show(); };
      const stop = () => { clearInterval(iv); iv = null; U.$("#start", root).textContent = "▶ Старт"; document.title = title; };
      const tick = () => {
        left = Math.max(0, Math.round((end - Date.now()) / 1000)); show();
        if (left === 0) {
          beep(); stop();
          if (mode === "work") { cfg.done++; U.store.set("pomo", cfg); }
          const next = mode === "work" ? (cfg.done % 4 === 0 ? "long" : "short") : "work";
          U.toast(mode === "work" ? "🍅 Отлично! Время отдохнуть" : "⏰ Перерыв окончен — за работу!");
          try { if (Notification.permission === "granted") new Notification("Верстак", { body: mode === "work" ? "Время отдохнуть" : "Перерыв окончен" }); } catch (e) {}
          setMode(next);
        }
      };
      U.$("#start", root).onclick = () => {
        if (iv) { stop(); return; }
        try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
        end = Date.now() + left * 1000; iv = setInterval(tick, 250); U.$("#start", root).textContent = "⏸ Пауза";
      };
      U.$("#reset", root).onclick = () => setMode(mode);
      U.$$("#modes .chip", root).forEach((c) => (c.onclick = () => setMode(c.dataset.m)));
      [["#w", "work"], ["#s", "short"], ["#l", "long"]].forEach(([sel, k]) => U.$(sel, root).addEventListener("change", (e) => {
        cfg[k] = Math.max(1, Math.min(120, +e.target.value || 1)); U.store.set("pomo", cfg); if (mode === k && !iv) setMode(k);
      }));
      show();
      return () => { clearInterval(iv); document.title = title; };
    },
  });

  // ================= 11. Цвета =================
  add({
    id: "colors", name: "Цвета и палитры", icon: "🎨", cat: "images",
    desc: "HEX ↔ RGB ↔ HSL, готовые палитры, оттенки и проверка контраста текста.",
    tags: "цвет палитра hex rgb hsl контраст дизайн оттенки color picker пипетка",
    render(root) {
      root.append(U.h(`<div><div class="panel"><div class="row"><input type="color" id="pick" value="#6c8cff"><input type="text" id="hex" value="#6c8cff" style="max-width:160px">
        <button class="btn ghost small" id="rnd">🎲 Случайный</button><button class="btn ghost small" id="eye" hidden>💧 Пипетка с экрана</button></div>
        <div class="kpis" style="margin-top:14px" id="codes"></div></div>
        <div class="panel"><h3>Палитры</h3><div id="pal"></div></div>
        <div class="panel"><h3>Контраст текста</h3><div class="row" id="contrast"></div></div></div>`));
      const hexToRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
      const rgbToHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
      const rgbToHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
        if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
        return [h, s * 100, l * 100]; };
      const hslToHex = (h, s, l) => { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255); };
      const lum = (hex) => { const c = hexToRgb(hex).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const sw = (hex) => `<div class="swatch" style="background:${hex};color:${lum(hex) > .4 ? "#111" : "#fff"}" data-c="${hex}">${hex}</div>`;
      const set = (hex) => {
        if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
        if (hex[0] !== "#") hex = "#" + hex; hex = rgbToHex(...hexToRgb(hex));
        U.$("#pick", root).value = hex; if (document.activeElement !== U.$("#hex", root)) U.$("#hex", root).value = hex;
        const [r, g, b] = hexToRgb(hex), [h, s, l] = rgbToHsl(r, g, b);
        const codes = [hex.toUpperCase(), `rgb(${r}, ${g}, ${b})`, `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`];
        U.$("#codes", root).innerHTML = codes.map((c) => `<div class="kpi" style="cursor:pointer" data-copy="${c}"><b style="font-size:16px">${c}</b><span>нажми, чтобы скопировать</span></div>`).join("");
        const groups = {
          "Оттенки": [-36, -24, -12, 0, 12, 24, 36].map((d) => hslToHex(h, s, Math.max(4, Math.min(96, l + d)))),
          "Комплементарная": [hex, hslToHex(h + 180, s, l)],
          "Аналоговая": [-30, -15, 0, 15, 30].map((d) => hslToHex(h + d, s, l)),
          "Триада": [0, 120, 240].map((d) => hslToHex(h + d, s, l)),
          "Тетрада": [0, 90, 180, 270].map((d) => hslToHex(h + d, s, l)),
        };
        U.$("#pal", root).innerHTML = Object.entries(groups).map(([n, arr]) => `<p class="lbl" style="margin:10px 0 6px">${n}</p><div class="swatches">${arr.map(sw).join("")}</div>`).join("");
        U.$("#contrast", root).innerHTML = ["#ffffff", "#000000"].map((bg) => { const r2 = ratio(hex, bg);
          return `<div class="item grow" style="background:${bg};color:${hex}"><b style="font-size:20px">Текст Аа</b><span class="grow"></span><span style="color:${bg === "#fff" || bg === "#ffffff" ? "#111" : "#eee"}">${r2.toFixed(2)}:1 ${r2 >= 4.5 ? "✓ читается" : r2 >= 3 ? "~ только крупный" : "✗ плохо"}</span></div>`; }).join("");
      };
      root.addEventListener("click", (e) => {
        const c = e.target.closest("[data-c]"); if (c) { U.copy(c.dataset.c); set(c.dataset.c); }
        const k = e.target.closest("[data-copy]"); if (k) U.copy(k.dataset.copy);
      });
      U.$("#pick", root).oninput = (e) => set(e.target.value);
      U.$("#hex", root).oninput = (e) => set(e.target.value.trim());
      U.$("#rnd", root).onclick = () => set(hslToHex(U.rand(360), 55 + U.rand(35), 45 + U.rand(20)));
      if (window.EyeDropper) { const b = U.$("#eye", root); b.hidden = false; b.onclick = async () => { try { const r = await new window.EyeDropper().open(); set(r.sRGBHex); } catch (e) {} }; }
      set("#6c8cff");
    },
  });

  // ================= 12. Оптимизация ПК =================
  const PC_TIPS = [
    { g: "Быстрые победы", t: "Перезагрузи компьютер", why: "Если ПК не выключался неделями, память забивается. «Завершение работы» в Windows 11 часто не выключает его полностью — нужна именно перезагрузка.", how: ["Пуск → Выключение → Перезагрузка"] },
    { g: "Быстрые победы", t: "Убери лишнее из автозагрузки", why: "Главная причина медленного включения. Программы стартуют вместе с Windows и едят память.", how: ["Нажми Ctrl+Shift+Esc (Диспетчер задач)", "Слева «Автозагрузка приложений»", "Отключи то, что не нужно сразу (лаунчеры игр, мессенджеры, обновлялки). Антивирус и драйверы не трогай"] },
    { g: "Быстрые победы", t: "Закрой лишние вкладки и расширения браузера", why: "Каждая вкладка — это отдельный процесс. 30 вкладок легко съедают 3–4 ГБ памяти.", how: ["Закрой ненужные вкладки", "Открой страницу расширений (в адресной строке: chrome://extensions или edge://extensions) и удали ненужные", "В настройках браузера включи «Экономию памяти»"] },
    { g: "Место на диске", t: "Освободи место на диске C:", why: "Если свободно меньше 15%, Windows заметно тормозит при обновлениях и работе с файлами.", how: ["Параметры → Система → Память", "Открой «Временные файлы» и удали их", "Посмотри «Рекомендации по очистке»"], cmd: "cleanmgr" },
    { g: "Место на диске", t: "Включи «Контроль памяти»", why: "Windows сама будет чистить корзину и временные файлы.", how: ["Параметры → Система → Память", "Включи «Контроль памяти»"] },
    { g: "Место на диске", t: "Удали программы, которыми не пользуешься", why: "Старые программы занимают место и часто висят в фоне.", how: ["Параметры → Приложения → Установленные приложения", "Отсортируй по размеру и удали ненужное"], cmd: "appwiz.cpl" },
    { g: "Скорость и игры", t: "Выбери режим питания «Максимальная производительность»", why: "На ноутбуках по умолчанию стоит экономия — процессор работает медленнее.", how: ["Параметры → Система → Питание и батарея", "«Режим питания» → «Максимальная производительность»", "Ноутбук лучше держать на зарядке во время игр"] },
    { g: "Скорость и игры", t: "Включи «Игровой режим»", why: "Windows отдаёт игре больше ресурсов и не ставит обновления во время игры.", how: ["Параметры → Игры → Игровой режим → Вкл."] },
    { g: "Скорость и игры", t: "Обнови драйвер видеокарты", why: "Новые драйверы часто дают +5–20% FPS в новых играх и исправляют вылеты.", how: ["Узнай видеокарту: Диспетчер задач → Производительность → Графический процессор", "Скачай драйвер только с официального сайта NVIDIA, AMD или Intel"] },
    { g: "Скорость и игры", t: "Упрости визуальные эффекты (для слабых ПК)", why: "Анимации и тени нагружают старые видеокарты.", how: ["Нажми Win+R и введи команду ниже", "Вкладка «Дополнительно» → Быстродействие → Параметры", "Выбери «Обеспечить наилучшее быстродействие», потом верни «Сглаживание неровностей экранных шрифтов»"], cmd: "sysdm.cpl" },
    { g: "Скорость и игры", t: "Отключи прозрачность и анимации", why: "Немного разгружает слабые видеокарты и встроенную графику.", how: ["Параметры → Персонализация → Цвета → «Эффекты прозрачности» выкл.", "Параметры → Специальные возможности → Визуальные эффекты → «Эффекты анимации» выкл."] },
    { g: "Здоровье системы", t: "Установи обновления Windows", why: "Обновления закрывают дыры в безопасности и исправляют ошибки.", how: ["Параметры → Центр обновления Windows → Проверить наличие обновлений"] },
    { g: "Здоровье системы", t: "Проверь компьютер на вирусы", why: "Майнеры и рекламные вирусы — частая причина, почему ПК вдруг стал медленным.", how: ["Пуск → «Безопасность Windows» → Защита от вирусов и угроз", "«Параметры сканирования» → «Полное сканирование»"] },
    { g: "Здоровье системы", t: "Оптимизируй диски", why: "Для HDD Windows делает дефрагментацию, для SSD — команду TRIM. Вручную дефрагментировать SSD не нужно.", how: ["Нажми Win+R и введи команду ниже", "Выбери диск → «Оптимизировать»"], cmd: "dfrgui" },
    { g: "Здоровье системы", t: "Проверь, что грузит компьютер", why: "Если вентилятор шумит без причины — какая-то программа ест процессор.", how: ["Ctrl+Shift+Esc → вкладка «Процессы»", "Нажми на заголовок «ЦП», затем «Память» — сверху будут самые прожорливые", "Незнакомое название — сначала поищи в интернете, прежде чем закрывать"] },
    { g: "Железо", t: "Почисти ПК от пыли (вместе со взрослым)", why: "Пыль → перегрев → процессор сбрасывает частоту, и всё тормозит.", how: ["Выключи ПК из розетки", "Продуй решётки и вентиляторы баллоном со сжатым воздухом", "У ноутбука просто продуй решётки, разбирать не нужно"] },
    { g: "Железо", t: "Подумай об SSD или памяти", why: "Если Windows стоит на обычном жёстком диске (HDD), замена на SSD — самое сильное ускорение. 8 ГБ памяти сегодня — минимум, 16 ГБ — комфортно.", how: ["Диспетчер задач → Производительность → Диск: там написан тип (SSD/HDD)", "Там же во вкладке «Память» видно, сколько её установлено и занято"] },
  ];
  add({
    id: "pc-optimize", name: "Оптимизация ПК", icon: "🚀", cat: "productivity", hot: true,
    desc: "Пошаговый чек-лист ускорения Windows 11 + тест производительности твоего устройства.",
    tags: "оптимизация ускорить компьютер пк windows тормозит медленный fps игры автозагрузка очистка",
    render(root) {
      root.append(U.h(`<div><div class="panel"><h3>⚡ Тест твоего устройства</h3><p class="muted" style="margin-top:0">Быстрый тест скорости процессора прямо в браузере (не нагружает ПК надолго).</p>
        <div class="row"><button class="btn" id="bench">▶ Запустить тест</button><span id="bres" class="muted"></span></div><div class="kpis" style="margin-top:14px" id="dev"></div></div>
        <div class="panel"><div class="row"><h3 style="margin:0" class="grow">Чек-лист ускорения</h3><span id="prog" class="muted"></span><button class="btn ghost small" id="clr">Сбросить</button></div>
        <div class="meter" style="margin:12px 0 4px"><i id="bar" style="background:var(--good)"></i></div><div id="tips"></div></div></div>`));
      const done = U.store.get("pc-done", {});
      const tips = U.$("#tips", root); let group = "";
      PC_TIPS.forEach((tip, i) => {
        if (tip.g !== group) { group = tip.g; tips.append(U.h(`<p class="lbl" style="margin:18px 0 8px">${group}</p>`)); }
        const el = U.h(`<label class="check" style="margin-bottom:8px"><input type="checkbox" data-i="${i}"><div><strong>${tip.t}</strong><div class="muted" style="font-size:14px">${tip.why}</div>
          <details><summary>Как сделать</summary><ol>${tip.how.map((s) => `<li>${s}</li>`).join("")}</ol>${tip.cmd ? `<p>Команда для Win+R: <code class="cmd" data-cmd="${tip.cmd}">${tip.cmd}</code> (нажми, чтобы скопировать)</p>` : ""}</details></div></label>`);
        const cb = U.$("input", el); cb.checked = !!done[i]; el.classList.toggle("done", cb.checked);
        cb.onchange = () => { done[i] = cb.checked; el.classList.toggle("done", cb.checked); U.store.set("pc-done", done); prog(); };
        tips.append(el);
      });
      const prog = () => {
        const n = PC_TIPS.filter((_, i) => done[i]).length;
        U.$("#prog", root).textContent = `${n} из ${PC_TIPS.length}`; U.$("#bar", root).style.width = (n / PC_TIPS.length * 100) + "%";
        if (n === PC_TIPS.length) U.toast("🎉 Все шаги выполнены — компьютер должен летать!");
      };
      tips.addEventListener("click", (e) => { const c = e.target.closest("[data-cmd]"); if (c) { e.preventDefault(); U.copy(c.dataset.cmd, "Команда скопирована: Win+R → Ctrl+V → Enter"); } });
      U.$("#clr", root).onclick = () => { Object.keys(done).forEach((k) => delete done[k]); U.store.set("pc-done", done); U.$$("input[type=checkbox]", tips).forEach((c) => { c.checked = false; c.closest(".check").classList.remove("done"); }); prog(); };
      prog();
      const dev = [
        [navigator.hardwareConcurrency || "?", "потоков процессора"],
        [navigator.deviceMemory ? "≥ " + navigator.deviceMemory + " ГБ" : "—", "памяти (оценка браузера)"],
        [screen.width * (window.devicePixelRatio || 1) + "×" + screen.height * (window.devicePixelRatio || 1), "разрешение экрана"],
      ];
      U.$("#dev", root).innerHTML = dev.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
      U.$("#bench", root).onclick = () => {
        const b = U.$("#bench", root); b.disabled = true; U.$("#bres", root).textContent = "Считаю…";
        setTimeout(() => {
          const t0 = performance.now(); let ops = 0, x = 0;
          while (performance.now() - t0 < 1500) { for (let i = 0; i < 100000; i++) x += Math.sqrt(i * ops) % 7; ops++; }
          const score = Math.round(ops * 10);
          const lvl = score > 4500 ? ["🚀 Очень быстрый", "ok"] : score > 2500 ? ["👍 Хороший", "ok"] : score > 1200 ? ["🙂 Средний", ""] : ["🐢 Медленный — пройди чек-лист ниже", "err"];
          const prev = U.store.get("bench", 0);
          U.$("#bres", root).innerHTML = `Очки: <b>${score}</b> · <span class="${lvl[1]}">${lvl[0]}</span>${prev ? ` · прошлый результат: ${prev}` : ""}`;
          U.store.set("bench", score); b.disabled = false; if (x === -1) console.log(x);
        }, 50);
      };
    },
  });

  // ================= 13. Base64 / URL =================
  add({
    id: "encode", name: "Base64 и URL кодер", icon: "🔤", cat: "dev",
    desc: "Закодировать и раскодировать Base64 и URL. Картинку можно превратить в data:URL.",
    tags: "base64 url encode decode кодировать раскодировать data uri программист",
    render(root) {
      root.append(U.h(`<div class="panel"><textarea id="t" placeholder="Текст…"></textarea>
        <div class="row" style="margin-top:12px"><button class="btn small" data-op="b64e">→ Base64</button><button class="btn small ghost" data-op="b64d">Base64 →</button>
        <button class="btn small" data-op="urle">→ URL</button><button class="btn small ghost" data-op="urld">URL →</button>
        <label class="btn small ghost">🖼 Файл → data:URL<input type="file" id="f" hidden></label><button class="btn small ghost" id="cp">📋 Копировать</button><span id="st"></span></div></div>`));
      const t = U.$("#t", root), st = U.$("#st", root);
      const ops = {
        b64e: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))),
        b64d: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.trim().replace(/^data:[^,]*,/, "")), (c) => c.charCodeAt(0))),
        urle: (s) => encodeURIComponent(s), urld: (s) => decodeURIComponent(s.replace(/\+/g, " ")),
      };
      U.$$("[data-op]", root).forEach((b) => (b.onclick = () => {
        try { t.value = ops[b.dataset.op](t.value); st.innerHTML = `<span class="ok">✓</span>`; } catch (e) { st.innerHTML = `<span class="err">Некорректные данные</span>`; }
      }));
      U.$("#f", root).onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { t.value = r.result; st.textContent = U.bytes(r.result.length); }; r.readAsDataURL(f); };
      U.$("#cp", root).onclick = () => U.copy(t.value);
    },
  });

  // ================= 14. Проценты =================
  add({
    id: "percent", name: "Калькулятор процентов", icon: "％", cat: "calc",
    desc: "Процент от числа, скидка, наценка, на сколько процентов изменилась цена.",
    tags: "процент проценты скидка наценка калькулятор изменение цена",
    render(root) {
      const rows = [
        ["Сколько будет", "% от", (a, b) => a / 100 * b],
        ["Число", "это сколько % от", (a, b) => a / b * 100, "%"],
        ["Было", "стало. Изменение:", (a, b) => (b - a) / a * 100, "%"],
        ["Цена", "со скидкой %:", (a, b) => a * (1 - b / 100)],
        ["Цена", "с наценкой %:", (a, b) => a * (1 + b / 100)],
      ];
      root.append(U.h(`<div class="list" id="l"></div>`));
      rows.forEach(([p1, p2, fn, suf]) => {
        const el = U.h(`<div class="panel" style="margin:0"><div class="row"><span>${p1}</span><input type="number" style="width:120px"><span>${p2}</span><input type="number" style="width:120px"><span>=</span><b class="big-num" style="font-size:24px">—</b></div></div>`);
        const [a, b] = U.$$("input", el), out = U.$("b", el);
        const calc = () => { const r = fn(parseFloat(a.value), parseFloat(b.value)); out.textContent = isFinite(r) ? (r > 0 && suf && p1 === "Было" ? "+" : "") + U.num(r, 2) + (suf || "") : "—"; };
        a.oninput = b.oninput = calc; U.$("#l", root).append(el);
      });
    },
  });

  // ================= 15. Тест экрана =================
  add({
    id: "screen-test", name: "Тест экрана на битые пиксели", icon: "🖥️", cat: "productivity",
    desc: "Заливает экран чистыми цветами — сразу видно битые пиксели и засветы. Пригодится при покупке.",
    tags: "битые пиксели экран монитор тест засветы проверка дисплей покупка",
    render(root) {
      root.append(U.h(`<div class="panel"><p>Нажми «Начать». Экран станет одного цвета. <b>Клик или пробел</b> — следующий цвет, <b>Esc</b> — выход. Ищи точки, которые отличаются по цвету.</p>
        <button class="btn" id="go">▶ Начать тест</button></div>`));
      const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000", "#808080", "#ffff00", "#00ffff", "#ff00ff"];
      U.$("#go", root).onclick = () => {
        let i = 0; const d = U.h(`<div class="screen-test"></div>`); d.style.background = colors[0]; document.body.append(d);
        try { d.requestFullscreen && d.requestFullscreen(); } catch (e) {}
        const close = () => { d.remove(); document.removeEventListener("keydown", key); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} };
        const next = () => { i++; if (i >= colors.length) return close(); d.style.background = colors[i]; };
        const key = (e) => { if (e.key === "Escape") close(); else if (e.key === " " || e.key === "ArrowRight") { e.preventDefault(); next(); } };
        d.onclick = next; document.addEventListener("keydown", key);
        document.addEventListener("fullscreenchange", function fc() { if (!document.fullscreenElement && d.isConnected) close(); if (!d.isConnected) document.removeEventListener("fullscreenchange", fc); });
      };
    },
  });

  // ================= 16. Случайности =================
  add({
    id: "random", name: "Рандомайзер", icon: "🎲", cat: "fun",
    desc: "Случайное число, монетка, кубик и выбор из списка — для конкурсов и споров.",
    tags: "случайное число рандом монетка кубик жребий выбор из списка розыгрыш",
    render(root) {
      root.append(U.h(`<div><div class="two">
        <div class="panel" style="margin:0"><h3>Случайное число</h3><div class="row"><input type="number" id="a" value="1" style="width:110px"><span>—</span><input type="number" id="b" value="100" style="width:110px"><button class="btn" id="gn">🎲</button></div><div class="timer" style="font-size:64px" id="n">?</div></div>
        <div class="panel" style="margin:0"><h3>Монетка и кубик</h3><div class="row"><button class="btn" id="coin">🪙 Подбросить</button><button class="btn ghost" id="dice">🎲 Кубик</button></div><div class="timer" style="font-size:56px" id="cd">?</div></div></div>
        <div class="panel" style="margin-top:16px"><h3>Выбор из списка</h3><textarea id="list" class="prose" placeholder="Каждый вариант с новой строки" style="min-height:120px">Пицца\nСуши\nБургер</textarea>
        <div class="row" style="margin-top:12px"><button class="btn" id="pick">🎯 Выбрать</button><button class="btn ghost" id="shuf">🔀 Перемешать</button></div><div class="out" id="res" style="margin-top:12px">—</div></div></div>`));
      const spin = (el, fn) => { let k = 0; const iv = setInterval(() => { el.textContent = fn(); if (++k > 10) clearInterval(iv); }, 50); };
      U.$("#gn", root).onclick = () => { let a = Math.ceil(+U.$("#a", root).value), b = Math.floor(+U.$("#b", root).value); if (a > b) [a, b] = [b, a]; spin(U.$("#n", root), () => a + U.rand(b - a + 1)); };
      U.$("#coin", root).onclick = () => spin(U.$("#cd", root), () => (U.rand(2) ? "Орёл" : "Решка"));
      U.$("#dice", root).onclick = () => spin(U.$("#cd", root), () => "⚀⚁⚂⚃⚄⚅"[U.rand(6)] + " " );
      const items = () => U.$("#list", root).value.split("\n").map((s) => s.trim()).filter(Boolean);
      U.$("#pick", root).onclick = () => { const it = items(); if (!it.length) return; spin(U.$("#res", root), () => it[U.rand(it.length)]); };
      U.$("#shuf", root).onclick = () => { const it = items(); for (let i = it.length - 1; i > 0; i--) { const j = U.rand(i + 1); [it[i], it[j]] = [it[j], it[i]]; } U.$("#res", root).innerHTML = it.map((x, i) => `${i + 1}. ${U.esc(x)}`).join("<br>"); };
    },
  });

  // ================= 17. Калькулятор дат =================
  add({
    id: "dates", name: "Калькулятор дат", icon: "📅", cat: "calc",
    desc: "Сколько дней до каникул, дня рождения или Нового года. Разница между датами.",
    tags: "дата дни до сколько дней осталось разница каникулы день рождения новый год возраст",
    render(root) {
      const today = new Date(), iso = (d) => d.toISOString().slice(0, 10);
      const ny = new Date(today.getFullYear() + 1, 0, 1);
      root.append(U.h(`<div><div class="panel"><h3>Разница между датами</h3><div class="row"><input type="date" id="d1" style="width:auto"><span>→</span><input type="date" id="d2" style="width:auto"></div>
        <div class="kpis" style="margin-top:14px" id="diff"></div></div>
        <div class="panel"><h3>Обратный отсчёт</h3><div class="row"><input type="datetime-local" id="tgt" style="width:auto"><button class="btn ghost small" id="ny">🎄 До Нового года</button></div>
        <div class="timer" style="font-size:clamp(36px,8vw,64px)" id="cd">—</div></div></div>`));
      U.$("#d1", root).value = iso(today); U.$("#d2", root).value = iso(ny);
      const diff = () => {
        const a = new Date(U.$("#d1", root).value), b = new Date(U.$("#d2", root).value); if (isNaN(a) || isNaN(b)) return;
        const days = Math.round((b - a) / 86400000), ab = Math.abs(days);
        let wd = 0; const s = new Date(Math.min(a, b)); for (let i = 0; i < ab && i < 40000; i++) { const g = s.getDay(); if (g !== 0 && g !== 6) wd++; s.setDate(s.getDate() + 1); }
        U.$("#diff", root).innerHTML = [[U.num(days, 0), U.plural(ab, "день", "дня", "дней")], [U.num(ab / 7, 1), "недель"], [U.num(ab / 30.44, 1), "месяцев"], [U.num(wd, 0), "будних дней"], [U.num(ab * 24, 0), "часов"]]
          .map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
      };
      U.$("#d1", root).oninput = U.$("#d2", root).oninput = diff; diff();
      const tgt = U.$("#tgt", root);
      const setNY = () => { tgt.value = `${ny.getFullYear()}-01-01T00:00`; };
      U.$("#ny", root).onclick = setNY; setNY();
      const tick = () => {
        const ms = new Date(tgt.value) - Date.now(); if (isNaN(ms)) return;
        if (ms <= 0) { U.$("#cd", root).textContent = "🎉 Наступило!"; return; }
        const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
        U.$("#cd", root).textContent = `${d} д ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };
      const iv = setInterval(tick, 1000); tick();
      return () => clearInterval(iv);
    },
  });

  // ================= 18. Заметки =================
  add({
    id: "notes", name: "Быстрые заметки", icon: "📝", cat: "productivity",
    desc: "Блокнот, который сам сохраняется в браузере. Можно скачать как .txt.",
    tags: "заметки блокнот записи текст сохранить todo список дел",
    render(root) {
      root.append(U.h(`<div class="panel"><textarea id="t" class="prose" style="min-height:360px" placeholder="Пиши — всё сохраняется автоматически…"></textarea>
        <div class="row" style="margin-top:12px"><button class="btn" id="dl">⬇ Скачать .txt</button><button class="btn ghost" id="cp">📋 Копировать</button><button class="btn ghost" id="clr">🗑 Очистить</button><span class="muted" id="st"></span></div></div>`));
      const t = U.$("#t", root); t.value = U.store.get("notes", "");
      let tm; t.oninput = () => { clearTimeout(tm); U.$("#st", root).textContent = "…"; tm = setTimeout(() => { U.store.set("notes", t.value); U.$("#st", root).textContent = "Сохранено ✓"; }, 400); };
      U.$("#dl", root).onclick = () => U.download(new Blob([t.value], { type: "text/plain;charset=utf-8" }), "заметки.txt");
      U.$("#cp", root).onclick = () => U.copy(t.value);
      U.$("#clr", root).onclick = () => { if (confirm("Удалить все заметки?")) { t.value = ""; U.store.set("notes", ""); } };
    },
  });

  // ================= 19. Тест реакции =================
  add({
    id: "reaction", name: "Тест реакции", icon: "⚡", cat: "fun",
    desc: "Нажми, как только экран станет зелёным. Средняя реакция геймера — около 200–250 мс.",
    tags: "реакция тест скорость реакции геймер мс клик игра",
    render(root) {
      root.append(U.h(`<div><div id="box" style="height:300px;border-radius:16px;display:grid;place-items:center;font-size:26px;font-weight:800;cursor:pointer;user-select:none;text-align:center;padding:16px;color:#fff;background:#2563eb">Нажми, чтобы начать</div>
        <div class="kpis" style="margin-top:16px"><div class="kpi"><b id="last">—</b><span>последний, мс</span></div><div class="kpi"><b id="avg">—</b><span>средний из 5</span></div><div class="kpi"><b id="best">—</b><span>рекорд, мс</span></div></div></div>`));
      const box = U.$("#box", root); let state = "idle", t0 = 0, to, res = [];
      const set = (bg, txt) => { box.style.background = bg; box.textContent = txt; };
      const best = () => (U.$("#best", root).textContent = U.store.get("react-best", 0) || "—"); best();
      box.onpointerdown = () => {
        if (state === "idle" || state === "done") { state = "wait"; set("#dc2626", "Жди зелёный…"); to = setTimeout(() => { state = "go"; t0 = performance.now(); set("#16a34a", "ЖМИ!"); }, 1200 + U.rand(2500)); }
        else if (state === "wait") { clearTimeout(to); state = "done"; set("#ea580c", "Рано! Нажми, чтобы попробовать снова"); }
        else if (state === "go") {
          const ms = Math.round(performance.now() - t0); state = "done"; res.push(ms); res = res.slice(-5);
          U.$("#last", root).textContent = ms; U.$("#avg", root).textContent = Math.round(res.reduce((a, b) => a + b, 0) / res.length);
          const b = U.store.get("react-best", 0); if (!b || ms < b) { U.store.set("react-best", ms); best(); }
          set("#2563eb", `${ms} мс ${ms < 200 ? "🔥 Отлично!" : ms < 280 ? "👍 Хорошо" : "🙂 Можно быстрее"} — нажми ещё`);
        }
      };
      return () => clearTimeout(to);
    },
  });

  // ================= 20. Генератор текста-заглушки / ника =================
  add({
    id: "nickname", name: "Генератор ников", icon: "🦊", cat: "fun",
    desc: "Крутые ники для игр, Discord и соцсетей. Нажимай, пока не найдёшь свой.",
    tags: "ник никнейм генератор имя для игры discord roblox minecraft",
    render(root) {
      const A = ["Shadow", "Neon", "Pixel", "Frost", "Turbo", "Silent", "Cosmic", "Lucky", "Crazy", "Iron", "Night", "Storm", "Cyber", "Hyper", "Ghost", "Blaze", "Mystic", "Atomic", "Lunar", "Red"];
      const B = ["Fox", "Wolf", "Ninja", "Dragon", "Rider", "Hunter", "Panda", "Falcon", "Knight", "Tiger", "Byte", "Comet", "Viper", "Phoenix", "Raven", "Golem", "Shark", "Wizard", "Bear", "Owl"];
      root.append(U.h(`<div class="panel"><div class="row"><select id="st" style="width:auto"><option value="0">ShadowFox</option><option value="1">shadow_fox</option><option value="2">xShadowFoxx</option><option value="3">ShadowFox777</option></select>
        <button class="btn" id="g">🎲 Сгенерировать</button></div><div class="list" id="l" style="margin-top:14px"></div></div>`));
      const make = (s) => {
        const a = A[U.rand(A.length)], b = B[U.rand(B.length)];
        return [a + b, (a + "_" + b).toLowerCase(), "x" + a + b + "x", a + b + (U.rand(900) + 100)][s];
      };
      const gen = () => {
        const s = +U.$("#st", root).value, l = U.$("#l", root); l.innerHTML = "";
        for (let i = 0; i < 8; i++) { const n = make(s); const it = U.h(`<div class="item"><b class="grow" style="font-size:18px">${n}</b><button class="btn small ghost">📋</button></div>`); it.lastElementChild.onclick = () => U.copy(n); l.append(it); }
      };
      U.$("#g", root).onclick = gen; U.$("#st", root).onchange = gen; gen();
    },
  });

  window.TOOLS = T;
  window.PC_TIPS = PC_TIPS;
})();
