'use strict';

/* ============================================================
   Mon Délicieux — script.js
   ============================================================ */

// ── 定数 ─────────────────────────────────────────────────────
const STORAGE_KEY = 'mondelicieux_records';
const THEME_KEY   = 'mondelicieux_theme';

const THEME_COLORS = {
  wa:    { bg: '#1a1208', accent: '#c0392b', text: '#f5ede0', label: '和' },
  yo:    { bg: '#0d1a0f', accent: '#b8962e', text: '#e8f0e0', label: '洋' },
  chu:   { bg: '#1a0808', accent: '#e85d04', text: '#fdebd0', label: '中' },
  mono:  { bg: '#111111', accent: '#f5f5f5', text: '#ffffff', label: 'Mono' },
  night: { bg: '#060d1a', accent: '#4fc3f7', text: '#e0f0ff', label: 'Night' },
};

const GENRE_COLORS = [
  '#c8a882','#a0c4a0','#e8a87c','#8db8e8','#d4a0c8',
  '#e8d08c','#88c8c8','#d88888','#b8b8b8','#c0a0d8',
];

// ── 状態 ─────────────────────────────────────────────────────
let records        = [];
let editingId      = null;
let deleteTargetId = null;
let flyerTargetId  = null;
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth();
let genreChart     = null;

// ── 初期化 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  initDarkMode();
  initForm();
  initCalendar();
  initExportImport();
  initShare();
  initSW();
  renderAll();
});

// ── Service Worker ───────────────────────────────────────────
function initSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'NEW_VERSION') {
      showShareToast('アプリを更新しました ✓');
      setTimeout(() => location.reload(), 1800);
    }
  });
}

// ── ストレージ ───────────────────────────────────────────────
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── 全描画 ───────────────────────────────────────────────────
function renderAll() {
  renderRecordsList();
  renderCalendar();
  renderChart();
  renderAnalysis();
}

// ── 記録一覧 ─────────────────────────────────────────────────
function renderRecordsList() {
  const list  = document.getElementById('records-list');
  const empty = document.getElementById('records-empty');
  list.innerHTML = '';

  const sorted = [...records].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  );

  if (sorted.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  sorted.forEach(rec => list.appendChild(buildRecordCard(rec)));
}

function buildRecordCard(rec) {
  const el = document.createElement('div');
  el.className = 'record-card';

  const themeLabel = THEME_COLORS[rec.theme]?.label || rec.theme || '';
  const starsHtml  = buildStarsHtml(rec.rating || 0, 'var(--accent)', 'var(--border)');
  const badgeCls   = `record-theme-badge badge-${rec.theme || 'mono'}`;

  const imgHtml = rec.image
    ? `<img class="record-card-img" src="${rec.image}" alt="${escHtml(rec.shop || '')}" loading="lazy">`
    : `<div class="record-card-img-placeholder">🍽️</div>`;

  const dishHtml = rec.dish
    ? `<div class="record-dish">${escHtml(rec.dish)}</div>`
    : '';

  const memoHtml = rec.memo
    ? `<div class="record-memo">${escHtml(rec.memo)}</div>`
    : '';

  el.innerHTML = `
    ${imgHtml}
    <div class="record-card-body">
      <div class="record-shop">${escHtml(rec.shop || '')}</div>
      ${dishHtml}
      <div class="record-meta">
        <span class="record-date">${formatDate(rec.date)}</span>
        <span class="record-stars">${starsHtml}</span>
        <span class="${badgeCls}">${escHtml(themeLabel)}</span>
      </div>
      ${memoHtml}
      <div class="record-actions">
        <button class="btn-action" data-action="flyer"  data-id="${rec.id}">チラシ</button>
        <button class="btn-action" data-action="edit"   data-id="${rec.id}">編集</button>
        <button class="btn-action del" data-action="delete" data-id="${rec.id}">削除</button>
      </div>
    </div>`;

  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'edit')   openEditModal(id);
      if (action === 'delete') openDeleteModal(id);
      if (action === 'flyer')  openFlyerModal(id);
    });
  });

  return el;
}

function buildStarsHtml(rating, activeColor, inactiveColor) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? activeColor : inactiveColor}">★</span>`
  ).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── カレンダー ───────────────────────────────────────────────
function initCalendar() {
  document.getElementById('prev-month').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
    renderChart();
    renderAnalysis();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
    renderChart();
    renderAnalysis();
  });
}

function renderCalendar() {
  document.getElementById('calendar-title').textContent =
    `${calYear}年${calMonth + 1}月`;

  const grid    = document.getElementById('calendar-grid');
  const preview = document.getElementById('calendar-preview');
  grid.innerHTML = '';
  preview.classList.add('hidden');
  preview.innerHTML = '';

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();

  const dateMap = {};
  records.forEach(rec => {
    if (!rec.date) return;
    const d = new Date(rec.date + 'T00:00:00');
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      if (!dateMap[rec.date]) dateMap[rec.date] = [];
      dateMap[rec.date].push(rec);
    }
  });

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const recs    = dateMap[dateStr] || [];
    const isToday = (
      today.getFullYear() === calYear &&
      today.getMonth()    === calMonth &&
      today.getDate()     === d
    );

    const cell = document.createElement('div');
    cell.className = 'cal-day'
      + (recs.length > 0 ? ' has-record' : '')
      + (isToday ? ' today' : '');
    cell.innerHTML = `<span>${d}</span>`;

    if (recs.length > 0) {
      const color = THEME_COLORS[recs[0].theme]?.accent || '#c8a882';
      const dot   = document.createElement('div');
      dot.className    = 'cal-dot';
      dot.style.background = color;
      cell.appendChild(dot);
      cell.addEventListener('click', () => showCalPreview(recs, preview));
    }

    grid.appendChild(cell);
  }
}

function showCalPreview(recs, preview) {
  preview.classList.remove('hidden');
  preview.innerHTML = recs.map(r => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:0.78rem;font-weight:700">${escHtml(r.shop || '')}</span>
      <span style="font-size:0.7rem;color:var(--accent)">${buildStarsHtml(r.rating || 0, 'var(--accent)', 'var(--border)')}</span>
    </div>
    ${r.dish ? `<div style="font-size:0.68rem;opacity:.55;padding:1px 0">${escHtml(r.dish)}</div>` : ''}
  `).join('');
}

// ── Chart.js グラフ ──────────────────────────────────────────
function renderChart() {
  const canvas = document.getElementById('genre-chart');
  const noData = document.getElementById('chart-no-data');

  const monthRecs = records.filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date + 'T00:00:00');
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });

  if (genreChart) {
    genreChart.destroy();
    genreChart = null;
  }

  if (monthRecs.length === 0) {
    canvas.classList.add('hidden');
    noData.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  noData.classList.add('hidden');

  const genreCount = {};
  monthRecs.forEach(r => {
    const g = r.genre || 'その他';
    genreCount[g] = (genreCount[g] || 0) + 1;
  });

  const labels = Object.keys(genreCount);
  const data   = Object.values(genreCount);
  const colors = labels.map((_, i) => GENRE_COLORS[i % GENRE_COLORS.length]);
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--text').trim() || '#1a1c1f';

  genreChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font:     { family: "'Noto Serif JP', serif", size: 9 },
            color:    textColor,
            boxWidth: 9,
            padding:  6,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}件`
          }
        }
      }
    }
  });
}

// ── 分析 ─────────────────────────────────────────────────────
function renderAnalysis() {
  renderAvgScores();
  renderMissingGenres();
}

function renderAvgScores() {
  const el = document.getElementById('avg-scores');

  const shopMap = {};
  records.forEach(r => {
    if (!r.shop) return;
    if (!shopMap[r.shop]) shopMap[r.shop] = [];
    shopMap[r.shop].push(r.rating || 0);
  });

  const shops = Object.entries(shopMap)
    .map(([shop, ratings]) => ({
      shop,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 5);

  if (shops.length === 0) {
    el.innerHTML = '<div class="no-data-msg" style="font-size:0.7rem">記録がありません</div>';
    return;
  }

  el.innerHTML = shops.map(s => `
    <div class="avg-score-item">
      <span class="avg-score-name" title="${escHtml(s.shop)}">${escHtml(s.shop)}</span>
      <span class="avg-score-val">${s.avg.toFixed(1)}<span style="font-size:0.6rem;margin-left:2px">★</span></span>
    </div>
  `).join('');
}

function renderMissingGenres() {
  const el = document.getElementById('missing-genres');

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const recentGenres = new Set(
    records
      .filter(r => r.date && new Date(r.date + 'T00:00:00') >= twoMonthsAgo)
      .map(r => r.genre || 'その他')
  );

  const usedGenres = new Set(records.map(r => r.genre || 'その他'));
  const missing    = [...usedGenres].filter(g => !recentGenres.has(g));

  if (missing.length === 0) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div class="missing-label">久しぶり？</div>
    <div class="missing-tags">
      ${missing.map(g => `<span class="missing-tag">${escHtml(g)}</span>`).join('')}
    </div>
  `;
}

// ── シェア ───────────────────────────────────────────────────
function initShare() {
  const SHARE_URL  = 'https://jiz41.github.io/mon-delicieux/';
  const SHARE_TEXT = 'Mon Délicieux — ごちそうさまの記録🍽️';

  document.getElementById('btn-share-x').href =
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`;

  document.getElementById('btn-share-line').href =
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SHARE_URL)}`;

  document.getElementById('btn-share-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(SHARE_URL).then(() => showShareToast('URLをコピーしました'));
  });
}

function showShareToast(msg) {
  const toast = document.getElementById('share-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── ダークモード ─────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
  document.getElementById('dark-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  document.getElementById('toggle-icon').textContent = mode === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, mode);
  if (genreChart) {
    setTimeout(renderChart, 0);
  }
}

// ── フォーム・モーダル ───────────────────────────────────────
function initForm() {
  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-cancel').addEventListener('click', closeRecordModal);
  document.getElementById('btn-modal-close').addEventListener('click', closeRecordModal);
  document.getElementById('modal-overlay').addEventListener('click', closeRecordModal);
  document.getElementById('record-form').addEventListener('submit', handleFormSubmit);

  // 星評価
  document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('click', () => setRating(parseInt(star.dataset.val, 10)));
    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') setRating(parseInt(star.dataset.val, 10));
    });
  });

  // テーマ選択（ラベルクリックで .selected クラス付与）
  document.querySelectorAll('.theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.theme-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // 画像プレビュー
  document.getElementById('f-image').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, dataUrl => {
      document.getElementById('image-preview').innerHTML =
        `<img src="${dataUrl}" alt="preview">`;
    });
  });

  // チラシモーダル
  document.getElementById('btn-flyer-close').addEventListener('click',  closeFlyerModal);
  document.getElementById('btn-flyer-close2').addEventListener('click', closeFlyerModal);
  document.getElementById('flyer-overlay').addEventListener('click',    closeFlyerModal);
  document.getElementById('btn-flyer-dl').addEventListener('click',     downloadFlyer);

  // 削除モーダル
  document.getElementById('btn-delete-cancel').addEventListener('click',  closeDeleteModal);
  document.getElementById('delete-overlay').addEventListener('click',     closeDeleteModal);
  document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);
}

function setRating(val) {
  document.getElementById('f-rating').value = val;
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val, 10) <= val);
  });
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 900;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = '記録を追加';
  document.getElementById('record-form').reset();
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  setRating(3);
  selectThemeOpt('wa');
  document.getElementById('record-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-shop').focus(), 100);
}

function openEditModal(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  editingId = id;

  document.getElementById('modal-title').textContent = '記録を編集';
  document.getElementById('f-shop').value   = rec.shop   || '';
  document.getElementById('f-dish').value   = rec.dish   || '';
  document.getElementById('f-date').value   = rec.date   || '';
  document.getElementById('f-genre').value  = rec.genre  || 'その他';
  document.getElementById('f-memo').value   = rec.memo   || '';
  document.getElementById('f-mapurl').value = rec.mapurl || '';
  setRating(rec.rating || 3);
  selectThemeOpt(rec.theme || 'wa');

  const radio = document.querySelector(`input[name="rec-theme"][value="${rec.theme || 'wa'}"]`);
  if (radio) radio.checked = true;

  document.getElementById('image-preview').innerHTML =
    rec.image ? `<img src="${rec.image}" alt="preview">` : '';

  document.getElementById('record-modal').classList.remove('hidden');
}

function selectThemeOpt(themeVal) {
  document.querySelectorAll('.theme-opt').forEach(opt => {
    opt.classList.remove('selected');
  });
  const radio = document.querySelector(`input[name="rec-theme"][value="${themeVal}"]`);
  if (radio) {
    radio.checked = true;
    radio.closest('.theme-opt').classList.add('selected');
  }
}

function closeRecordModal() {
  document.getElementById('record-modal').classList.add('hidden');
  editingId = null;
}

function handleFormSubmit(e) {
  e.preventDefault();

  const shop = document.getElementById('f-shop').value.trim();
  const date = document.getElementById('f-date').value;
  if (!shop || !date) return;

  const themeRadio = document.querySelector('input[name="rec-theme"]:checked');
  const theme      = themeRadio ? themeRadio.value : 'wa';

  const previewImg = document.querySelector('#image-preview img');
  let image = previewImg ? previewImg.src : null;
  if (!image && editingId) {
    image = records.find(r => r.id === editingId)?.image || null;
  }

  const data = {
    shop,
    dish:   document.getElementById('f-dish').value.trim(),
    date,
    genre:  document.getElementById('f-genre').value,
    rating: parseInt(document.getElementById('f-rating').value, 10) || 3,
    memo:   document.getElementById('f-memo').value.trim(),
    mapurl: document.getElementById('f-mapurl').value.trim(),
    theme,
    image,
  };

  if (editingId) {
    const idx = records.findIndex(r => r.id === editingId);
    if (idx !== -1) records[idx] = { ...records[idx], ...data };
  } else {
    records.push({ id: generateId(), createdAt: Date.now(), ...data });
  }

  saveRecords();
  closeRecordModal();
  renderAll();
}

// ── 削除 ─────────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteTargetId = null;
}

function confirmDelete() {
  if (!deleteTargetId) return;
  records = records.filter(r => r.id !== deleteTargetId);
  saveRecords();
  closeDeleteModal();
  renderAll();
}

// ── チラシ出力 ───────────────────────────────────────────────
function openFlyerModal(id) {
  flyerTargetId = id;
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  const t = THEME_COLORS[rec.theme] || THEME_COLORS.mono;
  const starsHtml = Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < (rec.rating || 0) ? t.accent : 'rgba(255,255,255,0.18)'}">★</span>`
  ).join('');

  const renderEl = document.getElementById('flyer-render');
  renderEl.innerHTML = `
    <div style="
      width:540px;height:960px;
      background:${t.bg};
      color:${t.text};
      font-family:'Noto Serif JP',serif;
      display:flex;flex-direction:column;
      padding:56px 44px 44px;
      box-sizing:border-box;
      position:relative;
      overflow:hidden;
    ">
      <div style="position:absolute;top:-100px;right:-100px;width:340px;height:340px;border-radius:50%;background:${t.accent};opacity:0.07;pointer-events:none"></div>
      <div style="position:absolute;bottom:-60px;left:-60px;width:240px;height:240px;border-radius:50%;background:${t.accent};opacity:0.09;pointer-events:none"></div>

      <div style="font-family:'Playfair Display',serif;font-size:17px;color:${t.accent};letter-spacing:0.14em;margin-bottom:40px;font-style:italic;opacity:0.9">
        Mon Délicieux
      </div>

      ${rec.image ? `
        <div style="width:100%;height:290px;border-radius:14px;overflow:hidden;margin-bottom:32px;flex-shrink:0">
          <img src="${rec.image}" style="width:100%;height:100%;object-fit:cover" crossorigin="anonymous" alt="">
        </div>
      ` : `
        <div style="width:100%;height:140px;border-radius:14px;background:${t.accent}1a;display:flex;align-items:center;justify-content:center;font-size:56px;margin-bottom:32px;flex-shrink:0">🍽️</div>
      `}

      <div style="flex:1;display:flex;flex-direction:column">
        <div style="font-family:'Playfair Display',serif;font-size:30px;font-weight:700;line-height:1.3;margin-bottom:6px;letter-spacing:0.02em">
          ${escHtml(rec.shop || '')}
        </div>
        ${rec.dish ? `
          <div style="font-size:15px;opacity:0.65;margin-bottom:14px;letter-spacing:0.04em">
            ${escHtml(rec.dish)}
          </div>
        ` : ''}

        <div style="font-size:22px;margin-bottom:14px;letter-spacing:3px">${starsHtml}</div>

        <div style="width:44px;height:2px;background:${t.accent};margin-bottom:18px;border-radius:1px"></div>

        ${rec.memo ? `
          <div style="font-size:13px;line-height:1.85;opacity:0.72;margin-bottom:18px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical">
            ${escHtml(rec.memo)}
          </div>
        ` : ''}

        <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:'Cormorant Garamond',serif;font-size:16px;opacity:0.48;letter-spacing:0.1em">
            ${formatDate(rec.date)}
          </div>
          <div style="font-size:11px;padding:4px 12px;border:1px solid ${t.accent}55;border-radius:20px;color:${t.accent};letter-spacing:0.1em">
            ${escHtml(rec.genre || '')}
          </div>
        </div>

        ${rec.mapurl ? `
          <div style="margin-top:14px;font-size:10px;opacity:0.38;letter-spacing:0.04em;word-break:break-all">
            📍 ${escHtml(rec.mapurl)}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  const container = document.getElementById('flyer-preview-container');
  container.innerHTML = '<div class="flyer-loading">生成中…</div>';
  document.getElementById('btn-flyer-dl').dataset.canvasData = '';
  document.getElementById('flyer-modal').classList.remove('hidden');

  html2canvas(renderEl.firstElementChild, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: t.bg,
    width:  540,
    height: 960,
    logging: false,
  }).then(canvas => {
    const dataUrl = canvas.toDataURL('image/png');
    container.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    container.appendChild(img);
    document.getElementById('btn-flyer-dl').dataset.canvasData = dataUrl;
  }).catch(() => {
    container.innerHTML = '<div class="flyer-loading" style="color:#c0392b">生成に失敗しました</div>';
  });
}

function closeFlyerModal() {
  document.getElementById('flyer-modal').classList.add('hidden');
  document.getElementById('flyer-preview-container').innerHTML = '<div class="flyer-loading">生成中…</div>';
  document.getElementById('flyer-render').innerHTML = '';
  flyerTargetId = null;
}

function downloadFlyer() {
  const dataUrl = document.getElementById('btn-flyer-dl').dataset.canvasData;
  if (!dataUrl) return;
  const rec  = flyerTargetId ? records.find(r => r.id === flyerTargetId) : null;
  const name = rec ? `${rec.shop || 'mondelicieux'}_${rec.date || Date.now()}` : `mondelicieux_${Date.now()}`;
  const a    = document.createElement('a');
  a.href     = dataUrl;
  a.download = `${name.replace(/[^\w\-\.]/g, '_')}.png`;
  a.click();
}

// ── エクスポート / インポート ─────────────────────────────────
function initExportImport() {
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importJSON);
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mondelicieux_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('invalid');
      const existingIds = new Set(records.map(r => r.id));
      const newRecs = imported.filter(r => r.id && !existingIds.has(r.id));
      records = [...records, ...newRecs];
      saveRecords();
      renderAll();
      alert(`${newRecs.length} 件の記録をインポートしました。`);
    } catch {
      alert('インポートに失敗しました。ファイル形式を確認してください。');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
