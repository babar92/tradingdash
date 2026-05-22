const gridContainer = document.getElementById('chart-grid');
const gridManager = new GridManager(gridContainer);
const watchlistContainer = document.getElementById('watchlist-panel');
const dataBridge = new DataBridge();

let panes = [];
let allSymbols = [];
let cryptoSymbols = [];
let watchlist = null;

async function init() {
  loadSymbolsInline();

  const chartCountSelect = document.getElementById('chart-count');
  chartCountSelect.addEventListener('change', () => {
    setChartCount(parseInt(chartCountSelect.value));
    saveState();
  });

  localStorage.removeItem('tradingDash_chartCount');
  localStorage.removeItem('tradingDash_paneConfigs');
  const initialCount = 1;
  chartCountSelect.value = initialCount;

  createPanes(8);
  setChartCount(initialCount);

  for (const pane of panes) {
    pane.setSymbolList(allSymbols);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlSymbol = urlParams.get('symbol');
  const urlTimeframe = urlParams.get('timeframe');
  if (urlSymbol && panes[0]) {
    const source = cryptoSymbols.includes(urlSymbol) ? 'hyperliquid' : 'yfinance';
    panes[0].symbol = urlSymbol;
    panes[0].source = source;
    panes[0].symbolLabel.textContent = urlSymbol;
    const opt = panes[0].symbolSelect.querySelector(`option[value="${urlSymbol}"]`);
    if (opt) opt.selected = true;
    if (urlTimeframe) {
      panes[0].timeframe = urlTimeframe;
      const tfBtn = panes[0].timeframeBar.querySelector(`[data-tf="${urlTimeframe}"]`);
      if (tfBtn) {
        panes[0].timeframeBar.querySelector('.active')?.classList.remove('active');
        tfBtn.classList.add('active');
      }
    }
    setTimeout(() => { panes[0].loadData(); setActiveWatchlistSymbol(urlSymbol); }, 300);
  }

  if (!panes[0].symbol) {
    const sym = 'BTC';
    panes[0].symbol = sym;
    panes[0].source = 'hyperliquid';
    panes[0].timeframe = '4h';
    panes[0].symbolLabel.textContent = sym;
    const opt = panes[0].symbolSelect.querySelector(`option[value="${sym}"]`);
    if (opt) opt.selected = true;
    const tfBtn = panes[0].timeframeBar.querySelector('[data-tf="4h"]');
    if (tfBtn) {
      panes[0].timeframeBar.querySelector('.active')?.classList.remove('active');
      tfBtn.classList.add('active');
    }
    setTimeout(() => {
      const ichiBtn = panes[0].container.querySelector('.layer-row[data-indicator="ichimoku"]');
      if (ichiBtn && !ichiBtn.classList.contains('active')) ichiBtn.click();
      panes[0].loadData();
      setActiveWatchlistSymbol(sym);
    }, 300);
  }

  watchlist = new Watchlist(watchlistContainer, dataBridge, addSymbolToPane);

  dataBridge.init().catch(e => console.error('Bridge init:', e));
}

function loadSymbolsInline() {
  allSymbols = [
    {symbol:'BTC',name:'Bitcoin',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'ETH',name:'Ethereum',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'LINK',name:'Chainlink',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'TAO',name:'Bittensor',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'AKT',name:'Akash Network',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'MLC',name:'MyLocalCoin',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'BORG',name:'SwissBorg',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'SOL',name:'Solana',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'ARB',name:'Arbitrum',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'OP',name:'Optimism',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'DOGE',name:'Dogecoin',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'AVAX',name:'Avalanche',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'MATIC',name:'Polygon',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'ATOM',name:'Cosmos',source:'hyperliquid',asset_type:'crypto'},
    {symbol:'MSTR',name:'MicroStrategy',source:'yfinance',asset_type:'stock'},
    {symbol:'OVH.PA',name:'OVHcloud',source:'yfinance',asset_type:'stock'},
    {symbol:'SLV',name:'Silver Trust',source:'yfinance',asset_type:'etf'},
    {symbol:'BZ=F',name:'Brent Crude',source:'yfinance',asset_type:'commodity'},
    {symbol:'RELIANCE.NS',name:'Reliance Industries',source:'yfinance',asset_type:'stock'},
    {symbol:'TCS.NS',name:'TCS',source:'yfinance',asset_type:'stock'},
    {symbol:'INFY.NS',name:'Infosys',source:'yfinance',asset_type:'stock'},
    {symbol:'HDFCBANK.NS',name:'HDFC Bank',source:'yfinance',asset_type:'stock'},
    {symbol:'ICICIBANK.NS',name:'ICICI Bank',source:'yfinance',asset_type:'stock'},
    {symbol:'SBIN.NS',name:'SBI',source:'yfinance',asset_type:'stock'},
    {symbol:'ITC.NS',name:'ITC',source:'yfinance',asset_type:'stock'},
    {symbol:'HINDUNILVR.NS',name:'HUL',source:'yfinance',asset_type:'stock'},
    {symbol:'TSLA',name:'Tesla',source:'yfinance',asset_type:'stock'},
    {symbol:'AAPL',name:'Apple',source:'yfinance',asset_type:'stock'},
    {symbol:'MSFT',name:'Microsoft',source:'yfinance',asset_type:'stock'},
    {symbol:'NVDA',name:'NVIDIA',source:'yfinance',asset_type:'stock'},
  ];
  cryptoSymbols = allSymbols.filter(s => s.source === 'hyperliquid').map(s => s.symbol);
}

function createPanes(maxCount) {
  for (let i = 0; i < maxCount; i++) {
    const div = document.createElement('div');
    div.className = 'pane';
    div.id = `pane-${i}`;
    gridContainer.appendChild(div);
    panes.push(new ChartPane(i, div, dataBridge, gridManager, setActiveWatchlistSymbol, syncPanes));
  }
}

let _syncingPanes = false;

function syncPanes(sourceId, range) {
  if (_syncingPanes) return;
  _syncingPanes = true;
  for (const pane of panes) {
    if (pane.paneId !== sourceId && pane.mainChart) {
      pane.syncToRange(range);
    }
  }
  _syncingPanes = false;
}

function setActiveWatchlistSymbol(symbol) {
  if (watchlist) watchlist.setActiveSymbol(symbol);
}

function setChartCount(count) {
  gridManager.apply(count);
  panes.forEach((pane, i) => {
    if (i < count) {
      pane.container.style.display = 'flex';
      requestAnimationFrame(() => pane._doResize());
    } else {
      pane.container.style.display = 'none';
    }
  });
}

function addSymbolToPane(symbol) {
  const source = cryptoSymbols.includes(symbol) ? 'hyperliquid' : 'yfinance';
  const visiblePanes = panes.filter(p => p.container.style.display !== 'none');
  const targetPane = visiblePanes.find(p => !p.symbol) || visiblePanes[0];
  if (!targetPane) return;

  targetPane.symbol = symbol;
  targetPane.source = source;
  targetPane.symbolLabel.textContent = symbol;
  const opt = targetPane.symbolSelect.querySelector(`option[value="${symbol}"]`);
  if (opt) opt.selected = true;
  targetPane.loadData();
  setActiveWatchlistSymbol(symbol);
  saveState();
}

function saveState() {
  const count = parseInt(document.getElementById('chart-count').value);
  localStorage.setItem('tradingDash_chartCount', count);
  const configs = panes.filter(p => p.symbol).map(p => ({
    symbol: p.symbol, source: p.source, timeframe: p.timeframe,
  }));
  localStorage.setItem('tradingDash_paneConfigs', JSON.stringify(configs));
}

document.addEventListener('DOMContentLoaded', init);
