// Strict CSV reader + strict grouping by (date, group).
// 1) Parse CSV (supports quotes, commas, CRLF)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += ch; }
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
const clean = (s) => (s ?? "").replace(/^\uFEFF/,'').trim();

async function loadCSV() {
  const res = await fetch('assets/quotes.csv?ts=' + Date.now());
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
  const data = rows.slice(1).map((r, i) => ({
    _row: i,
    date: clean(r[idx.date] ?? ""),
    group: parseInt(clean(r[idx.group] ?? "1"), 10) || 1,
    author: clean(r[idx.author] ?? ""),
    text: clean(r[idx.text] ?? ""),
  })).filter(x => x.text);
  return data;
}

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

let groups = [];
let gi = 0;
let showAuthors = false;

function render(){
  const g = groups[gi];
  const ul = document.querySelector('#list');
  ul.innerHTML = "";
  const btnToggle = document.querySelector('#toggle');
  const lblDate = document.querySelector('#date');
  const lblGroup = document.querySelector('#group');
  const lblCount = document.querySelector('#count');

  if (!g){
    btnToggle.disabled = true;
    lblDate.textContent = ""; lblGroup.textContent = ""; lblCount.textContent = "";
    const li = document.createElement('li');
    li.className = 'group-item';
    li.textContent = "Keine Zitate gefunden.";
    ul.appendChild(li);
    return;
  }
  btnToggle.disabled = false;
  lblDate.textContent = g.date || "";
  lblGroup.textContent = "Gruppe " + (g.group || 1);
  lblCount.textContent = `${g.items.length} Zitat${g.items.length>1?'e':''}`;

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

  document.querySelector('#toggle').textContent = showAuthors ? "Autoren verstecken" : "Autoren anzeigen";
}

function nextG(){ if (!groups.length) return; gi = (gi+1)%groups.length; showAuthors=false; render(); }
function prevG(){ if (!groups.length) return; gi = (gi-1+groups.length)%groups.length; showAuthors=false; render(); }
function shuffleG(){ if (!groups.length) return; gi = Math.floor(Math.random()*groups.length); showAuthors=false; render(); }

document.addEventListener('DOMContentLoaded', async () => {
  const items = await loadCSV();
  groups = groupByDateGroup(items);
  render();

  document.querySelector('#toggle').onclick = ()=>{ showAuthors = !showAuthors; render(); };
  document.querySelector('#next').onclick = nextG;
  document.querySelector('#prev').onclick = prevG;
  document.querySelector('#shuffle').onclick = shuffleG;
  document.querySelector('#refresh').onclick = async ()=>{
    const items = await loadCSV();
    groups = groupByDateGroup(items);
    gi = 0; showAuthors=false; render();
  };

  if ('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('sw.js'); } catch(e){ console.warn(e); }
  }
});
