// --- CSV parser (unterstützt "..." und Kommas) ---
function parseCSV(text) {
  const rows = []; let row = []; let field = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
        if (ch === '\r' && text[i+1] === '\n') i++;
      } else { field += ch; }
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const clean = (s) => (s ?? "").replace(/^\uFEFF/, '').trim();

// --- CSV laden ---
async function loadCSV(cacheBust=false) {
  const url = 'assets/quotes.csv' + (cacheBust ? ('?v=' + Date.now()) : '');
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCSV(text).filter(r => r.length && r.some(c => clean(c) !== ""));
  if (!rows.length) return [];
  const header = rows[0].map(h => clean(h).toLowerCase());
  const idx = {
    date: header.indexOf('date'),
    group: header.indexOf('group'),
    author: header.indexOf('author'),
    text: header.indexOf('text'),
  };
  return rows.slice(1).map((r, i) => ({
    _row: i,
    date: clean(r[idx.date] ?? ""),
    group: parseInt(clean(r[idx.group] ?? "1"), 10) || 1,
    author: clean(r[idx.author] ?? ""),
    text: clean(r[idx.text] ?? ""),
  })).filter(x => x.text);
}

// --- Gruppieren nach (date, group) ---
function groupByDateGroup(items){
  const map = new Map();
  for (const it of items){
    const key = (it.date || "") + "||" + String(it.group || 1);
    if (!map.has(key)) map.set(key, { date: it.date, group: it.group, items: [] });
    map.get(key).items.push(it);
  }
  const groups = Array.from(map.values())
    .sort((a,b)=> (a.date||"").localeCompare(b.date||"") || (a.group - b.group));
  groups.forEach(g => g.items.sort((a,b)=> a._row - b._row));
  return groups;
}

// --- State & Render ---
let groups = [];
let gi = 0;
let showAuthors = false;

function $(sel){ return document.querySelector(sel); }

function render(){
  const g = groups[gi];
  const ul = $('#list');
  if (!ul) return;
  ul.innerHTML = "";

  const dateEl = $('#date');
  const toggleBtn = $('#toggle');

  if (!g){
    if (dateEl) dateEl.textContent = "";
    if (toggleBtn) { toggleBtn.disabled = true; toggleBtn.textContent = "Autoren anzeigen"; }
    const li = document.createElement('li');
    li.className = 'group-item';
    li.textContent = "Keine Zitate gefunden.";
    ul.appendChild(li);
    return;
  }

  if (dateEl) dateEl.textContent = g.date || "";
  if (toggleBtn) { toggleBtn.disabled = false; toggleBtn.textContent = showAuthors ? "Autoren verstecken" : "Autoren anzeigen"; }

  for (const q of g.items){
    const li = document.createElement('li');
    li.className = 'group-item';

    const pText = document.createElement('p');
    pText.className = 'quote-text';
    pText.textContent = q.text;
    li.appendChild(pText);

    const pAuthor = document.createElement('p');
    pAuthor.className = 'quote-author';
    pAuthor.textContent = showAuthors ? q.author : "";
    li.appendChild(pAuthor);

    ul.appendChild(li);
  }
}

function nextGroup(){ if (!groups.length) return; gi = (gi+1) % groups.length; showAuthors = false; render(); }
function prevGroup(){ if (!groups.length) return; gi = (gi-1+groups.length) % groups.length; showAuthors = false; render(); }

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const items = await loadCSV(false);
    groups = groupByDateGroup(items);
  } catch (e) {
    console.error(e);
  }
  render();

  const toggleBtn = $('#toggle');
  if (toggleBtn) toggleBtn.onclick = () => { showAuthors = !showAuthors; render(); };

  const prevBtn = $('#prev');
  if (prevBtn) prevBtn.onclick = prevGroup;

  const nextBtn = $('#shuffle'); // deine HTML nutzt 'shuffle' für 'Weiter'
  if (nextBtn) nextBtn.onclick = nextGroup;

  // Service Worker (kannst du in der Entwicklung auch auskommentieren)
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch(e){}
  }
});
