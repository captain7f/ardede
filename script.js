// ===== Global state =====
let showOnlyFavorites = false;   // عرض المفضلات فقط
let currentSentences = [];       // السطور الحالية
let currentCategory = null;      // { name, gid }

// وضع عرض العين في الشريط العلوي: 'visible' | 'hidden' | 'all'
// الافتراضي: عرض المرئية فقط
let eyeViewMode = localStorage.getItem("eyeViewMode") || "visible";

// ===== Sidebar toggle =====
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

// ===== Dark mode =====
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const h2 = document.querySelector(".topbar h2");
  if (h2) h2.style.opacity = document.body.classList.contains("dark") ? "0.9" : "1";
}

// ===== Help =====
function showHelp() {
  document.getElementById("helpBox").style.display = "block";
}
function hideHelp() {
  document.getElementById("helpBox").style.display = "none";
}

// ===== Loader overlay =====
function showLoader() {
  const o = document.getElementById('loaderOverlay');
  if (o) o.style.display = 'flex';
}
function hideLoader() {
  const o = document.getElementById('loaderOverlay');
  if (o) o.style.display = 'none';
}

// ===== Speech =====
function speak(text) {
  if (!text) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    speechSynthesis.cancel(); // أوقف أي نطق سابق لتحسين التجربة
    speechSynthesis.speak(utterance);
  } catch (e) {}
}

// ===== Favorites (global toggle) =====
function toggleFavoritesView(btn) {
  showOnlyFavorites = !showOnlyFavorites;
  btn.classList.toggle("active", showOnlyFavorites);
  btn.innerText = showOnlyFavorites ? "★" : "☆";
  if (currentCategory) {
    loadSentences(currentCategory.name, currentCategory.gid, null, false, false); // بدون انتظار
  }
}

// ===== Favorites per sentence =====
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

// ===== Hidden (per sentence) =====
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
function toggleHidden(id, btn, card) {
  let hidden = getHiddenList();
  const wasHidden = hidden.includes(id);

  if (wasHidden) {
    // أصبحت مرئية
    hidden = hidden.filter(h => h !== id);
    btn.classList.add("active"); // عين غامقة (مرئية)
  } else {
    // أصبحت مخفية
    hidden.push(id);
    btn.classList.remove("active"); // عين فارغة (مخفية)
  }
  setHiddenList(hidden);

  // إن كنا في وضع "عرض المرئية فقط"، أخفِ البطاقة فورًا عند إخفائها
  if (!wasHidden && eyeViewMode === "visible" && card) {
    card.style.display = "none";
  }
  // وإن كنا في وضع "عرض المخفية فقط"، أخفِ البطاقة عند إظهارها
  if (wasHidden && eyeViewMode === "hidden" && card) {
    card.style.display = "none";
  }
}

// ===== Hidden topbar (three-state) =====
function applyEyeViewButtonVisual() {
  const btn = document.getElementById("toggleHiddenBtn");
  if (!btn) return;
  btn.classList.remove("mode-visible","mode-hidden","mode-all");
  if (eyeViewMode === "visible") {
    btn.classList.add("mode-visible");
    btn.title = "عرض: المرئية فقط";
    btn.innerText = "👁️";
  } else if (eyeViewMode === "hidden") {
    btn.classList.add("mode-hidden");
    btn.title = "عرض: المخفية فقط";
    btn.innerText = "👁️";
  } else {
    btn.classList.add("mode-all");
    btn.title = "عرض: الجميع";
    btn.innerText = "👁️";
  }
}
function cycleHiddenView() {
  // visible -> hidden -> all -> visible
  eyeViewMode = eyeViewMode === "visible" ? "hidden" :
                eyeViewMode === "hidden"  ? "all"     : "visible";
  localStorage.setItem("eyeViewMode", eyeViewMode);
  applyEyeViewButtonVisual();

  // أعد التحميل وفق الفلترة الجديدة (بدون انتظار وبدون ساعة رملية)
  if (currentCategory) {
    loadSentences(currentCategory.name, currentCategory.gid, null, false, false);
  }
}

// ===== Load sentences with 4s minimum wait when needed =====
function loadSentences(name, gid, lastIndex = null, fromStorage = false, useHourglass = true) {
  currentCategory = { name, gid };
  if (!fromStorage) localStorage.setItem("lastSentenceIndex", "");
  localStorage.setItem("lastCategory", JSON.stringify({ name, gid }));
  const title = document.getElementById("mainTitle");
  if (title) title.innerText = name;

  const container = document.getElementById("sentenceList");
  if (container) container.innerHTML = "";

  // ساعة رملية تغطي الشاشة (مناسبة للموبايل)
  if (useHourglass) showLoader();

  // مؤقت ٤ ثوانٍ كحدّ أدنى
  const minWait = new Promise(res => setTimeout(res, 4000));

  // تحميل CSV
  const loadCSV = new Promise((resolve) => {
    Papa.parse(
      `https://docs.google.com/spreadsheets/d/e/2PACX-1vSjJe2W1HVn2k7ivB1fYfpDBZ9x43pKPDyQ9cxGFnXMs1OjxjtH1Ht7WqkOaTuN1XlBNAhW8f178fu3/pub?gid=${gid}&single=true&output=csv`,
      {
        download: true,
        header: true,
        complete: function (results) {
          resolve(results.data || []);
        }
      }
    );
  });

  // انتظر الملف + ٤ ثوانٍ معًا
  Promise.all([minWait, loadCSV]).then(([, rows]) => {
    currentSentences = rows;
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

      // زر المفضلة
      const favBtn = document.createElement("button");
      favBtn.className = "fav-btn";
      if (fav) favBtn.classList.add("active");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(id, favBtn);
      });

      // زر العين (إظهار/إخفاء)
      const eyeBtn = document.createElement("button");
      eyeBtn.className = "eye-btn";
      eyeBtn.title = hidden ? "هذه الجملة مخفية" : "هذه الجملة مرئية";
      if (!hidden) eyeBtn.classList.add("active"); // عين غامقة = مرئية
      eyeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHidden(id, eyeBtn, card);
        eyeBtn.title = isHidden(id) ? "هذه الجملة مخفية" : "هذه الجملة مرئية";
      });

      // تجميع الأزرار بجانب العنوان
      const actionsWrap = document.createElement("div");
      actionsWrap.style.display = "flex";
      actionsWrap.style.alignItems = "center";
      actionsWrap.style.gap = "6px";
      actionsWrap.appendChild(favBtn);
      actionsWrap.appendChild(eyeBtn);

      arabic.style.justifyContent = "space-between";
      arabic.appendChild(actionsWrap);

      card.appendChild(arabic);

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

      // Toggle translations
      card.addEventListener("click", () => {
        const isVisible = transDiv.style.display === "flex";
        transDiv.style.display = isVisible ? "none" : "flex";
        if (!isVisible) localStorage.setItem("lastSentenceIndex", index);
      });

      container.appendChild(card);
    });

    hideLoader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }).catch(() => {
    hideLoader();
    const container = document.getElementById("sentenceList");
    if (container) container.innerHTML = "<div style='text-align:center; padding:20px;'>تعذّر التحميل، حاول مجددًا.</div>";
  });
}

// ===== Load categories =====
function loadCategories() {
  Papa.parse(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjJe2W1HVn2k7ivB1fYfpDBZ9x43pKPDyQ9cxGFnXMs1OjxjtH1Ht7WqkOaTuN1XlBNAhW8f178fu3/pub?gid=0&single=true&output=csv",
    {
      download: true,
      header: true,
      complete: function (results) {
        const container = document.getElementById("categoryContainer");
        container.innerHTML = "";
        const grouped = {};

        // group by main
        (results.data || []).forEach(row => {
          if (!row || !row.main) return;
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

// ===== Boot =====
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
