class DrawingsManager {
  constructor(pane) {
    this.pane = pane;
    this.chart = pane.mainChart;
    this.drawings = [];
    this.activeTool = 'pointer';
    this.color = '#FFD700';
    this.tempPoints = [];
    this.dragIdx = -1;
    this._createCanvas();
    this._createToolbar();
    this._bindEvents();
  }

  _createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'drawings-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '5';
    this.ctx = this.canvas.getContext('2d');
    this.pane.chartArea.style.position = 'relative';
    this.pane.chartArea.appendChild(this.canvas);
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this.pane.chartArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'drawings-toolbar';

    const tools = [
      { id: 'pointer', label: '🖱', title: 'Pointer' },
      { id: 'trend', label: '↗', title: 'Trend Line' },
      { id: 'regression', label: '📊', title: 'Regression' },
      { id: 'fib_retrace', label: 'Fibo', title: 'Fib Retracement' },
      { id: 'fib_ext', label: 'Fib+', title: 'Fib Extension' },
    ];

    tools.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'drawing-tool-btn' + (t.id === 'pointer' ? ' active' : '');
      btn.textContent = t.label;
      btn.title = t.title;
      btn.dataset.tool = t.id;
      btn.addEventListener('click', () => this.setTool(t.id));
      this.toolbar.appendChild(btn);
    });

    const sep = document.createElement('span');
    sep.className = 'drawing-sep';
    this.toolbar.appendChild(sep);

    this.colorInput = document.createElement('input');
    this.colorInput.type = 'color';
    this.colorInput.className = 'drawing-color';
    this.colorInput.value = '#FFD700';
    this.colorInput.addEventListener('input', () => { this.color = this.colorInput.value; });
    this.toolbar.appendChild(this.colorInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'drawing-tool-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Clear all drawings';
    delBtn.addEventListener('click', () => {
      this.drawings = [];
      this.render();
    });
    this.toolbar.appendChild(delBtn);

    this.pane.header.appendChild(this.toolbar);
  }

  setTool(toolId) {
    this.activeTool = toolId;
    this.tempPoints = [];
    this.canvas.style.pointerEvents = toolId === 'pointer' ? 'none' : 'auto';
    this.canvas.style.cursor = toolId === 'pointer' ? 'default' : 'crosshair';
    this.toolbar.querySelectorAll('.drawing-tool-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === toolId)
    );
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    this.canvas.addEventListener('dblclick', e => this._onDblClick(e));
    this._onResize = () => { this._resizeCanvas(); this.render(); };
    window.addEventListener('resize', this._onResize);
    if (this.pane.mainChart) {
      this.pane.mainChart.timeScale().subscribeVisibleTimeRangeChange(() => this.render());
      this.pane.mainChart.subscribeCrosshairMove(() => this.render());
    }
  }

  _getChartCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = this.chart.timeScale().coordinateToTime(x);
    const price = this.chart.priceScale('right').coordinateToPrice(y);
    return { x, y, time, price };
  }

  _toPixel(d) {
    const x = this.chart.timeScale().timeToCoordinate(d.time);
    const y = this.chart.priceScale('right').priceToCoordinate(d.price);
    return { x, y };
  }

  _onMouseDown(e) {
    if (this.activeTool === 'pointer') return;
    const pt = this._getChartCoords(e);
    if (!pt.time || pt.price == null) return;
    this.tempPoints.push({ time: pt.time, price: pt.price });
    if (this.activeTool === 'trend' || this.activeTool === 'regression') {
      if (this.tempPoints.length === 2) {
        this._finalizeDrawing();
      }
    } else if (this.activeTool === 'fib_retrace' || this.activeTool === 'fib_ext') {
      if (this.tempPoints.length === 2) {
        this._finalizeDrawing();
      }
    }
  }

  _onMouseMove(e) {
    if (this.activeTool === 'pointer') return;
    if (this.tempPoints.length === 0) return;
    const pt = this._getChartCoords(e);
    if (!pt.time || pt.price == null) return;
    this.tempPoints[this.tempPoints.length - 1] = { time: pt.time, price: pt.price };
    this.render();
  }

  _onMouseUp(e) {}

  _onDblClick(e) {
    if (this.activeTool === 'pointer') return;
    this.tempPoints = [];
    this.render();
  }

  _finalizeDrawing() {
    if (this.tempPoints.length < 2) return;
    const p1 = this.tempPoints[0];
    const p2 = this.tempPoints[1];
    this.drawings.push({
      id: Date.now() + Math.random(),
      type: this.activeTool,
      points: [{ time: p1.time, price: p1.price }, { time: p2.time, price: p2.price }],
      options: { color: this.color, lineWidth: 2 },
    });
    this.tempPoints = [];
    this.render();
  }

  removeAll() {
    this.drawings = [];
    this.tempPoints = [];
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    for (const d of this.drawings) {
      this._drawDrawing(ctx, d);
    }

    if (this.tempPoints.length > 0) {
      const temp = { type: this.activeTool, points: this.tempPoints, options: { color: this.color, lineWidth: 2, temp: true } };
      this._drawDrawing(ctx, temp);
    }
  }

  _drawDrawing(ctx, d) {
    const pts = d.points;
    if (pts.length < 2) return;

    const p1 = this._toPixel(pts[0]);
    const p2 = this._toPixel(pts[1]);
    if (p1.x == null || p2.x == null || p1.y == null || p2.y == null) return;

    ctx.strokeStyle = d.options.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    switch (d.type) {
      case 'trend': this._drawTrendLine(ctx, p1, p2, d); break;
      case 'regression': this._drawRegression(ctx, pts, d); break;
      case 'fib_retrace': this._drawFibRetrace(ctx, pts, d); break;
      case 'fib_ext': this._drawFibExt(ctx, pts, d); break;
    }
  }

  _drawTrendLine(ctx, p1, p2, d) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    this._drawHandle(ctx, p1.x, p1.y, d.options.color);
    this._drawHandle(ctx, p2.x, p2.y, d.options.color);
  }

  _drawRegression(ctx, pts, d) {
    const n = pts.length;
    if (n < 2) return;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const p = this._toPixel(pts[i]);
      sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const canvas = this.canvas;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const x1 = 0, y1 = slope * x1 + intercept;
    const x2 = w, y2 = slope * x2 + intercept;

    const residuals = pts.map(p => { const px = this._toPixel(p).x; return this._toPixel(p).y - (slope * px + intercept); });
    const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);
    const top = y1 - 2 * stdDev, top2 = y2 - 2 * stdDev;
    const bot = y1 + 2 * stdDev, bot2 = y2 + 2 * stdDev;

    ctx.save();
    ctx.fillStyle = d.options.color + '20';
    ctx.beginPath();
    ctx.moveTo(x1, top);
    ctx.lineTo(x2, top2);
    ctx.lineTo(x2, bot2);
    ctx.lineTo(x1, bot);
    ctx.closePath();
    ctx.fill();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = d.options.color + '60';
    ctx.beginPath();
    ctx.moveTo(x1, top); ctx.lineTo(x2, top2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, bot); ctx.lineTo(x2, bot2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = d.options.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    this._drawHandle(ctx, this._toPixel(pts[0]).x, this._toPixel(pts[0]).y, d.options.color);
    this._drawHandle(ctx, this._toPixel(pts[n - 1]).x, this._toPixel(pts[n - 1]).y, d.options.color);
  }

  _drawFibRetrace(ctx, pts, d) {
    const p1 = this._toPixel(pts[0]);
    const p2 = this._toPixel(pts[1]);
    const levels = [0, 23.6, 38.2, 50, 61.8, 100];
    const yStart = p1.y, yEnd = p2.y;
    const range = yEnd - yStart;

    levels.forEach(level => {
      const y = yStart + range * (1 - level / 100);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width / (window.devicePixelRatio || 1), y);
      ctx.strokeStyle = d.options.color;
      ctx.lineWidth = 1;
      ctx.setLineDash(level === 50 ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = d.options.color;
      ctx.font = '11px sans-serif';
      ctx.fillText(level + '%', 4, y - 4);
    });

    this._drawHandle(ctx, p1.x, p1.y, d.options.color);
    this._drawHandle(ctx, p2.x, p2.y, d.options.color);
  }

  _drawFibExt(ctx, pts, d) {
    const p1 = this._toPixel(pts[0]);
    const p2 = this._toPixel(pts[1]);
    const levels = [0, 100, 127.2, 161.8, 261.8, 423.6];
    const range = p2.y - p1.y;

    levels.forEach(level => {
      const y = p2.y + range * (1 - level / 100);
      const w = this.canvas.width / (window.devicePixelRatio || 1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = d.options.color;
      ctx.lineWidth = 1;
      ctx.setLineDash(level === 0 || level === 100 ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = d.options.color;
      ctx.font = '11px sans-serif';
      ctx.fillText(level + '%', 4, y - 4);
    });

    this._drawHandle(ctx, p1.x, p1.y, d.options.color);
    this._drawHandle(ctx, p2.x, p2.y, d.options.color);
  }

  _drawHandle(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.toolbar && this.toolbar.parentNode) this.toolbar.parentNode.removeChild(this.toolbar);
  }
}
