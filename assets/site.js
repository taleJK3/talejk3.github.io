/* = tale(JK, 3) 共通スクリプト
 * 1. 言語の決定と切り替え（?lang= → 保存した選択 → ブラウザの言語）
 * 2. 各ページの window.SITE（変わりうる値）をページへ反映
 * <head> で同期的に読み込み、表示前に言語を確定させる。
 */
(function () {
  var root = document.documentElement;
  var LANGS = ["ja", "en"];

  function pickLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (LANGS.indexOf(q) >= 0) return q;
    } catch (e) {}
    try {
      var saved = localStorage.getItem("lang");
      if (LANGS.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    return /^ja\b/i.test(list[0] || "") ? "ja" : "en";
  }

  var lang = pickLang();
  root.setAttribute("data-lang", lang);
  root.lang = lang;

  function site() { return window.SITE || {}; }

  // {ja, en} か文字列かを受け取り、現在の言語の文字列を返す
  function t(v) { return v && typeof v === "object" ? (v[lang] || v.ja || "") : (v || ""); }

  function get(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, site());
  }

  // 日時（ISO文字列）を、日本語は日本時間、英語は太平洋時間で表示する
  function formatDate(iso) {
    var d = new Date(iso);
    if (lang === "ja") {
      var p = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(d);
      var m = {};
      p.forEach(function (x) { m[x.type] = x.value; });
      return m.month + "月" + m.day + "日（" + m.weekday + "）" + m.hour + ":" + m.minute;
    }
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  }

  function festPeriod(f) {
    if (!f || !f.start) return "";
    var tz = lang === "ja" ? "（日本時間）" : " PT";
    return formatDate(f.start) + " – " + formatDate(f.end) + tz;
  }

  function render() {
    var s = site();
    document.title = t(s.title) || document.title;
    root.setAttribute("data-demo", s.demoLive ? "live" : "soon");

    document.querySelectorAll("[data-k]").forEach(function (el) {
      el.textContent = t(get(el.getAttribute("data-k")));
    });
    document.querySelectorAll("[data-href]").forEach(function (el) {
      var v = t(get(el.getAttribute("data-href")));
      if (v) el.setAttribute("href", v);
    });
    document.querySelectorAll("[data-src]").forEach(function (el) {
      var v = t(get(el.getAttribute("data-src")));
      if (v && el.getAttribute("src") !== v) el.setAttribute("src", v);
    });
    document.querySelectorAll("[data-fest-period]").forEach(function (el) {
      el.textContent = festPeriod(s.fest);
    });

    // フェスの状態：開催前／開催中は表示、終了後は data-fest を隠す
    if (s.fest && s.fest.end) {
      var now = Date.now();
      var state = now < Date.parse(s.fest.start) ? "upcoming" : now < Date.parse(s.fest.end) ? "live" : "ended";
      root.setAttribute("data-fest", state);
      document.querySelectorAll("[data-fest]").forEach(function (el) {
        if (el === root) return;
        el.hidden = state === "ended";
      });
    }

    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set-lang") === lang));
    });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    lang = next;
    root.setAttribute("data-lang", lang);
    root.lang = lang;
    try { localStorage.setItem("lang", lang); } catch (e) {}
    document.querySelectorAll("video").forEach(function (v) { v.pause(); });
    render();
  }

  // ---- ライトボックス：.shots 内の画像リンクをページ上で拡大表示する ----
  // JSが動かないときは、リンクのまま別タブで画像を開く。
  function initLightbox() {
    var links = document.querySelectorAll(".shots a");
    if (!links.length || typeof HTMLDialogElement !== "function") return;

    var dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Screenshot");
    dlg.innerHTML =
      '<img class="lightbox-img" alt="">' +
      '<button type="button" class="lightbox-btn lightbox-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous">&#8249;</button>' +
      '<button type="button" class="lightbox-btn lightbox-next" aria-label="Next">&#8250;</button>' +
      '<p class="lightbox-count" aria-live="polite"></p>';
    document.body.appendChild(dlg);

    var img = dlg.querySelector(".lightbox-img");
    var count = dlg.querySelector(".lightbox-count");
    var items = [];
    var index = 0;

    // 表示中の言語のスクショだけを順番にめくる
    function visibleLinks() {
      return Array.prototype.filter.call(links, function (a) { return a.offsetParent !== null; });
    }

    function show(i) {
      index = (i + items.length) % items.length;
      var a = items[index];
      var thumb = a.querySelector("img");
      img.src = a.getAttribute("href");
      img.alt = thumb ? thumb.alt : "";
      count.textContent = (index + 1) + " / " + items.length;
      // 前後の画像を先読みしておく
      [index - 1, index + 1].forEach(function (j) {
        var n = items[(j + items.length) % items.length];
        if (n) new Image().src = n.getAttribute("href");
      });
    }

    function open(a) {
      items = visibleLinks();
      // 1枚だけなら前後ボタンと枚数表示は出さない
      dlg.classList.toggle("lightbox-single", items.length < 2);
      show(Math.max(0, items.indexOf(a)));
      root.classList.add("lightbox-open");
      dlg.showModal();
    }

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        // 新しいタブで開く操作（Ctrl/⌘/Shift/中クリック）はそのまま通す
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(a);
      });
    });

    dlg.querySelector(".lightbox-close").addEventListener("click", function () { dlg.close(); });
    dlg.querySelector(".lightbox-prev").addEventListener("click", function () { show(index - 1); });
    dlg.querySelector(".lightbox-next").addEventListener("click", function () { show(index + 1); });
    dlg.addEventListener("close", function () { root.classList.remove("lightbox-open"); });

    // 画像やボタン以外（暗い背景）をクリックしたら閉じる
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });

    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    });

    // スマホ：横スワイプで前後へ
    var startX = null, startY = null;
    dlg.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-set-lang")); });
    });
    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
    initLightbox();
    render();
  });
})();
