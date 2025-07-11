// Global state flags
let showOnlyFavorites = false; // Zeigt nur Favoriten, wenn aktiviert
let currentSentences = [];     // Enthält aktuell geladene Sätze
let currentCategory = null;    // Aktuell ausgewählte Kategorie

// Öffnet oder schließt die Sidebar beim Klick auf das Menü
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const topbar = document.querySelector(".topbar");

  const isOpen = sidebar.classList.toggle("hidden");
  document.body.classList.toggle("sidebar-open", !isOpen);

  // Wenn Sidebar sichtbar wird, scrolle sie in den sichtbaren Bereich
  if (!sidebar.classList.contains("hidden")) {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Schließt Sidebar, wenn außerhalb geklickt wird
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  const btn = document.querySelector(".menu-btn");
  if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
    sidebar.classList.add("hidden");
	document.body.classList.remove("sidebar-open");
  }
});

// Wechselt zwischen hell/dunkel Modus
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  document.querySelector(".topbar h2").style.opacity = document.body.classList.contains("dark") ? "0.9" : "1";
}

// Zeigt Hilfe-Overlay
function showHelp() {
  document.getElementById("helpBox").style.display = "block";
}

// Versteckt Hilfe-Overlay
function hideHelp() {
  document.getElementById("helpBox").style.display = "none";
}

// Schaltet zwischen allen Sätzen und Favoriten um
function toggleFavoritesView(btn) {
  showOnlyFavorites = !showOnlyFavorites;
  btn.classList.toggle("active", showOnlyFavorites);
  if (currentCategory) {
    loadSentences(currentCategory.name, currentCategory.gid);
  }
  btn.innerText = showOnlyFavorites ? "★" : "☆";
}

// Liest den gegebenen Text auf Deutsch vor
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  speechSynthesis.speak(utterance);
}

// Fügt/entfernt Satz zu/von Favoriten
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

// Prüft, ob Satz Favorit ist
function isFavorite(id) {
  const favs = JSON.parse(localStorage.getItem("favs") || "[]");
  return favs.includes(id);
}

// Lädt Sätze aus einer bestimmten Kategorie (ggf. öffnet letzten Satz)
function loadSentences(name, gid, lastIndex = null, fromStorage = false) {
  currentCategory = { name, gid };
  if (!fromStorage) localStorage.setItem("lastSentenceIndex", "");
  localStorage.setItem("lastCategory", JSON.stringify({ name, gid }));
  document.getElementById("mainTitle").innerText = name;

  Papa.parse(`https://docs.google.com/spreadsheets/d/e/2PACX-1vSjJe2W1HVn2k7ivB1fYfpDBZ9x43pKPDyQ9cxGFnXMs1OjxjtH1Ht7WqkOaTuN1XlBNAhW8f178fu3/pub?gid=${gid}&single=true&output=csv`, {
    download: true,
    header: true,
    complete: function(results) {
      const container = document.getElementById("sentenceList");
      container.innerHTML = "<div class='loading' style='font-size:1.4em;text-align:center;'>⏳</div>";

      currentSentences = results.data;
	  container.innerHTML = "";
      const favs = JSON.parse(localStorage.getItem("favs") || "[]");

      // Erzeuge jeden Satz-Eintrag
      currentSentences.forEach((row, index) => {
        const id = `${gid}_${index}`;
        const isFav = favs.includes(id);
        if (showOnlyFavorites && !isFav) return;

        const div = document.createElement("div");
        div.className = "sentence";

        const arabic = document.createElement("div");
        arabic.className = "arabic";
        arabic.innerText = row.Arabisch || "";

        const favBtn = document.createElement("button");
        favBtn.className = "fav-btn";
        if (isFav) favBtn.classList.add("active");
        favBtn.onclick = (e) => {
          e.stopPropagation();
          toggleFavorite(id, favBtn);
        };

        arabic.appendChild(favBtn);
        div.appendChild(arabic);

        const transDiv = document.createElement("div");
        transDiv.className = "translation";
        if (index === lastIndex) {
          transDiv.style.display = "flex";
        }

        const hoch = document.createElement("div");
        hoch.className = "translation-line";
        hoch.innerHTML = `<span class='hochdeutsch'>${row.Hochdeutsch || ""}</span><button class='speak-btn' onclick='event.stopPropagation(); speak(\`${row.Hochdeutsch || ""}\`)'>🗣️</button>`;

        const umgang = document.createElement("div");
        umgang.className = "translation-line";
        umgang.innerHTML = `<span class='umgangssprache'>${row.Umgangssprache || ""}</span><button class='speak-btn' onclick='event.stopPropagation(); speak(\`${row.Umgangssprache || ""}\`)'>🗣️</button>`;

        transDiv.appendChild(hoch);
        transDiv.appendChild(umgang);
        div.appendChild(transDiv);

        div.onclick = () => {
          const isVisible = transDiv.style.display === "flex";
          transDiv.style.display = isVisible ? "none" : "flex";
          if (!isVisible) {
            localStorage.setItem("lastSentenceIndex", index);
          }
        };

        container.appendChild(div);
      });
    }
  });
}

// Lädt die verfügbaren Kategorien und erstellt Sidebar
function loadCategories() {
  Papa.parse("https://docs.google.com/spreadsheets/d/e/2PACX-1vSjJe2W1HVn2k7ivB1fYfpDBZ9x43pKPDyQ9cxGFnXMs1OjxjtH1Ht7WqkOaTuN1XlBNAhW8f178fu3/pub?gid=0&single=true&output=csv", {
    download: true,
    header: true,
    complete: function(results) {
      const container = document.getElementById("categoryContainer");
      container.innerHTML = "";
      const grouped = {};

      // Gruppiere Kategorien nach Hauptgruppe
      results.data.forEach(row => {
        if (!grouped[row.main]) grouped[row.main] = [];
        grouped[row.main].push(row);
      });

      // Erzeuge UI für jede Haupt- und Unterkategorie
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
            loadSentences(cat.name, cat.gid);
			
            window.scrollTo({ top: 0, behavior: 'smooth' });
          };
          subList.appendChild(item);
        });

        container.appendChild(title);
        container.appendChild(subList);
      });
    }
  });
}

// Beim Laden der Seite: Letzte Kategorie + Satz laden, falls vorhanden
window.onload = function() {
  const lastCat = JSON.parse(localStorage.getItem("lastCategory") || "null");
  const lastIndex = parseInt(localStorage.getItem("lastSentenceIndex"));
  if (lastCat) {
    loadCategories();
    loadSentences(lastCat.name, lastCat.gid, lastIndex, true);
  } else {
    loadCategories();
  }
};
