"use strict";

/* =======================
   Google Sheets Konfig
======================= */
const FILE_ID = "17xGRFGn3IODc7Xp-6fDHlV1E5gzWD287L5_I-qdg5Kk";
function getCSVUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${FILE_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

/* =======================
   Globaler Zustand
======================= */
let showOnlyFavorites = false;   // عرض المفضلات فقط
let currentSentences = [];       // السطور الحالية
let currentCategory = null;      // { name, gid }

// وضع عرض العين في الشريط العلوي: 'visible' | 'hidden' | 'all'
let eyeViewMode = localStorage.getItem("eyeViewMode") || "visible"; // الافتراضي: المرئية فقط

/* =======================
   Utilities
======================= */
function norm(v) {
  return (v ?? "").toString().replace(/\uFEFF/g, "").trim();
}
function safeGet(o, ...keys) {
  for (const k of keys) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
  }
  return undefined;
}

/* =======================
   Sidebar toggle
======================= */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const isOpen = sidebar.classList.toggle("hidden");
  document.body.classList.toggle("sidebar-open", !isOpen);

  if (!sidebar.classList.contains("hidden")) {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// أغلق الـ Sidebar عند الضغط خارجَه
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  const btn = document.querySelector(".menu-btn");
  if (!sidebar) return;
  const clickedInsideSidebar = sidebar.contains(e.target);
  const clickedMenuBtn = btn && btn.contains(e.target);
  if (!clickedInsideSidebar && !clickedMenuBtn) {
    sidebar.classList.add("hidden");
    document.body.classList.remove("sidebar-open");
  }
});

/* =======================
   Dark mode
======================= */
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const h2 = document.querySelector(".topbar h2");
  if (h2) h2.style.opacity = document.body.classList.contains("dark") ? "0.9" : "1";
}

/* =======================
   Help
======================= */
function showHelp() {
  document.getElementById("helpBox").style.display = "block";
}
function hideHelp() {
  document.getElementById("helpBox").style.display = "none";
}

/* =======================
   Loader overlay
======================= */
function showLoader() {
  const o = document.getElementById('loaderOverlay');
  if (o) o.style.display = 'flex';
}
function hideLoader() {
  const o = document.getElementById('loaderOverlay');
  if (o) o.style.display = 'none';
}

/* =======================
   Speech
======================= */
function speak(text) {
  if (!text) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    speechSynthesis.cancel(); // أوقف أي نطق سابق
    speechSynthesis.speak(utterance);
  } catch (e) {}
}

/* =======================
   Favorites (global toggle)
======================= */
function toggleFavoritesView(btn) {
  showOnlyFavorites = !showOnlyFavorites;
  btn.classList.toggle("active", showOnlyFavorites);
  btn.innerText = showOnlyFavorites ? "★" : "☆";
  if (currentCategory) {
    loadSentences(currentCategory.name, currentCategory.gid, null, false, false);
  }
}

/* =======================
   Favorites per sentence
======================= */
function toggleFavorite(id, btn) {
  let favs = JSON.parse(localStorage.getItem("favs") || "[]");
  if (favs.includes(id)) {
    favs = favs.filter(f => f !== id);
    btn.classList.remove("active");
  } else {
    favs.push(id);
    btn.classList.add("active");
  }
  localStorage.setItem("favs", JSON.stringify(favs));
}
function isFavorite(id) {
  const favs = JSON.parse(localStorage.getItem("favs") || "[]");
  return favs.includes(id);
}

/* =======================
   Hidden (per sentence)
======================= */
function getHiddenList() {
  return JSON.parse(localStorage.getItem("hidden") || "[]");
}
function setHiddenList(arr) {
  localStorage.setItem("hidden", JSON.stringify(arr));
}
function isHidden(id) {
  const hidden = getHiddenList();
  return hidden.includes(id);
}

// (◉/◎) — يغيّر الحالة والرمز فقط، لا يخفي/يظهر البطاقة مباشرة
function toggleHidden(id, btn) {
  let hidden = getHiddenList();
  const wasHidden = hidden.includes(id);

  if (wasHidden) {
    hidden = hidden.filter(h => h !== id); // أصبحت مرئية
  } else {
    hidden.push(id); // أصبحت مخفية
  }
  setHiddenList(hidden);

  const nowHidden = !wasHidden;
  btn.textContent = nowHidden ? "◎" : "◉";
  btn.title = nowHidden ? "هذه الجملة مخفية" : "هذه الجملة مرئية";
  btn.classList.toggle("is-hidden", nowHidden);
  btn.classList.toggle("is-visible", !nowHidden);
}

/* =======================
   Hidden topbar (three-state)
======================= */
function applyEyeViewButtonVisual() {
  const btn = document.getElementById("toggleHiddenBtn");
  if (!btn) return;
  btn.classList.remove("mode-visible","mode-hidden","mode-all");

  if (eyeViewMode === "visible") {
    btn.innerText = "◉";
    btn.classList.add("mode-visible");
    btn.title = "عرض: المرئية فقط";
  } else if (eyeViewMode === "hidden") {
    btn.innerText = "◎";
    btn.classList.add("mode-hidden");
    btn.title = "عرض: المخفية فقط";
  } else {
    btn.innerText = "◐";
    btn.classList.add("mode-all");
    btn.title = "عرض: الجميع";
  }
}
function cycleHiddenView() {
  // visible -> hidden -> all -> visible
  eyeViewMode = eyeViewMode === "visible" ? "hidden" :
                eyeViewMode === "hidden"  ? "all"     : "visible";
  localStorage.setItem("eyeViewMode", eyeViewMode);
  applyEyeViewButtonVisual();

  // إعادة التحميل مع فلترة + شاشة تحميل (٤ ثوانٍ كحد أدنى)
  if (currentCategory) {
    loadSentences(currentCategory.name, currentCategory.gid, null, true, true);
  } else {
    showLoader();
    setTimeout(hideLoader, 4000);
  }
}

/* =======================
   Load sentences (4s minimum wait when needed)
======================= */
function loadSentences(name, gid, lastIndex = null, fromStorage = false, useHourglass = true) {
  currentCategory = { name, gid };
  if (!fromStorage) localStorage.setItem("lastSentenceIndex", "");
  localStorage.setItem("lastCategory", JSON.stringify({ name, gid }));
  const title = document.getElementById("mainTitle");
  if (title) title.innerText = name;

  const container = document.getElementById("sentenceList");
  if (container) container.innerHTML = "";

  // ساعة رملية تغطي الشاشة
  if (useHourglass) showLoader();

  // مؤقت ٤ ثوانٍ كحدّ أدنى
  const minWait = new Promise(res => setTimeout(res, 4000));

  // تحميل CSV (aus FILE_ID/export)
  const loadCSV = new Promise((resolve, reject) => {
    Papa.parse(
      getCSVUrl(gid),
      {
        download: true,
        header: true,
        skipEmptyLines: "greedy",
        complete: function (results) {
          if (results && results.errors && results.errors.length) {
            reject(results.errors[0]);
          } else {
            resolve(results.data || []);
          }
        },
        error: function (err) { reject(err); }
      }
    );
  });

  // انتظر الملف + ٤ ثوانٍ معًا
  Promise.all([minWait, loadCSV]).then(([, rows]) => {
    // Spaltennamen robust lesen
    const normalized = (rows || []).map(r => ({
      Arabisch:       norm(safeGet(r, "Arabisch", "arabisch", "ARABISCH")),
      Hochdeutsch:    norm(safeGet(r, "Hochdeutsch", "hochdeutsch", "HOCHDEUTSCH")),
      Umgangssprache: norm(safeGet(r, "Umgangssprache", "umgangssprache", "Umg"))
    }));

    currentSentences = normalized;
    const favs = JSON.parse(localStorage.getItem("favs") || "[]");

    // بناء البطاقات
    currentSentences.forEach((row, index) => {
      const id = `${gid}_${index}`;
      const fav = favs.includes(id);
      const hidden = isHidden(id);

      // فلترة بحسب زر المفضلة + وضع العين
      if (showOnlyFavorites && !fav) return;
      if (eyeViewMode === "visible" && hidden) return; // لا نعرض المخفية
      if (eyeViewMode === "hidden" && !hidden) return; // لا نعرض المرئية
      // في وضع "all" نعرض الجميع

      const card = document.createElement("div");
      card.className = "sentence";

      const arabic = document.createElement("div");
      arabic.className = "arabic";
      arabic.textContent = row.Arabisch || "";
      card.appendChild(arabic);

      // الترجمتان
      const transDiv = document.createElement("div");
      transDiv.className = "translation";
      if (index === lastIndex) {
        transDiv.style.display = "flex";
      }

      const hochLine = document.createElement("div");
      hochLine.className = "translation-line";
      hochLine.innerHTML =
        `<span class='hochdeutsch'>${row.Hochdeutsch || ""}</span>` +
        `<button class='speak-btn speak-hoch' onclick='event.stopPropagation(); speak(\`${row.Hochdeutsch || ""}\`)'>🗣️</button>`;

      const umgLine = document.createElement("div");
      umgLine.className = "translation-line";
      umgLine.innerHTML =
        `<span class='umgangssprache'>${row.Umgangssprache || ""}</span>` +
        `<button class='speak-btn speak-umgang' onclick='event.stopPropagation(); speak(\`${row.Umgangssprache || ""}\`)'>🗣️</button>`;

      transDiv.appendChild(hochLine);
      transDiv.appendChild(umgLine);
      card.appendChild(transDiv);

      // ===== شريط الإجراءات أسفل البطاقة =====
      const actions = document.createElement("div");
      actions.className = "card-actions";

      // زر المفضلة
      const favBtn = document.createElement("button");
      favBtn.className = "action-btn fav-btn";
      if (fav) favBtn.classList.add("active");
      favBtn.title = fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة";
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(id, favBtn);
        favBtn.title = isFavorite(id) ? "إزالة من المفضلة" : "إضافة إلى المفضلة";
      });

      // زر العين (◉ مرئية / ◎ مخفية) — لا يخفي البطاقة مباشرة
      const eyeBtn = document.createElement("button");
      eyeBtn.className = "action-btn eye-btn";
      eyeBtn.textContent = hidden ? "◎" : "◉";
      eyeBtn.classList.toggle("is-visible", !hidden);
      eyeBtn.classList.toggle("is-hidden", hidden);
      eyeBtn.title = hidden ? "هذه الجملة مخفية" : "هذه الجملة مرئية";
      eyeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHidden(id, eyeBtn);
      });

      actions.appendChild(favBtn);
      actions.appendChild(eyeBtn);
      card.appendChild(actions);

      // النقر على البطاقة يبدّل ظهور الترجمة
      card.addEventListener("click", () => {
        const isVisible = transDiv.style.display === "flex";
        transDiv.style.display = isVisible ? "none" : "flex";
        if (!isVisible) localStorage.setItem("lastSentenceIndex", index);
      });

      container.appendChild(card);
    });

    hideLoader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }).catch((err) => {
    console.error("[loadSentences] CSV error:", err);
    hideLoader();
    const container = document.getElementById("sentenceList");
    if (container) container.innerHTML = "<div style='text-align:center; padding:20px;'>تعذّر التحميل (CSV). تحقّق من الصلاحيات/الإنترنت وحاول مجددًا.</div>";
  });
}

/* =======================
   Load categories (gid=0)
======================= */
function loadCategories() {
  Papa.parse(
    getCSVUrl(0), // Kategorien-Tab = gid=0 (wie von dir angegeben)
    {
      download: true,
      header: true,
      skipEmptyLines: "greedy",
      complete: function (results) {
        const container = document.getElementById("categoryContainer");
        container.innerHTML = "";
        const grouped = {};

        // Header robust lesen
        const rows = (results.data || []).map(r => ({
          main: norm(safeGet(r, "main", "\ufeffmain", " main")),
          name: norm(safeGet(r, "name", " Name")),
          gid:  norm(safeGet(r, "gid", " Gid"))
        })).filter(r => r.main && r.name && r.gid);

        if (!rows.length) {
          container.textContent = "Keine Kategorien gefunden. Prüfe Spalten: main, name, gid.";
          return;
        }

        // group by main
        rows.forEach(row => {
          if (!grouped[row.main]) grouped[row.main] = [];
          grouped[row.main].push(row);
        });

        Object.keys(grouped).forEach(main => {
          const title = document.createElement("h3");
          title.innerText = main;
          title.onclick = () => {
            const sub = title.nextElementSibling;
            sub.style.display = sub.style.display === "flex" ? "none" : "flex";
          };

          const subList = document.createElement("div");
          subList.className = "subcategories";
          subList.style.display = "none";

          grouped[main].forEach(cat => {
            const item = document.createElement("div");
            item.className = "subcategory";
            item.innerText = cat.name;
            item.onclick = () => {
              document.getElementById("sidebar").classList.add("hidden");
              document.body.classList.remove("sidebar-open");
              // ساعة رملية ٤ ثواني عند فتح Unterkategorie
              loadSentences(cat.name, cat.gid, null, false, true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            subList.appendChild(item);
          });

          container.appendChild(title);
          container.appendChild(subList);
        });
      }
    }
  );
}

/* =======================
   Boot
======================= */
window.onload = function () {
  const lastCat = JSON.parse(localStorage.getItem("lastCategory") || "null");
  const lastIndex = parseInt(localStorage.getItem("lastSentenceIndex"));

  // اضبط مظهر زر العين العلوي بحسب آخر وضع محفوظ
  applyEyeViewButtonVisual();

  loadCategories();

  if (lastCat && lastCat.name && lastCat.gid) {
    // استرجاع آخر قسم بدون انتظار
    loadSentences(lastCat.name, lastCat.gid, isNaN(lastIndex) ? null : lastIndex, true, false);
  }
};

/* =======================
   Expose globale Funktionen
======================= */
window.toggleSidebar = toggleSidebar;
window.toggleDarkMode = toggleDarkMode;
window.showHelp = showHelp;
window.hideHelp = hideHelp;
window.speak = speak;
window.toggleFavoritesView = toggleFavoritesView;
window.cycleHiddenView = cycleHiddenView;
