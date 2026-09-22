const TAX_RATE = 15.4;
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const COLOR_UP = '#3b82f6';
const COLOR_DOWN = '#ef4444';
let chartInstance = null;
let windowSimData = [];
let viewFrom = 1;
let viewTo = 40;
let fitY = true;
const ANCHORS = [1,10,20,30,40];
let currentView = 'growth';
let cashChart = null;
let cashflow = {
  income: {1:300, 10:400, 20:500, 30:500, 40:250},
  spends: [
    { id:'rent', name:'주거', amounts:{1:80,10:90,20:100,30:100,40:70} },
    { id:'food', name:'식비', amounts:{1:50,10:60,20:70,30:70,40:50} },
    { id:'ins', name:'보험/기타', amounts:{1:20,10:25,20:30,30:30,40:25} }
  ]
};
function interpMap(map, y) {
  const pts = ANCHORS.map(a => [a, Number(map[a]) || 0]);
  if (y <= pts[0][0]) return pts[0][1];
  if (y >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for (let i=0;i<pts.length-1;i++) {
    const [x0,v0] = pts[i], [x1,v1] = pts[i+1];
    if (y >= x0 && y <= x1) return v0 + (v1 - v0) * ((y - x0) / (x1 - x0));
  }
  return pts[pts.length-1][1];
}
function spendAt(y) { return cashflow.spends.reduce((s, it) => s + interpMap(it.amounts, y), 0); }
function leftoverAt(y) { return interpMap(cashflow.income, y) - spendAt(y); }
function switchView(view) {
  currentView = view;
  const g = document.getElementById('tabGrowth');
  const c = document.getElementById('tabCash');
  if (g) g.classList.toggle('active', view === 'growth');
  if (c) c.classList.toggle('active', view === 'cash');
  const showG = view === 'growth';
  ['growthBlock','tableBlock'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = showG ? '' : 'none'; });
  const cash = document.getElementById('cashView');
  if (cash) cash.style.display = showG ? 'none' : 'flex';
  if (!showG) renderCashflow();
  else setTimeout(() => { if (chartInstance) chartInstance.resize(); }, 40);
}
function updateIncome(year, val) {
  cashflow.income[year] = parseFloat(val) || 0;
  renderCashflow();
  if (portfolios.some(p => p.useCashflow) && chartInstance) renderTableAndChart();
}
function updateSpend(id, year, val) {
  const it = cashflow.spends.find(x => x.id === id);
  if (!it) return;
  it.amounts[year] = parseFloat(val) || 0;
  renderCashflow();
  if (portfolios.some(p => p.useCashflow) && chartInstance) renderTableAndChart();
}
function updateSpendName(id, val) {
  const it = cashflow.spends.find(x => x.id === id);
  if (it) it.name = val;
}
function removeSpend(id) {
  cashflow.spends = cashflow.spends.filter(x => x.id !== id);
  renderCashflow();
  if (portfolios.some(p => p.useCashflow) && chartInstance) renderTableAndChart();
}
function addSpend() {
  cashflow.spends.push({ id:'s'+Date.now(), name:'새 소비', amounts:{1:10,10:10,20:10,30:10,40:10} });
  renderCashflow();
}
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&','<':'<','>':'>','"':'"','\'':'&#39;'}[m])); }
function renderCashflow() {
  const inc = document.getElementById('incomeRow');
  const list = document.getElementById('spendList');
  const strip = document.getElementById('leftoverStrip');
  if (!inc || !list || !strip) return;
  inc.innerHTML = ANCHORS.map(y => `<div class="input-group"><label>${y}년차</label><div class="input-wrapper"><input type="number" value="${cashflow.income[y]}" step="10" onchange="updateIncome(${y}, this.value)"><span class="unit">만</span></div></div>`).join('');
  list.innerHTML = `<div class="spend-row" style="font-size:0.72rem;color:#6b7280;font-weight:700;"><span>항목</span>${ANCHORS.map(y=>`<span>${y}년</span>`).join('')}<span></span></div>`;
  cashflow.spends.forEach(it => {
    list.innerHTML += `<div class="spend-row"><input class="name" value="${esc(it.name)}" onchange="updateSpendName('${it.id}', this.value)">${ANCHORS.map(y => `<input type="number" value="${it.amounts[y]||0}" step="5" onchange="updateSpend('${it.id}', ${y}, this.value)">`).join('')}<button type="button" onclick="removeSpend('${it.id}')" style="border:none;background:transparent;cursor:pointer;color:#ef4444;font-weight:800;">×</button></div>`;
  });
  strip.innerHTML = ANCHORS.map(y => {
    const lo = leftoverAt(y);
    return `<div class="lo-box ${lo<0?'neg':''}"><span>${y}년 잔여</span><b>${Number(lo).toFixed(0)}만</b></div>`;
  }).join('');
  const labels = ANCHORS.map(y => y+'년');
  const incomeData = ANCHORS.map(y => cashflow.income[y]);
  const spendData = ANCHORS.map(y => spendAt(y));
  const leftData = ANCHORS.map(y => Math.max(0, leftoverAt(y)));
  const canvas = document.getElementById('cashChart');
  if (!canvas) return;
  if (!cashChart) {
    cashChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [
        { label:'소비', data: spendData, backgroundColor:'#fca5a5', stack:'cf' },
        { label:'잔여(투자)', data: leftData, backgroundColor:'#6ee7b7', stack:'cf' },
        { label:'수입', data: incomeData, type:'line', borderColor:'#111827', pointRadius:4, tension:0 }
      ]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } },
        scales:{ y:{ stacked:true, ticks:{ callback:v=>v+'만' } }, x:{ stacked:true } } }
    });
  } else {
    cashChart.data.datasets[0].data = spendData;
    cashChart.data.datasets[1].data = leftData;
    cashChart.data.datasets[2].data = incomeData;
    cashChart.update();
  }
}
function toggleLifePanel(id) {
  const p = portfolios.find(x => x.id === id);
  p.lifeOpen = !p.lifeOpen;
  renderSidebar();
}
function defaultLifestyle() {
  return [
    { id: 'trip', name: '해외여행', amount: 500, start: 1, every: 1, on: false },
    { id: 'gift', name: '비싼 선물', amount: 200, start: 1, every: 1, on: false },
    { id: 'car', name: '차 교체', amount: 3000, start: 5, every: 5, on: false }
  ];
}
function yearSpend(p, y) {
  return (p.lifestyle || []).reduce((sum, item) => {
    if (!item.on) return sum;
    if (y < item.start) return sum;
    if (((y - item.start) % Math.max(1, item.every)) !== 0) return sum;
    return sum + (Number(item.amount) || 0);
  }, 0);
}
function portHasLife(p) { return (p.lifestyle || []).some(x => x.on); }
function toggleLife(portId, id) {
  const p = portfolios.find(x => x.id === portId);
  const item = p && p.lifestyle.find(x => x.id === id);
  if (item) item.on = !item.on;
  renderAll();
}
function updateLife(portId, id, key, val, ev) {
  if (ev) ev.stopPropagation();
  const p = portfolios.find(x => x.id === portId);
  const item = p && p.lifestyle.find(x => x.id === id);
  if (!item) return;
  if (key === 'name') item.name = val;
  else item[key] = parseFloat(val) || 0;
  renderAll();
}
function addLife(portId, ev) {
  if (ev) ev.stopPropagation();
  const p = portfolios.find(x => x.id === portId);
  p.lifestyle.push({ id: 'life' + Date.now(), name: '새 지출', amount: 100, start: 1, every: 1, on: true });
  renderAll();
}
function clampYear(n) {
  n = parseInt(n, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(40, Math.max(1, n));
}
function setRange(to) {
  viewFrom = 1;
  viewTo = clampYear(to);
  document.querySelectorAll('.range-chip').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.to) === viewTo);
  });
  if (chartInstance) renderTableAndChart();
}
let portfolios = [
  { id: 'A', name: '그냥저냥 LIFE', initialAsset: 0, baseMonthly: 200, inc: 3, growth: 8, div: 1.5, reinvest: true, visible: true, syncWithA: false, color: PALETTE[0], overrides: {}, lifestyle: defaultLifestyle(), useCashflow: false },
  { id: 'B', name: '영차영차 FIRE', initialAsset: 0, baseMonthly: 200, inc: 3, growth: 7, div: 3, reinvest: true, visible: true, syncWithA: false, color: PALETTE[1], overrides: {}, lifestyle: defaultLifestyle(), useCashflow: false },
  { id: 'C', name: '흥청망청 YOLO', initialAsset: 0, baseMonthly: 200, inc: 3, growth: 5, div: 2, reinvest: false, visible: false, syncWithA: false, color: PALETTE[2], overrides: {}, lifestyle: defaultLifestyle(), useCashflow: false }
];
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const icon = document.getElementById('toggleIcon');
  sb.classList.toggle('collapsed');
  icon.innerText = sb.classList.contains('collapsed') ? '▶' : '◀';
  setTimeout(() => { if(chartInstance) chartInstance.resize(); }, 300);
}
function formatMoneyKor(value) {
  if (value === 0 || Math.abs(value) < 1) return '0원';
  const isNeg = value < 0;
  const absVal = Math.abs(value);
  const uk = Math.floor(absVal / 10000);
  const man = Math.floor(absVal % 10000);
  let result = '';
  if (uk > 0) result += uk + '억 ';
  if (man > 0) result += man.toLocaleString() + '만';
  return isNeg ? '-' + result.trim() : (result.trim() || '0원');
}
function formatNum(val) { return Number(val).toLocaleString(undefined, {maximumFractionDigits: 1}); }
function updatePort(id, key, val) {
  const p = portfolios.find(x => x.id === id);
  if (['visible', 'reinvest', 'syncWithA', 'useCashflow'].includes(key)) p[key] = val;
  else if (key === 'name') p[key] = val;
  else p[key] = parseFloat(val) || 0;
  if (id === 'A') {
    portfolios.forEach(port => {
      if (port.id !== 'A' && port.syncWithA && !['name', 'visible', 'overrides', 'lifestyle'].includes(key)) port[key] = p[key];
    });
  } else {
    if (!['visible', 'name', 'syncWithA'].includes(key)) p.syncWithA = false;
    if (key === 'syncWithA' && val === true) {
      const baseA = portfolios.find(x => x.id === 'A');
      ['initialAsset', 'baseMonthly', 'inc', 'growth', 'div', 'reinvest'].forEach(k => p[k] = baseA[k]);
    }
  }
  renderAll();
}
function setOverride(portId, year, key, valStr) {
  const p = portfolios.find(x => x.id === portId);
  if (valStr.trim() === '') {
    if (p.overrides[year]) {
      delete p.overrides[year][key];
      if (Object.keys(p.overrides[year]).length === 0) delete p.overrides[year];
    }
  } else {
    if (!p.overrides[year]) p.overrides[year] = {};
    p.overrides[year][key] = parseFloat(valStr) || 0;
  }
  p.syncWithA = false;
  renderAll();
}
function clearOverrides(portId) {
  if (confirm('이 포트폴리오의 타임라인 수정 내역을 모두 초기화하시겠습니까?')) {
    portfolios.find(x => x.id === portId).overrides = {};
    renderAll();
  }
}
function addPortfolio() {
  const newId = String.fromCharCode(65 + portfolios.length);
  portfolios.push({ id: newId, name: '신규 전략 (' + newId + ')', initialAsset: 0, baseMonthly: 100, inc: 3, growth: 6, div: 2, reinvest: true, visible: true, syncWithA: false, color: PALETTE[portfolios.length % PALETTE.length], overrides: {}, lifestyle: defaultLifestyle(), useCashflow: false });
  renderAll();
}
function calculateData(p, applyLife) {
  let currentAsset = p.initialAsset;
  let runningMonthly = p.baseMonthly;
  let runningInc = p.inc;
  let runningGrowth = p.growth;
  let runningDiv = p.div;
  const data = [];
  for (let y = 1; y <= 40; y++) {
    let overM = false, overI = false, overG = false, overD = false;
    if (p.overrides[y]) {
      if (p.overrides[y].inc !== undefined) { runningInc = p.overrides[y].inc; overI = true; }
      if (p.overrides[y].monthly !== undefined) { runningMonthly = p.overrides[y].monthly; overM = true; }
      if (p.overrides[y].growth !== undefined) { runningGrowth = p.overrides[y].growth; overG = true; }
      if (p.overrides[y].div !== undefined) { runningDiv = p.overrides[y].div; overD = true; }
    }
    if (p.useCashflow && !overM) runningMonthly = Math.max(0, leftoverAt(y));
    else if (y > 1 && !overM) runningMonthly = runningMonthly * (1 + (runningInc / 100));
    const spendYear = applyLife ? yearSpend(p, y) : 0;
    const actualMonthly = Math.max(0, runningMonthly - spendYear / 12);
    let monthlyGrowthDec = Math.pow(1 + (runningGrowth / 100), 1/12) - 1;
    for (let m = 0; m < 12; m++) currentAsset = currentAsset * (1 + monthlyGrowthDec) + actualMonthly;
    let netDiv = (currentAsset * (runningDiv / 100)) * (1 - TAX_RATE / 100);
    if (p.reinvest) currentAsset += netDiv;
    data.push({ year: y, monthly: actualMonthly, planned: runningMonthly, spend: spendYear, overM: overM || spendYear > 0, inc: runningInc, overI, growth: runningGrowth, overG, div: runningDiv, overD, dividend: netDiv, asset: currentAsset });
  }
  return data;
}
function h(tag, attrs, html) {
  const el = document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  });
  if (html != null) el.innerHTML = html;
  return el;
}
function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  portfolios.forEach(p => {
    const hasOverrides = Object.keys(p.overrides).length > 0;
    const card = document.createElement('div');
    card.className = 'portfolio-card ' + (p.visible ? '' : 'hidden-card');
    card.style.borderColor = p.color;
    card.style.setProperty('--color', p.color);
    const monthlyVal = p.useCashflow ? Math.round(leftoverAt(1)*10)/10 : p.baseMonthly;
    const sync = p.id!=='A' ? `<label class="sync-toggle ${p.syncWithA?'active':''}"><input type="checkbox" ${p.syncWithA?'checked':''} onchange="updatePort('${p.id}', 'syncWithA', this.checked)">A와 상동</label>` : '';
    card.innerHTML = `
      <div class="card-header"><input type="text" class="name-input" value="${esc(p.name)}" onchange="updatePort('${p.id}', 'name', this.value)"><div class="toggle-group">${sync}<label class="vis-toggle"><input type="checkbox" ${p.visible?'checked':''} onchange="updatePort('${p.id}', 'visible', this.checked)">표시</label></div></div>
      <div class="input-grid">
        <div class="input-group"><label>초기 자산</label><div class="input-wrapper"><input type="number" value="${p.initialAsset}" step="100" onchange="updatePort('${p.id}', 'initialAsset', this.value)"><span class="unit">만</span></div></div>
        <div class="input-group"><label>시작 납입금</label><div class="input-wrapper"><input type="number" value="${monthlyVal}" step="10" ${p.useCashflow?'disabled class="linked"':''} onchange="updatePort('${p.id}', 'baseMonthly', this.value)"><span class="unit">만</span></div></div>
        <div class="input-group"><label>납입금 연 증가율</label><div class="input-wrapper"><input type="number" value="${p.inc}" step="1" onchange="updatePort('${p.id}', 'inc', this.value)"><span class="unit">%</span></div></div>
        <div class="input-group"><label>시작 연 성장률</label><div class="input-wrapper"><input type="number" value="${p.growth}" step="0.5" onchange="updatePort('${p.id}', 'growth', this.value)"><span class="unit">%</span></div></div>
        <div class="input-group"><label>시작 연 배당률</label><div class="input-wrapper"><input type="number" value="${p.div}" step="0.5" onchange="updatePort('${p.id}', 'div', this.value)"><span class="unit">%</span></div></div>
      </div>
      <div class="reinvest-row"><span>배당금 재투자 적용</span><label class="toggle-switch"><input type="checkbox" ${p.reinvest?'checked':''} onchange="updatePort('${p.id}', 'reinvest', this.checked)"><span class="slider"></span></label></div>
      <div class="reinvest-row"><span>현금흐름 잔여 → 납입</span><label class="toggle-switch"><input type="checkbox" ${p.useCashflow?'checked':''} onchange="updatePort('${p.id}', 'useCashflow', this.checked)"><span class="slider"></span></label></div>
      ${hasOverrides?`<button class="reset-overrides-btn" onclick="clearOverrides('${p.id}')">테이블 수정 내역 초기화</button>`:''}
    `;
    if (!p.lifestyle) p.lifestyle = defaultLifestyle();
    const lifeOn = portHasLife(p);
    let acc = `<div class="life-acc"><button type="button" class="life-acc-btn${p.lifeOpen?' on':''}" onclick="toggleLifePanel('${p.id}')"><span>삶의 선택${lifeOn?(' · '+p.id+'-1 ON'):''}</span><span>${p.lifeOpen?'▲':'▼'}</span></button>`;
    if (p.lifeOpen) {
      acc += '<div class="life-acc-body">';
      p.lifestyle.forEach(item => {
        acc += `<div class="life-card${item.on?' on':''}" onclick="toggleLife('${p.id}','${item.id}')">
          <div class="life-card-top"><input class="life-name" value="${esc(item.name)}" onclick="event.stopPropagation()" onchange="updateLife('${p.id}','${item.id}','name',this.value,event)"><span class="life-dot"></span></div>
          <div class="life-grid">
            <div class="input-group"><label>연 지출</label><div class="input-wrapper"><input type="number" value="${item.amount}" step="50" onclick="event.stopPropagation()" onchange="updateLife('${p.id}','${item.id}','amount',this.value,event)"><span class="unit">만</span></div></div>
            <div class="input-group"><label>시작</label><div class="input-wrapper"><input type="number" value="${item.start}" min="1" max="40" onclick="event.stopPropagation()" onchange="updateLife('${p.id}','${item.id}','start',this.value,event)"><span class="unit">년</span></div></div>
            <div class="input-group"><label>반복</label><div class="input-wrapper"><input type="number" value="${item.every}" min="1" max="40" onclick="event.stopPropagation()" onchange="updateLife('${p.id}','${item.id}','every',this.value,event)"><span class="unit">년</span></div></div>
          </div></div>`;
      });
      acc += `<button class="btn-add" style="padding:8px;" onclick="addLife('${p.id}',event)">+ ${p.id} 지출 추가</button></div>`;
    }
    acc += '</div>';
    card.innerHTML += acc;
    sb.appendChild(card);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add'; addBtn.innerText = '+ 포트폴리오 추가'; addBtn.onclick = addPortfolio;
  sb.appendChild(addBtn);
}
const decadeLabelPlugin = {
  id: 'decadeLabels',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const absYears = [];
    [10,20,30,40].forEach(y => { if (y >= viewFrom && y <= viewTo) absYears.push(y); });
    if (!absYears.includes(viewTo)) absYears.push(viewTo);
    absYears.forEach(absYear => {
      const index = absYear - viewFrom;
      let items = []; let baseVal = null, baseDiv = null, baseIndex = -1;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        if (!meta.hidden && meta.data[index]) {
          let val = dataset.data[index];
          let monthlyDiv = (dataset.simData && dataset.simData[absYear-1]) ? dataset.simData[absYear-1].dividend / 12 : 0;
          if (baseVal === null) { baseVal = val; baseDiv = monthlyDiv; baseIndex = i; }
          items.push({ val, monthlyDiv, x: meta.data[index].x, y: meta.data[index].y, color: dataset.borderColor, isBase: (i === baseIndex), id: dataset.portId });
        }
      });
      if (!items.length) return;
      let baseX = items[0].x;
      ctx.save(); ctx.beginPath(); ctx.moveTo(baseX, chart.chartArea.top); ctx.lineTo(baseX, chart.chartArea.bottom);
      ctx.strokeStyle = 'rgba(200,200,200,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.stroke(); ctx.restore();
      items.sort((a,b)=>b.val-a.val);
      ctx.font = 'bold 12px Pretendard';
      const pipeStr = ' | '; const pipeW = ctx.measureText(pipeStr).width;
      items.forEach(pt => {
        pt.assetStr = formatMoneyKor(pt.val);
        pt.divStr = '월 ' + formatMoneyKor(pt.monthlyDiv);
        pt.assetW = ctx.measureText(pt.assetStr).width;
        pt.divW = ctx.measureText(pt.divStr).width;
        pt.hasGap = items.length > 1 && !pt.isBase;
        if (pt.hasGap) {
          let gapAsset = pt.val - baseVal, gapDiv = pt.monthlyDiv - baseDiv;
          pt.gapAssetStr = (gapAsset>0?'+':'') + formatMoneyKor(gapAsset);
          pt.gapAssetW = ctx.measureText(pt.gapAssetStr).width;
          pt.gapAssetColor = gapAsset>0?COLOR_UP:(gapAsset<0?COLOR_DOWN:'#6b7280');
          pt.gapDivStr = (gapDiv>0?'+':'') + formatMoneyKor(gapDiv);
          pt.gapDivW = ctx.measureText(pt.gapDivStr).width;
          pt.gapDivColor = gapDiv>0?COLOR_UP:(gapDiv<0?COLOR_DOWN:'#6b7280');
        } else { pt.gapAssetW = 0; pt.gapDivW = 0; }
        pt.maxLeftW = Math.max(pt.assetW, pt.gapAssetW);
        pt.maxRightW = Math.max(pt.divW, pt.gapDivW);
        pt.boxW = pt.maxLeftW + pipeW + pt.maxRightW + 40;
        pt.boxH = pt.hasGap ? 44 : 24;
      });
      let highestY = Math.min(...items.map(p=>p.y));
      let totalHeight = items.reduce((s,pt)=>s+pt.boxH+6,0);
      let startY = highestY - totalHeight - 10;
      if (startY < chart.chartArea.top + 5) startY = chart.chartArea.top + 5;
      let currentY = startY;
      items.forEach(pt => {
        let centerX = baseX;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(centerX-pt.boxW/2, currentY, pt.boxW, pt.boxH, 6); ctx.fill(); }
        else ctx.fillRect(centerX-pt.boxW/2, currentY, pt.boxW, pt.boxH);
        let row1Y = currentY + (pt.hasGap ? 12 : pt.boxH/2);
        ctx.fillStyle = pt.color; ctx.font = '900 15px Pretendard'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pt.id, centerX - pt.maxLeftW - pipeW/2 - 14, row1Y);
        ctx.font = 'bold 12px Pretendard';
        ctx.fillStyle = '#111827'; ctx.textAlign = 'right'; ctx.fillText(pt.assetStr, centerX - pipeW/2, row1Y);
        ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center'; ctx.fillText(pipeStr, centerX, row1Y - 1);
        ctx.fillStyle = '#111827'; ctx.textAlign = 'left'; ctx.fillText(pt.divStr, centerX + pipeW/2, row1Y);
        if (pt.hasGap) {
          let row2Y = currentY + 31;
          ctx.fillStyle = pt.gapAssetColor; ctx.textAlign = 'right'; ctx.fillText(pt.gapAssetStr, centerX - pipeW/2, row2Y);
          ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center'; ctx.fillText(pipeStr, centerX, row2Y - 1);
          ctx.fillStyle = pt.gapDivColor; ctx.textAlign = 'left'; ctx.fillText(pt.gapDivStr, centerX + pipeW/2, row2Y);
        }
        ctx.restore();
        currentY += pt.boxH + 6;
      });
    });
  }
};
function initChart() {
  chartInstance = new Chart(document.getElementById('growthChart').getContext('2d'), {
    type: 'line', plugins: [decadeLabelPlugin],
    data: { labels: Array.from({length: 40}, (_, i) => (i + 1) + '년'), datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 20, right: 140, bottom: 5 } },
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { label: function(c) { return ' ' + c.dataset.label + ': ' + formatMoneyKor(c.raw); } } } },
      scales: { y: { grace: '20%', ticks: { callback: (v) => formatMoneyKor(v) } }, x: { grid: { display: false } } }
    }
  });
}
function renderTableAndChart() {
  const visiblePorts = portfolios.filter(p => p.visible);
  windowSimData = visiblePorts.map(p => calculateData(p, portHasLife(p)));
  const s = viewFrom - 1, e = viewTo;
  chartInstance.data.labels = Array.from({length: e - s}, (_, i) => (s + i + 1) + '년');
  const datasets = [];
  visiblePorts.forEach((p, i) => {
    const base = calculateData(p, false);
    datasets.push({
      label: p.id,
      data: base.slice(s, e).map(d => d.asset),
      borderColor: p.color, backgroundColor: 'transparent',
      borderWidth: 2, tension: 0.2, pointRadius: (ctx) => [10,20,30,40].includes(viewFrom + ctx.dataIndex) ? 4 : 0, pointHoverRadius: 5, fill: false, portId: p.id, simData: base
    });
    if (portHasLife(p)) {
      const alt = windowSimData[i];
      datasets.push({
        label: p.id + '-1',
        data: alt.slice(s, e).map(d => d.asset),
        borderColor: p.color, backgroundColor: p.color + '22',
        borderWidth: 2, borderDash: [6, 4], tension: 0.2, pointRadius: (ctx) => [10,20,30,40].includes(viewFrom + ctx.dataIndex) ? 4 : 0, pointHoverRadius: 5, fill: false, portId: p.id + '-1', simData: alt
      });
    }
  });
  chartInstance.data.datasets = datasets;
  const badge = document.getElementById('fireBadge');
  if (badge) {
    const parts = visiblePorts.filter(portHasLife).map(p => {
      const gap = calculateData(p, false)[39].asset - calculateData(p, true)[39].asset;
      return p.id + ' vs ' + p.id + '-1  ' + formatMoneyKor(gap);
    });
    if (!parts.length) { badge.className = 'fire-badge'; badge.innerText = '기본 경로만 표시'; }
    else { badge.className = 'fire-badge bad'; badge.innerText = parts.join(' · '); }
  }
  const vals = chartInstance.data.datasets.flatMap(d => d.data).filter(v => Number.isFinite(v));
  if (fitY && vals.length) {
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const pad = Math.max((maxV - minV) * 0.12, maxV * 0.02, 1);
    chartInstance.options.scales.y.min = Math.max(0, minV - pad);
    chartInstance.options.scales.y.max = maxV + pad;
  } else {
    delete chartInstance.options.scales.y.min;
    delete chartInstance.options.scales.y.max;
  }
  chartInstance.update();
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  if (!visiblePorts.length) return;
  let tr1 = '<tr><th rowspan="2">연차</th>';
  let tr2 = '<tr>';
  visiblePorts.forEach(p => {
    tr1 += `<th colspan="6" style="color:${p.color};border-left:2px solid ${p.color};">${esc(p.name)}</th>`;
    tr2 += `<th style="border-left:2px solid ${p.color};">납입(만)</th><th>증가(%)</th><th>성장(%)</th><th>배당(%)</th><th style="color:${p.color};">월배당액</th><th style="color:${p.color};">누적 자산</th>`;
  });
  if (visiblePorts.length > 1) {
    tr1 += `<th colspan="${(visiblePorts.length-1)*2}">[기준: ${visiblePorts[0].id}] 대비 차액</th>`;
    for (let i=1;i<visiblePorts.length;i++) tr2 += `<th>${visiblePorts[i].id} - ${visiblePorts[0].id}</th><th>Gap(%)</th>`;
  }
  thead.innerHTML = tr1+'</tr>'+tr2+'</tr>';
  for (let y=0;y<40;y++) {
    const tr = document.createElement('tr');
    let rowHtml = `<td>${y+1}년</td>`;
    visiblePorts.forEach((p, idx) => {
      const d = windowSimData[idx][y];
      rowHtml += `<td style="border-left:2px solid ${p.color};"><input type="number" class="inline-input ${d.overM?'is-overridden':''}" value="${formatNum(d.monthly)}" onchange="setOverride('${p.id}', ${y+1}, 'monthly', this.value)"></td>`;
      rowHtml += `<td><input type="number" class="inline-input ${d.overI?'is-overridden':''}" value="${formatNum(d.inc)}" onchange="setOverride('${p.id}', ${y+1}, 'inc', this.value)"></td>`;
      rowHtml += `<td><input type="number" class="inline-input ${d.overG?'is-overridden':''}" value="${formatNum(d.growth)}" onchange="setOverride('${p.id}', ${y+1}, 'growth', this.value)"></td>`;
      rowHtml += `<td><input type="number" class="inline-input ${d.overD?'is-overridden':''}" value="${formatNum(d.div)}" onchange="setOverride('${p.id}', ${y+1}, 'div', this.value)"></td>`;
      rowHtml += `<td style="color:${p.color};">${formatMoneyKor(d.dividend/12)}</td>`;
      rowHtml += `<td class="text-bold" style="color:${p.color};">${formatMoneyKor(d.asset)}</td>`;
    });
    if (visiblePorts.length > 1) {
      const baseAsset = windowSimData[0][y].asset;
      for (let i=1;i<visiblePorts.length;i++) {
        const diff = windowSimData[i][y].asset - baseAsset;
        const gapPercent = baseAsset>0 ? (diff/baseAsset)*100 : 0;
        const sign = diff>0?'+':'';
        const colorClass = diff>0?'color-up':(diff<0?'color-down':'');
        rowHtml += `<td class="${colorClass}">${sign}${formatMoneyKor(diff)}</td><td class="${colorClass}">${sign}${gapPercent.toFixed(1)}%</td>`;
      }
    }
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  }
}
function renderAll() { renderSidebar(); renderTableAndChart(); }
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.range-chip').forEach(btn => {
    btn.addEventListener('click', () => setRange(btn.dataset.to));
  });
  const fit = document.getElementById('fitY');
  if (fit) fit.addEventListener('change', function(){ fitY = this.checked; if (chartInstance) renderTableAndChart(); });
  initChart(); renderAll();
});
