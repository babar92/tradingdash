class GridManager {
  constructor(container) {
    this.container = container;
    this.count = 1;
    this.layouts = {
      1: { cols: 1, rows: 1 },
      2: { cols: 2, rows: 1 },
      4: { cols: 2, rows: 2 },
      6: { cols: 2, rows: 3 },
      8: { cols: 2, rows: 4 },
    };
  }

  apply(count) {
    this.count = count;
    const layout = this.layouts[count] || this.layouts[1];
    this.container.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
    this.container.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;

    const panes = this.container.querySelectorAll('.pane');
    panes.forEach((pane, i) => {
      pane.style.display = i < count ? 'flex' : 'none';
    });

    return layout;
  }

  getVisiblePanes() {
    return this.container.querySelectorAll('.pane:not([style*="display: none"])');
  }
}
