const gridContainer = document.getElementById('chart-grid');
const gridManager = new GridManager(gridContainer);
const watchlistContainer = document.getElementById('watchlist-panel');
const dataBridge = new DataBridge();

let panes = [];
let allSymbols = [];
let cryptoSymbols = [];

async function init() {
  loadSymbolsInline();

  const chartCountSelect = document.getElementById('chart-count');
  chartCountSelect.addEventListener('change', () => {
    setChartCount(parseInt(chartCountSelect.value));
    saveState();
  });

  const savedCount = localStorage.getItem('tradingDash_chartCount');
  const initialCount = savedCount ? parseInt(savedCount) : 2;
  chartCountSelect.value = initialCount;

  createPanes(8);
  setChartCount(initialCount);

  for (const pane of panes) {
    pane.setSymbolList(allSymbols);
  }

  const savedConfigs = localStorage.getItem('tradingDash_paneConfigs');
  if (savedConfigs) {
    try {
      const configs = JSON.parse(savedConfigs);
      for (const config of configs) {
        const pane = panes[configs.indexOf(config)];
        if (pane && config.symbol) {
          pane.symbol = config.symbol;
          pane.source = config.source || 'yfinance';
          pane.timeframe = config.timeframe || '1h';
          pane.symbolLabel.textContent = config.symbol;
          pane.timeframeSelect.value = pane.timeframe;
          const opt = pane.symbolSelect.querySelector(`option[value="${config.symbol}"]`);
          if (opt) opt.selected = true;
          setTimeout(() => pane.loadData(), 200);
        }
      }
    } catch(e) { console.error('Restore error:', e); }
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
    setTimeout(() => panes[0].loadData(), 300);
  }

  new Watchlist(watchlistContainer, dataBridge, addSymbolToPane);

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
    panes.push(new ChartPane(i, div, dataBridge, gridManager));
  }
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
