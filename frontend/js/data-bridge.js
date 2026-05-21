class DataBridge {
  constructor() {
    this.hyperliquidWS = null;
    this.socketIO = null;
    this.hyperliquidReconnectTimer = null;
    this.subscribers = {};
    this.hyperliquidPrices = {};
    this.lastMids = {};
    this.symbolSourceMap = {};
    this._ohlcCache = {};
  }

  async init() {
    this.connectHyperliquid();
    await this.connectSocketIO();
  }

  connectHyperliquid() {
    if (this.hyperliquidWS) {
      try { this.hyperliquidWS.close(); } catch(e) {}
    }

    try {
      this.hyperliquidWS = new WebSocket('wss://api.hyperliquid.xyz/ws');
    } catch (e) {
      console.error('Hyperliquid WS connection failed:', e);
      this.scheduleHyperliquidReconnect();
      return;
    }

    this.hyperliquidWS.onopen = () => {
      console.log('Hyperliquid WS connected');
      this.hyperliquidWS.send(JSON.stringify({
        method: 'subscribe',
        channel: { name: 'allMids' }
      }));
      for (const symbol of Object.keys(this.lastMids)) {
        this.hyperliquidWS.send(JSON.stringify({
          method: 'subscribe',
          channel: { name: 'trades', coin: symbol }
        }));
      }
    };

    this.hyperliquidWS.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'allMids' && msg.data?.mids) {
          for (const [coin, mid] of Object.entries(msg.data.mids)) {
            const price = parseFloat(mid);
            const prev = this.lastMids[coin] || price;
            this.lastMids[coin] = price;
            this.hyperliquidPrices[coin] = price;
            this.dispatchPrice(coin, price, price - prev, prev > 0 ? ((price - prev) / prev * 100) : 0);
          }
        }
        if (msg.channel === 'trades' && Array.isArray(msg.data)) {
          for (const trade of msg.data) {
            const price = parseFloat(trade.px);
            const coin = trade.coin;
            const prev = this.lastMids[coin] || price;
            this.lastMids[coin] = price;
            this.dispatchTrade(coin, price, parseFloat(trade.sz), trade.time, trade.side);
          }
        }
      } catch (e) {
        console.error('Hyperliquid WS parse error:', e);
      }
    };

    this.hyperliquidWS.onclose = () => {
      console.log('Hyperliquid WS disconnected, reconnecting...');
      this.scheduleHyperliquidReconnect();
    };

    this.hyperliquidWS.onerror = (e) => {
      console.error('Hyperliquid WS error:', e);
    };
  }

  scheduleHyperliquidReconnect() {
    if (this.hyperliquidReconnectTimer) clearTimeout(this.hyperliquidReconnectTimer);
    this.hyperliquidReconnectTimer = setTimeout(() => this.connectHyperliquid(), 3000);
  }

  async connectSocketIO() {
    if (typeof io === 'undefined') {
      console.warn('SocketIO not loaded, retrying in 1s');
      await new Promise(r => setTimeout(r, 1000));
      if (typeof io === 'undefined') {
        console.error('SocketIO library not available');
        return;
      }
    }
    try {
      this.socketIO = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
      });
      this.socketIO.on('connect', () => console.log('SocketIO connected'));
      this.socketIO.on('price_update', (data) => {
        this.dispatchPrice(data.symbol, data.price, data.change || 0, data.changePercent || 0, data);
      });
      this.socketIO.on('disconnect', () => console.log('SocketIO disconnected'));
    } catch (e) {
      console.error('SocketIO connection error:', e);
    }
  }

  dispatchPrice(symbol, price, change, changePercent, extra = {}) {
    const subs = this.subscribers[symbol] || [];
    for (const sub of subs) {
      if (sub.onPrice) sub.onPrice({ symbol, price, change, changePercent, ...extra });
    }
  }

  dispatchTrade(symbol, price, size, time, side) {
    const subs = this.subscribers[symbol] || [];
    for (const sub of subs) {
      if (sub.onTrade) sub.onTrade({ symbol, price, size, time, side });
    }
  }

  subscribe(paneId, symbol, source, callbacks) {
    if (!this.subscribers[symbol]) this.subscribers[symbol] = [];
    this.subscribers[symbol].push({ paneId, ...callbacks });
    this.symbolSourceMap[symbol] = source;

    if (source === 'hyperliquid') {
      if (this.hyperliquidWS && this.hyperliquidWS.readyState === WebSocket.OPEN) {
        this.hyperliquidWS.send(JSON.stringify({
          method: 'subscribe',
          channel: { name: 'trades', coin: symbol }
        }));
      }
    } else if (source === 'yfinance') {
      if (this.socketIO && this.socketIO.connected) {
        this.socketIO.emit('subscribe_stock', { symbol });
      }
    }
  }

  unsubscribe(paneId, symbol) {
    if (this.subscribers[symbol]) {
      this.subscribers[symbol] = this.subscribers[symbol].filter(s => s.paneId !== paneId);
      if (this.subscribers[symbol].length === 0) {
        delete this.subscribers[symbol];
        if (this.socketIO && this.socketIO.connected) {
          this.socketIO.emit('unsubscribe_stock', { symbol });
        }
      }
    }
  }

  async fetchOHLC(symbol, source, timeframe, limit = 500) {
    const cacheKey = `${symbol}:${source}:${timeframe}`;
    if (source === 'hyperliquid') {
      const url = `/api/ohlc?source=hyperliquid&symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`;
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          this._ohlcCache[cacheKey] = data;
          return data;
        }
      } catch (e) {
        console.error(`OHLC fetch error for ${symbol}:`, e);
      }
    } else {
      const url = `/api/ohlc?source=yfinance&symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`;
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          this._ohlcCache[cacheKey] = data;
          return data;
        }
      } catch (e) {
        console.error(`OHLC fetch error for ${symbol}:`, e);
      }
    }
    return this._ohlcCache[cacheKey] || [];
  }
}
