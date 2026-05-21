class Watchlist {
  constructor(container, dataBridge, onSymbolClick) {
    this.container = container;
    this.dataBridge = dataBridge;
    this.onSymbolClick = onSymbolClick || (() => {});
    this.prices = {};
    this.sections = {};
    this.buildDOM();
  }

  buildDOM() {
    this.container.classList.add('watchlist');

    const title = document.createElement('div');
    title.className = 'watchlist-title';
    title.textContent = 'WATCHLIST';
    this.container.appendChild(title);

    this.cryptoSection = this._createSection('CRYPTO', [
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'LINK', name: 'Chainlink' },
      { symbol: 'TAO', name: 'Bittensor' },
      { symbol: 'AKT', name: 'Akash Network' },
      { symbol: 'MLC', name: 'MyLocalCoin' },
      { symbol: 'BORG', name: 'SwissBorg' },
      { symbol: 'ETH', name: 'Ethereum' },
      { symbol: 'SOL', name: 'Solana' },
    ]);

    this.standardSection = this._createSection('STOCKS / ASSETS', [
      { symbol: 'MSTR', name: 'MicroStrategy' },
      { symbol: 'OVH.PA', name: 'OVHcloud' },
      { symbol: 'SLV', name: 'Silver Trust' },
      { symbol: 'BZ=F', name: 'Brent Crude' },
      { symbol: 'RELIANCE.NS', name: 'Reliance' },
      { symbol: 'TCS.NS', name: 'TCS' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
    ]);

    this.container.appendChild(this.cryptoSection.wrapper);
    this.container.appendChild(this.standardSection.wrapper);

    this._startListening();
  }

  _createSection(title, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'watchlist-section';

    const header = document.createElement('div');
    header.className = 'watchlist-section-header';
    header.textContent = title;
    wrapper.appendChild(header);

    const list = document.createElement('div');
    list.className = 'watchlist-items';

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'watchlist-item';
      row.dataset.symbol = item.symbol;

      const sym = document.createElement('span');
      sym.className = 'wl-symbol';
      sym.textContent = item.symbol;
      row.appendChild(sym);

      const name = document.createElement('span');
      name.className = 'wl-name';
      name.textContent = item.name;
      row.appendChild(name);

      const price = document.createElement('span');
      price.className = 'wl-price';
      price.textContent = '--';
      row.appendChild(price);

      const change = document.createElement('span');
      change.className = 'wl-change';
      change.textContent = '--';
      row.appendChild(change);

      row.addEventListener('click', () => this.onSymbolClick(item.symbol));
      list.appendChild(row);

      this.prices[item.symbol] = { price: null, prevPrice: null, change: null };
    });

    wrapper.appendChild(list);
    const sectionKey = title.toLowerCase();
    this.sections[sectionKey] = { wrapper, list, items };

    return { wrapper, list, items };
  }

  _startListening() {
    const cryptoList = ['BTC','LINK','TAO','AKT','MLC','BORG','ETH','SOL'];
    const yfList = ['MSTR','OVH.PA','SLV','BZ=F','RELIANCE.NS','TCS.NS','HDFCBANK.NS'];

    cryptoList.forEach(sym => {
      this.dataBridge.subscribe('watchlist', sym, 'hyperliquid', {
        onPrice: (update) => this.updatePrice(sym, update),
      });
    });

    yfList.forEach(sym => {
      this.dataBridge.subscribe('watchlist', sym, 'yfinance', {
        onPrice: (update) => this.updatePrice(sym, update),
      });
    });
  }

  updatePrice(symbol, update) {
    const row = this.container.querySelector(`.watchlist-item[data-symbol="${symbol}"]`);
    if (!row) return;

    const priceEl = row.querySelector('.wl-price');
    const changeEl = row.querySelector('.wl-change');

    if (priceEl) {
      priceEl.textContent = update.price.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
    }

    if (changeEl && update.changePercent !== undefined) {
      const isUp = update.changePercent >= 0;
      changeEl.textContent = `${isUp ? '+' : ''}${update.changePercent.toFixed(2)}%`;
      changeEl.className = `wl-change ${isUp ? 'up' : 'down'}`;

      row.classList.remove('flash-green', 'flash-red');
      void row.offsetWidth;
      row.classList.add(isUp ? 'flash-green' : 'flash-red');
    }
  }
}
