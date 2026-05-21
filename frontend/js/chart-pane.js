class ChartPane {
  constructor(paneId, container, dataBridge, gridManager) {
    this.paneId = paneId;
    this.container = container;
    this.dataBridge = dataBridge;
    this.gridManager = gridManager;

    this.symbol = null;
    this.source = null;
    this.timeframe = '4h';
    this.ohlcData = [];
    this.indicatorsState = { ichimoku: false, sma: false, ema: false, rsi: false, macd: false, bb: false, volume: false };

    this.mainChart = null;
    this.candleSeries = null;
    this.chartType = 'candles';
    this.subCharts = {};
    this.indicatorSeries = {};
    this.drawings = null;

    this._buildDOM();
    try { this._initChart(); } catch (e) {
      console.warn(`Chart init error for pane ${paneId}:`, e);
    }
  }

  _buildDOM() {
    this.container.classList.add('pane');

    this.header = document.createElement('div');
    this.header.className = 'pane-header';

    this.tickerBar = document.createElement('div');
    this.tickerBar.className = 'ticker-bar';

    this.symbolLabel = document.createElement('span');
    this.symbolLabel.className = 'ticker-symbol';
    this.symbolLabel.textContent = 'Select symbol';

    this.priceLabel = document.createElement('span');
    this.priceLabel.className = 'ticker-price';

    this.changeLabel = document.createElement('span');
    this.changeLabel.className = 'ticker-change';

    this.tickerBar.append(this.symbolLabel, this.priceLabel, this.changeLabel);

    this.controls = document.createElement('div');
    this.controls.className = 'pane-controls';

    this.symbolSelect = document.createElement('select');
    this.symbolSelect.className = 'symbol-select';
    this.symbolSelect.addEventListener('change', () => this.onSymbolChange());

    this.timeframeBar = document.createElement('div');
    this.timeframeBar.className = 'timeframe-bar';
    const tfs = ['1m','5m','15m','30m','1h','2h','4h','1d','1w','1M'];
    tfs.forEach(tf => {
      const btn = document.createElement('button');
      btn.className = 'tf-btn';
      btn.textContent = tf;
      btn.dataset.tf = tf;
      if (tf === this.timeframe) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.timeframeBar.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        this.timeframe = tf;
        this.onTimeframeChange();
      });
      this.timeframeBar.appendChild(btn);
    });

    this.btnAutoFit = document.createElement('button');
    this.btnAutoFit.className = 'pane-btn';
    this.btnAutoFit.textContent = 'A';
    this.btnAutoFit.title = 'Auto-fit chart';
    this.btnAutoFit.addEventListener('click', () => this.fitContent());

    this.btnLogScale = document.createElement('button');
    this.btnLogScale.className = 'pane-btn';
    this.btnLogScale.textContent = 'L';
    this.btnLogScale.title = 'Toggle log scale';
    this.btnLogScale.dataset.log = 'false';
    this.btnLogScale.addEventListener('click', () => this.toggleLogScale());

    this.chartTypeBar = document.createElement('div');
    this.chartTypeBar.className = 'chart-type-bar';
    const chartTypes = ['candles', 'bar', 'line', 'area'];
    chartTypes.forEach(ct => {
      const btn = document.createElement('button');
      btn.className = 'ct-btn' + (ct === this.chartType ? ' active' : '');
      btn.textContent = ct === 'candles' ? 'C' : ct === 'bar' ? 'B' : ct === 'line' ? 'L' : 'A';
      btn.title = ct.charAt(0).toUpperCase() + ct.slice(1);
      btn.dataset.type = ct;
      btn.addEventListener('click', () => this.setChartType(ct));
      this.chartTypeBar.appendChild(btn);
    });

    this.controls.append(this.symbolSelect, this.timeframeBar, this.chartTypeBar, this.btnAutoFit, this.btnLogScale);
    this.header.append(this.tickerBar, this.controls);

    this.chartArea = document.createElement('div');
    this.chartArea.className = 'pane-chart-area';

    this.mainChartDiv = document.createElement('div');
    this.mainChartDiv.className = 'main-chart';
    this.chartArea.appendChild(this.mainChartDiv);

    this.subChartDiv = document.createElement('div');
    this.subChartDiv.className = 'sub-charts';
    this.chartArea.appendChild(this.subChartDiv);

    this.layersPanel = document.createElement('div');
    this.layersPanel.className = 'layers-panel';

    const indicatorColors = {
      ichimoku: '#FF4500', ema50: '#FF9800', ema200: '#E91E63',
      sma: '#FF9800', ema: '#E91E63', bb: '#7B1FA2',
      rsi: '#FF9800', rsi_ema: '#FF9800', macd: '#2962FF', volume: '#26a69a',
    };

    const indicators = [
      { key: 'ichimoku', label: 'Ichimoku', defaultOn: false },
      { key: 'ema50', label: 'EMA(50)', defaultOn: false },
      { key: 'ema200', label: 'EMA(200)', defaultOn: false },
      { key: 'sma', label: 'SMA(20)', defaultOn: false },
      { key: 'ema', label: 'EMA(20)', defaultOn: false },
      { key: 'bb', label: 'Bollinger', defaultOn: false },
      { key: 'rsi', label: 'RSI', defaultOn: false },
      { key: 'rsi_ema', label: 'RSI+EMA', defaultOn: false },
      { key: 'macd', label: 'MACD', defaultOn: false },
      { key: 'volume', label: 'Volume', defaultOn: false },
    ];

    indicators.forEach(ind => {
      const row = document.createElement('div');
      row.className = 'layer-row' + (ind.defaultOn ? ' active' : '');
      row.dataset.indicator = ind.key;
      row.title = ind.label;

      const eye = document.createElement('span');
      eye.className = 'layer-eye';
      eye.textContent = ind.defaultOn ? '\u25CF' : '\u25CB';

      const line = document.createElement('span');
      line.className = 'layer-line';
      line.style.background = indicatorColors[ind.key];

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = ind.label;

      row.append(eye, line, name);
      row.addEventListener('click', () => {
        const on = !row.classList.contains('active');
        this.toggleIndicator(ind.key, on);
        row.classList.toggle('active', on);
        eye.textContent = on ? '\u25CF' : '\u25CB';
      });
      this.layersPanel.appendChild(row);
      this.indicatorsState[ind.key] = ind.defaultOn;
    });

    this.controls.prepend(this.layersPanel);
    this.container.append(this.header, this.chartArea);
  }

  _initChart() {
    this.mainChart = LightweightCharts.createChart(this.mainChartDiv, {
      width: 600,
      height: 400,
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
      watermark: {
        visible: true,
        text: this.symbol || '',
        color: 'rgba(255, 255, 255, 0.14)',
        fontSize: 72,
        fontFamily: 'monospace',
        horzAlign: 'center',
        vertAlign: 'center',
      },
    });

    this.drawings = new DrawingsManager(this);

    requestAnimationFrame(() => this._doResize());
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._doResize());
      this._resizeObserver.observe(this.mainChartDiv);
    }
  }

  _doResize() {
    if (!this.mainChart) return;
    const w = this.mainChartDiv.clientWidth;
    const h = this.mainChartDiv.clientHeight;
    if (w > 10 && h > 50) {
      this.mainChart.resize(w, h);
      for (const key of Object.keys(this.subCharts)) {
        const sub = this.subCharts[key];
        if (sub.chart) sub.chart.resize(w, sub.div.clientHeight || 80);
      }
      if (this.drawings) { this.drawings._resizeCanvas(); this.drawings.render(); }
      this.mainChart.timeScale().fitContent();
    } else {
      requestAnimationFrame(() => this._doResize());
    }
  }

  _createSubChart(height) {
    const div = document.createElement('div');
    div.style.height = height + 'px';
    this.subChartDiv.appendChild(div);

    const chart = LightweightCharts.createChart(div, {
      width: this.mainChartDiv.clientWidth || 400,
      height: height,
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
    });

    chart.timeScale().fitContent();
    return { div, chart };
  }

  setSymbolList(symbols) {
    this.symbolSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select --';
    this.symbolSelect.appendChild(defaultOpt);

    const grouped = { crypto: [], stock: [] };
    for (const s of symbols) {
      if (s.source === 'hyperliquid' || s.asset_type === 'crypto') {
        grouped.crypto.push(s);
      } else {
        grouped.stock.push(s);
      }
    }

    const cryptoGroup = document.createElement('optgroup');
    cryptoGroup.label = 'CRYPTO';
    for (const s of grouped.crypto) {
      const opt = document.createElement('option');
      opt.value = s.symbol;
      opt.textContent = `${s.symbol} - ${s.name}`;
      opt.dataset.source = 'hyperliquid';
      cryptoGroup.appendChild(opt);
    }
    this.symbolSelect.appendChild(cryptoGroup);

    const stockGroup = document.createElement('optgroup');
    stockGroup.label = 'STOCKS / ASSETS';
    for (const s of grouped.stock) {
      const opt = document.createElement('option');
      opt.value = s.symbol;
      opt.textContent = `${s.symbol} - ${s.name}`;
      opt.dataset.source = 'yfinance';
      stockGroup.appendChild(opt);
    }
    this.symbolSelect.appendChild(stockGroup);
  }

  async onSymbolChange() {
    const symbol = this.symbolSelect.value;
    if (!symbol) return;

    const selectedOpt = this.symbolSelect.selectedOptions[0];
    this.source = selectedOpt?.dataset?.source || 'yfinance';

    if (this.symbol && this.symbol !== symbol) {
      this.dataBridge.unsubscribe(this.paneId, this.symbol);
    }

    this.symbol = symbol;
    this.symbolLabel.textContent = symbol;
    this._updateWatermark();
    await this.loadData();
  }

  onTimeframeChange() {
    if (this.symbol) this.loadData();
  }

  async loadData() {
    if (!this.symbol) return;

    const data = await this.dataBridge.fetchOHLC(this.symbol, this.source, this.timeframe, 500);
    if (!data || data.length === 0) {
      console.warn(`No OHLC data for ${this.symbol}`);
      return;
    }

    this.ohlcData = data;

    if (this.candleSeries) {
      this.mainChart.removeSeries(this.candleSeries);
      this.candleSeries = null;
    }

    this.dataBridge.subscribe(this.paneId, this.symbol, this.source, {
      onPrice: (update) => this.onPriceUpdate(update),
    });

    this.clearIndicatorSeries();
    this.renderIndicators();

    this._recreateCandleSeries();
    this._renderCrossMarkers();

    requestAnimationFrame(() => this._doResize());
    this.mainChart.timeScale().fitContent();
  }

  onPriceUpdate(update) {
    this.priceLabel.textContent = update.price.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    if (update.change !== undefined) {
      const isUp = update.change >= 0;
      this.changeLabel.textContent = `${isUp ? '+' : ''}${update.change.toFixed(2)} (${isUp ? '+' : ''}${update.changePercent?.toFixed(2) || '0.00'}%)`;
      this.changeLabel.className = `ticker-change ${isUp ? 'up' : 'down'}`;

      this.tickerBar.classList.remove('flash-green', 'flash-red');
      void this.tickerBar.offsetWidth;
      this.tickerBar.classList.add(isUp ? 'flash-green' : 'flash-red');
    }

    if (update.candle) {
      this.ohlcData.push(update.candle);
      this.candleSeries.update(update.candle);
    }
  }

  toggleIndicator(key, enabled) {
    this.indicatorsState[key] = enabled;
    try {
      this.removeIndicator(key);
    } catch (e) {
      console.warn('removeIndicator error for', key, e);
    }
    if (enabled) {
      try {
        this.renderSingleIndicator(key);
      } catch (e) {
        console.warn('renderSingleIndicator error for', key, e);
      }
    }
    if (this.candleSeries) {
      this.mainChart.removeSeries(this.candleSeries);
    }
    this._recreateCandleSeries();
    try {
      this._renderCrossMarkers();
    } catch (e) {
      console.warn('renderCrossMarkers error', e);
    }
  }

  renderIndicators() {
    this.clearIndicatorSeries();
    for (const [key, enabled] of Object.entries(this.indicatorsState)) {
      if (enabled) this.renderSingleIndicator(key);
    }
  }

  renderSingleIndicator(key) {
    if (!this.ohlcData || this.ohlcData.length === 0) return;

    switch (key) {
      case 'ichimoku':
        this._renderIchimoku();
        break;
      case 'sma':
        this._renderSMA();
        break;
      case 'ema':
        this._renderEMA();
        break;
      case 'ema50':
        this._renderEMA50();
        break;
      case 'ema200':
        this._renderEMA200();
        break;
      case 'bb':
        this._renderBollinger();
        break;
      case 'rsi':
        this._renderRSI();
        break;
      case 'rsi_ema':
        this._renderRSI_EMA();
        break;
      case 'macd':
        this._renderMACD();
        break;
      case 'volume':
        this._renderVolume();
        break;
    }
  }

  removeIndicator(key) {
    const prefix = key + '_';
    for (const k of Object.keys(this.indicatorSeries)) {
      if (k === key || k.startsWith(prefix)) {
        this.mainChart.removeSeries(this.indicatorSeries[k]);
        delete this.indicatorSeries[k];
      }
    }
    if (this.subCharts[key]) {
      this.subCharts[key].div.remove();
      delete this.subCharts[key];
    }
    if (key === 'ichimoku' || key.startsWith('ichimoku_')) {
      this.ichimokuCloud = [];
    }
  }

  clearIndicatorSeries() {
    for (const key of Object.keys(this.indicatorSeries)) {
      this.removeIndicator(key);
    }
    this.subChartDiv.innerHTML = '';
    this.ichimokuCloud = [];
  }

  _renderSMA() {
    const data = Indicators.sma(this.ohlcData, 20);
    this.indicatorSeries['sma'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF9800',
      lineWidth: 1,
      lastValueVisible: false,
    });
    this.indicatorSeries['sma'].setData(data);
  }

  _renderEMA() {
    const data = Indicators.ema(this.ohlcData, 20);
    this.indicatorSeries['ema'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#E91E63',
      lineWidth: 1,
      lastValueVisible: false,
    });
    this.indicatorSeries['ema'].setData(data);
  }

  _renderEMA50() {
    const data = Indicators.ema(this.ohlcData, 50);
    this.indicatorSeries['ema50'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF9800',
      lineWidth: 1,
      lastValueVisible: false,
    });
    this.indicatorSeries['ema50'].setData(data);
  }

  _renderEMA200() {
    const data = Indicators.ema(this.ohlcData, 200);
    this.indicatorSeries['ema200'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#E91E63',
      lineWidth: 1,
      lastValueVisible: false,
    });
    this.indicatorSeries['ema200'].setData(data);
  }

  _renderBollinger() {
    const data = Indicators.bollinger(this.ohlcData, 20, 2);
    this.indicatorSeries['bb_mid'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#9C27B0',
      lineWidth: 1,
      lastValueVisible: false,
    });
    this.indicatorSeries['bb_upper'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#7B1FA2',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
    });
    this.indicatorSeries['bb_lower'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#7B1FA2',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
    });

    this.indicatorSeries['bb_mid'].setData(data.map(d => ({ time: d.time, value: d.middle })));
    this.indicatorSeries['bb_upper'].setData(data.map(d => ({ time: d.time, value: d.upper })));
    this.indicatorSeries['bb_lower'].setData(data.map(d => ({ time: d.time, value: d.lower })));

    this.indicatorSeries['bb_fill'] = this.mainChart.addSeries(LightweightCharts.AreaSeries, {
      topColor: 'rgba(123, 31, 162, 0.4)',
      bottomColor: 'rgba(123, 31, 162, 0.05)',
      lineColor: 'transparent',
      lineWidth: 0,
      lastValueVisible: false,
      priceLineVisible: false,
      autoscaleInfoProvider: () => null,
    });
    this.indicatorSeries['bb_fill'].setData(data.map(d => ({ time: d.time, value: d.upper })));
    this.indicatorSeries['bb_fill_erase'] = this.mainChart.addSeries(LightweightCharts.AreaSeries, {
      topColor: '#131722',
      bottomColor: '#131722',
      lineColor: 'transparent',
      lineWidth: 0,
      lastValueVisible: false,
      priceLineVisible: false,
      autoscaleInfoProvider: () => null,
    });
    this.indicatorSeries['bb_fill_erase'].setData(data.map(d => ({ time: d.time, value: d.lower })));
  }

  _updateWatermark() {
    if (this.mainChart) {
      this.mainChart.applyOptions({
        watermark: { text: this.symbol || '' }
      });
    }
  }

  _detectCrossovers(fastData, slowData) {
    const markers = [];
    const minLen = Math.min(fastData.length, slowData.length);
    for (let i = 1; i < minLen; i++) {
      const prevF = fastData[i - 1].value, prevS = slowData[i - 1].value;
      const curF = fastData[i].value, curS = slowData[i].value;
      if (prevF <= prevS && curF > curS) {
        markers.push({ time: fastData[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26a69a', text: '' });
      } else if (prevF >= prevS && curF < curS) {
        markers.push({ time: fastData[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#ef5350', text: '' });
      }
    }
    return markers;
  }

  _renderCrossMarkers() {
    let markers = [];
    if (this.indicatorsState.ichimoku && this.ohlcData.length >= 52) {
      const ichi = Indicators.ichimoku(this.ohlcData);
      if (ichi) markers.push(...this._detectCrossovers(ichi.tenkan, ichi.kijun));
    }
    if (this.indicatorsState.ema50 && this.indicatorsState.ema200 && this.ohlcData.length >= 200) {
      const ema50 = Indicators.ema(this.ohlcData, 50);
      const ema200 = Indicators.ema(this.ohlcData, 200);
      markers.push(...this._detectCrossovers(ema50, ema200));
    }
    if (this.ichimokuCloud && this.ichimokuCloud.length > 0) {
      for (let i = 1; i < this.ichimokuCloud.length; i++) {
        const prev = this.ichimokuCloud[i - 1], cur = this.ichimokuCloud[i];
        if (prev.isGreen !== cur.isGreen) {
          markers.push({
            time: cur.time,
            position: cur.isGreen ? 'belowBar' : 'aboveBar',
            shape: cur.isGreen ? 'arrowUp' : 'arrowDown',
            color: cur.isGreen ? '#26a69a' : '#ef5350',
            text: cur.isGreen ? 'KUMO↑' : 'KUMO↓',
          });
        }
      }
    }
    this.candleSeries.setMarkers(markers);
  }

  _renderIchimoku() {
    const ichi = Indicators.ichimoku(this.ohlcData);
    if (!ichi) return;

    const cloud = ichi.cloud || [];
    this.ichimokuCloud = cloud;

    const bgColor = '#131722';

    if (cloud.length >= 2) {
      const segments = [];
      let cur = null;
      for (const c of cloud) {
        if (!cur || cur.isGreen !== c.isGreen) {
          cur = { isGreen: c.isGreen, points: [] };
          segments.push(cur);
        }
        cur.points.push(c);
      }

      segments.forEach((seg, idx) => {
        const color = seg.isGreen
          ? 'rgba(38, 166, 154, 0.35)'
          : 'rgba(239, 83, 80, 0.35)';

        const fillKey = 'ichimoku_cf_' + idx;
        const eraseKey = 'ichimoku_ce_' + idx;

        this.indicatorSeries[fillKey] = this.mainChart.addSeries(LightweightCharts.AreaSeries, {
          topColor: color,
          bottomColor: color,
          lineColor: 'transparent',
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          autoscaleInfoProvider: () => null,
        });
        this.indicatorSeries[fillKey].setData(seg.points.map(p => ({ time: p.time, value: p.top })));

        this.indicatorSeries[eraseKey] = this.mainChart.addSeries(LightweightCharts.AreaSeries, {
          topColor: bgColor,
          bottomColor: bgColor,
          lineColor: 'transparent',
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          autoscaleInfoProvider: () => null,
        });
        this.indicatorSeries[eraseKey].setData(seg.points.map(p => ({ time: p.time, value: p.bottom })));
      });
    }

    this.indicatorSeries['ichimoku_spanA'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      lastValueVisible: false,
      autoscaleInfoProvider: () => null,
    });
    this.indicatorSeries['ichimoku_spanB'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF5722',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      lastValueVisible: false,
      autoscaleInfoProvider: () => null,
    });
    this.indicatorSeries['ichimoku_tenkan'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF4500',
      lineWidth: 2,
      lastValueVisible: false,
    });
    this.indicatorSeries['ichimoku_kijun'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#80FFAA',
      lineWidth: 2,
      lastValueVisible: false,
    });
    this.indicatorSeries['ichimoku_chikou'] = this.mainChart.addSeries(LightweightCharts.LineSeries, {
      color: '#FFD700',
      lineWidth: 3,
      lastValueVisible: false,
      autoscaleInfoProvider: () => null,
    });

    this.indicatorSeries['ichimoku_spanA'].setData(ichi.spanA);
    this.indicatorSeries['ichimoku_spanB'].setData(ichi.spanB);
    this.indicatorSeries['ichimoku_tenkan'].setData(ichi.tenkan);
    this.indicatorSeries['ichimoku_kijun'].setData(ichi.kijun);
    this.indicatorSeries['ichimoku_chikou'].setData(ichi.chikou);
  }

  _renderRSI() {
    const data = Indicators.rsi(this.ohlcData, 14);
    if (data.length === 0) return;

    const sub = this._createSubChart(80);
    this.subCharts['rsi'] = sub;

    const rsiSeries = sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF9800',
      lineWidth: 1,
      lastValueVisible: false,
    });
    rsiSeries.setData(data);
    this.indicatorSeries['rsi'] = rsiSeries;

    sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    }).setData(data.map(d => ({ time: d.time, value: 70 })));

    sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#F44336',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    }).setData(data.map(d => ({ time: d.time, value: 30 })));

    sub.chart.timeScale().fitContent();
  }

  _renderRSI_EMA() {
    const rsiData = Indicators.rsi(this.ohlcData, 14);
    if (rsiData.length < 60) return;

    const emaData = Indicators.ema(rsiData.map(d => ({ time: d.time, close: d.value })), 50);
    if (emaData.length === 0) return;

    const sub = this._createSubChart(120);
    this.subCharts['rsi_ema'] = sub;

    const rsiSeries = sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#FF9800',
      lineWidth: 1,
      lastValueVisible: false,
    });
    rsiSeries.setData(rsiData);
    this.indicatorSeries['rsi_ema_rsi'] = rsiSeries;

    const emaSeries = sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
      lastValueVisible: false,
    });
    emaSeries.setData(emaData);
    this.indicatorSeries['rsi_ema_ema'] = emaSeries;

    sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    }).setData(rsiData.map(d => ({ time: d.time, value: 70 })));

    sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#F44336',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    }).setData(rsiData.map(d => ({ time: d.time, value: 30 })));

    const markers = [];
    const minLen = Math.min(rsiData.length, emaData.length);
    for (let i = 1; i < minLen; i++) {
      const r = rsiData[i].value;
      const e = emaData[i].value;
      const rPrev = rsiData[i - 1].value;
      const ePrev = emaData[i - 1].value;
      if (rPrev <= ePrev && r > e) {
        markers.push({ time: rsiData[i].time, position: 'belowBar', color: '#4CAF50', shape: 'arrowUp', size: 1 });
      } else if (rPrev >= ePrev && r < e) {
        markers.push({ time: rsiData[i].time, position: 'aboveBar', color: '#F44336', shape: 'arrowDown', size: 1 });
      }
    }
    if (markers.length > 0) rsiSeries.setMarkers(markers);

    sub.chart.timeScale().fitContent();
  }

  _renderMACD() {
    if (this.ohlcData.length < 35) return;
    const { macdLine, signalLine, histogram } = Indicators.macd(this.ohlcData, 12, 26, 9);

    const sub = this._createSubChart(100);
    this.subCharts['macd'] = sub;

    const macdSeries = sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#2196F3',
      lineWidth: 1,
      lastValueVisible: false,
    });
    macdSeries.setData(macdLine);
    this.indicatorSeries['macd_line'] = macdSeries;

    const signalSeries = sub.chart.addSeries(LightweightCharts.LineSeries, {
      color: '#F44336',
      lineWidth: 1,
      lastValueVisible: false,
    });
    signalSeries.setData(signalLine);
    this.indicatorSeries['macd_signal'] = signalSeries;

    const histSeries = sub.chart.addSeries(LightweightCharts.HistogramSeries, {
      color: '#9C27B0',
      lastValueVisible: false,
    });
    histSeries.setData(histogram.map(h => ({
      time: h.time,
      value: h.value,
      color: h.value >= 0 ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)'
    })));
    this.indicatorSeries['macd_hist'] = histSeries;

    sub.chart.timeScale().fitContent();
  }

  _renderVolume() {
    const data = Indicators.volume(this.ohlcData);
    if (data.length === 0) return;

    const sub = this._createSubChart(120);
    this.subCharts['volume'] = sub;

    this.indicatorSeries['volume'] = sub.chart.addSeries(LightweightCharts.HistogramSeries, {
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
    });
    this.indicatorSeries['volume'].setData(data.map(d => ({
      time: d.time,
      value: d.value,
      color: d.color,
    })));

    sub.chart.timeScale().fitContent();
  }

  fitContent() {
    if (this.mainChart) {
      this.mainChart.timeScale().fitContent();
    }
  }

  toggleLogScale() {
    if (!this.mainChart) return;
    const isLog = this.btnLogScale.dataset.log === 'true';
    const newMode = isLog
      ? LightweightCharts.PriceScaleMode.Normal
      : LightweightCharts.PriceScaleMode.Logarithmic;
    this.mainChart.priceScale('right').applyOptions({ mode: newMode });
    this.btnLogScale.dataset.log = String(!isLog);
    this.btnLogScale.style.color = isLog ? '' : '#2962FF';
  }

  setChartType(type) {
    if (!this.mainChart || !this.ohlcData.length) return;
    this.chartType = type;
    if (this.candleSeries) {
      this.mainChart.removeSeries(this.candleSeries);
    }
    this._recreateCandleSeries();
    this.chartTypeBar.querySelectorAll('.ct-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    this.mainChart.timeScale().fitContent();
  }

  _recreateCandleSeries() {
    if (!this.mainChart || !this.ohlcData || this.ohlcData.length === 0) return;
    const type = this.chartType || 'candles';
    const seriesMap = {
      candles: LightweightCharts.CandlestickSeries,
      bar: LightweightCharts.BarSeries,
      line: LightweightCharts.LineSeries,
      area: LightweightCharts.AreaSeries,
    };
    const optsMap = {
      candles: { upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350' },
      bar: { upColor: '#26a69a', downColor: '#ef5350' },
      line: { color: '#2962FF', lineWidth: 2 },
      area: { topColor: 'rgba(41,98,255,0.3)', bottomColor: 'rgba(41,98,255,0.05)', lineColor: '#2962FF', lineWidth: 2 },
    };
    const dataMap = {
      candles: d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }),
      bar: d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }),
      line: d => ({ time: d.time, value: d.close }),
      area: d => ({ time: d.time, value: d.close }),
    };
    this.candleSeries = this.mainChart.addSeries(seriesMap[type], optsMap[type]);
    this.candleSeries.setData(this.ohlcData.map(dataMap[type]));
  }

  resize() {
    this._doResize();
  }
}
