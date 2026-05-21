class Watchlist {
  constructor(container, dataBridge, onSymbolClick) {
    this.container = container;
    this.dataBridge = dataBridge;
    this.onSymbolClick = onSymbolClick || (() => {});
    this.prices = {};
    this.sections = {};
    this.initialItems = {
      crypto: [
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'LINK', name: 'Chainlink' },
        { symbol: 'TAO', name: 'Bittensor' },
        { symbol: 'AKT', name: 'Akash Network' },
        { symbol: 'MLC', name: 'MyLocalCoin' },
        { symbol: 'BORG', name: 'SwissBorg' },
        { symbol: 'ETH', name: 'Ethereum' },
        { symbol: 'SOL', name: 'Solana' },
      ],
      stocks: [
        { symbol: 'MSTR', name: 'MicroStrategy' },
        { symbol: 'OVH.PA', name: 'OVHcloud' },
        { symbol: 'SLV', name: 'Silver Trust' },
        { symbol: 'BZ=F', name: 'Brent Crude' },
        { symbol: 'RELIANCE.NS', name: 'Reliance' },
        { symbol: 'TCS.NS', name: 'TCS' },
        { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
      ],
    };
    this.allSymbols = [];
    this.buildDOM();
  }

  _getSource(symbol) {
    const found = this.allSymbols.find(s => s.symbol === symbol);
    if (found) return found.source || 'yfinance';
    const cryptoList = this.initialItems.crypto.concat(this.sections.crypto?.items || []);
    return cryptoList.some(s => s.symbol === symbol) ? 'hyperliquid' : 'yfinance';
  }

  buildDOM() {
    this.container.classList.add('watchlist');

    const title = document.createElement('div');
    title.className = 'watchlist-title';
    title.textContent = 'WATCHLIST';
    this.container.appendChild(title);

    this.searchRow = document.createElement('div');
    this.searchRow.className = 'watchlist-search';
    this.searchInput = document.createElement('input');
    this.searchInput.className = 'wl-search-input';
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Rechercher un asset...';
    this.searchInput.addEventListener('input', () => this._onSearch());
    this.searchInput.addEventListener('blur', () => setTimeout(() => this._hideDropdown(), 200));
    this.searchInput.addEventListener('focus', () => { if (this.searchInput.value) this._onSearch(); });
    this.searchBtn = document.createElement('button');
    this.searchBtn.className = 'wl-search-btn';
    this.searchBtn.textContent = '+';
    this.searchBtn.addEventListener('click', () => this._addFirstSearchResult());
    this.searchDropdown = document.createElement('div');
    this.searchDropdown.className = 'wl-search-dropdown';
    this.searchRow.append(this.searchInput, this.searchBtn, this.searchDropdown);
    this.container.appendChild(this.searchRow);

    this.cryptoSection = this._createSection('CRYPTO', [...this.initialItems.crypto]);
    this.standardSection = this._createSection('STOCKS / ASSETS', [...this.initialItems.stocks]);

    this.container.appendChild(this.cryptoSection.wrapper);
    this.container.appendChild(this.standardSection.wrapper);

    this._loadSymbols().then(() => {
      this._startListening();
      this._fetchInitialPrices();
    });
  }

  async _loadSymbols() {
    try {
      const resp = await fetch('/api/symbols-embedded');
      if (resp.ok) this.allSymbols = await resp.json();
    } catch (e) {
      console.warn('Failed to load symbols list', e);
    }
  }

  _onSearch() {
    const q = this.searchInput.value.trim().toUpperCase();
    this.searchDropdown.innerHTML = '';

    if (!q || q.length < 1) { this._hideDropdown(); return; }

    const matches = this.allSymbols.filter(s =>
      s.symbol.toUpperCase().includes(q) || (s.name && s.name.toUpperCase().includes(q))
    ).slice(0, 20);

    if (matches.length === 0) { this._hideDropdown(); return; }

    this.searchDropdown.style.display = 'block';
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'wl-search-item';
      item.dataset.symbol = m.symbol;
      item.dataset.source = m.source || 'yfinance';
      item.innerHTML = `<span class="wl-si-symbol">${m.symbol}</span><span class="wl-si-name">${m.name || ''}</span><span class="wl-si-source">${(m.source || 'yfinance') === 'hyperliquid' ? 'CRYPTO' : 'ASSET'}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._addSymbol(m.symbol, m.name || m.symbol, m.source || 'yfinance');
      });
      this.searchDropdown.appendChild(item);
    });
  }

  _hideDropdown() {
    this.searchDropdown.style.display = 'none';
  }

  _addFirstSearchResult() {
    const first = this.searchDropdown.querySelector('.wl-search-item');
    if (first) {
      this._addSymbol(first.dataset.symbol, first.querySelector('.wl-si-name')?.textContent || first.dataset.symbol, first.dataset.source || 'yfinance');
      this.searchInput.value = '';
      this._hideDropdown();
    }
  }

  _addSymbol(symbol, name, source) {
    const existing = this.container.querySelector(`.watchlist-item[data-symbol="${symbol}"]`);
    if (existing) return;

    const isCrypto = source === 'hyperliquid';
    const sectionKey = isCrypto ? 'crypto' : 'stocks / assets';
    const section = this.sections[sectionKey];
    if (!section) return;

    const item = { symbol, name };
    section.items.push(item);

    const row = this._createRow(item);
    section.list.appendChild(row);

    this.dataBridge.subscribe('watchlist', symbol, source, {
      onPrice: (update) => this.updatePrice(symbol, update),
    });

    this.prices[symbol] = { price: null, prevPrice: null, change: null };
    fetch(`/api/price-summary?source=${source}&symbol=${symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.price) this.updatePrice(symbol, data); })
      .catch(() => {});
  }

  _removeSymbol(symbol) {
    const row = this.container.querySelector(`.watchlist-item[data-symbol="${symbol}"]`);
    if (!row) return;

    const sectionEl = row.closest('.watchlist-section');
    const sectionKey = sectionEl?.querySelector('.watchlist-section-header')?.textContent?.toLowerCase().trim();
    const section = this.sections[sectionKey];
    if (section) {
      section.items = section.items.filter(i => i.symbol !== symbol);
    }

    this.dataBridge.unsubscribe('watchlist', symbol);
    row.remove();
    delete this.prices[symbol];
  }

  _createSection(title, items) {
    const wrapper = document.createElement('div');
    wrapper.className = 'watchlist-section';

    const header = document.createElement('div');
    header.className = 'watchlist-section-header';
    header.textContent = title;
    wrapper.appendChild(header);

    const colHeader = document.createElement('div');
    colHeader.className = 'watchlist-col-header';
    colHeader.innerHTML = '<span>Symbole</span><span>Prix</span><span>Change</span>';
    wrapper.appendChild(colHeader);

    const list = document.createElement('div');
    list.className = 'watchlist-items';

    items.forEach(item => {
      const row = this._createRow(item);
      list.appendChild(row);
    });

    wrapper.appendChild(list);
    const sectionKey = title.toLowerCase();
    this.sections[sectionKey] = { wrapper, list, items };

    return { wrapper, list, items };
  }

  _createRow(item) {
    const row = document.createElement('div');
    row.className = 'watchlist-item';
    row.dataset.symbol = item.symbol;

    const sym = document.createElement('span');
    sym.className = 'wl-symbol';
    sym.textContent = item.symbol;
    row.appendChild(sym);

    const name = document.createElement('span');
    name.className = 'wl-name';
    name.textContent = item.name || '';
    row.appendChild(name);

    const price = document.createElement('span');
    price.className = 'wl-price';
    price.textContent = '--';
    row.appendChild(price);

    const change = document.createElement('span');
    change.className = 'wl-change';
    change.textContent = '--';
    row.appendChild(change);

    const delBtn = document.createElement('button');
    delBtn.className = 'wl-del-btn';
    delBtn.textContent = '\u2212';
    delBtn.title = 'Retirer';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._removeSymbol(item.symbol); });
    row.appendChild(delBtn);

    row.addEventListener('click', () => this.onSymbolClick(item.symbol));
    this.prices[item.symbol] = { price: null, prevPrice: null, change: null };

    return row;
  }

  async _fetchInitialPrices() {
    const allItems = [
      ...this.initialItems.crypto.map(s => ({ ...s, source: 'hyperliquid' })),
      ...this.initialItems.stocks.map(s => ({ ...s, source: 'yfinance' })),
    ];

    const fetches = allItems.map(item =>
      fetch(`/api/price-summary?source=${item.source}&symbol=${item.symbol}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && data.price) this.updatePrice(item.symbol, data); })
        .catch(() => {})
    );

    await Promise.allSettled(fetches);
  }

  _startListening() {
    const allItems = [
      ...this.initialItems.crypto.map(s => ({ ...s, source: 'hyperliquid' })),
      ...this.initialItems.stocks.map(s => ({ ...s, source: 'yfinance' })),
    ];

    allItems.forEach(item => {
      this.dataBridge.subscribe('watchlist', item.symbol, item.source, {
        onPrice: (update) => this.updatePrice(item.symbol, update),
      });
    });
  }

  setActiveSymbol(symbol) {
    this.container.querySelectorAll('.watchlist-item').forEach(el => el.classList.remove('active'));
    if (symbol) {
      const row = this.container.querySelector(`.watchlist-item[data-symbol="${symbol}"]`);
      if (row) row.classList.add('active');
    }
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
