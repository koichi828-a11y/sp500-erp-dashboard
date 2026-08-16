/**
 * charts.js
 *
 * Plotly.js chart configuration and rendering for the ERP dashboard.
 * Creates three vertically-stacked charts:
 *   1. S&P 500 price (log scale)
 *   2. Earnings Yield vs 10Y Treasury Yield
 *   3. Equity Risk Premium with historical event highlights
 */

// ============================================
// Historical events (for shaded rectangles)
// ============================================

const HISTORICAL_EVENTS = [
  {
    name: 'Black Monday (1987)',
    x0: '1987-01-01',
    x1: '1987-12-31',
    color: 'rgba(139, 92, 246, 0.15)',
    lineColor: 'rgba(139, 92, 246, 0.4)',
  },
  {
    name: 'Dot-com Bubble (1999-2001)',
    x0: '1999-01-01',
    x1: '2001-12-31',
    color: 'rgba(148, 163, 184, 0.12)',
    lineColor: 'rgba(148, 163, 184, 0.3)',
  },
  {
    name: 'Financial Crisis (2007-2009)',
    x0: '2007-12-01',
    x1: '2009-06-30',
    color: 'rgba(16, 185, 129, 0.12)',
    lineColor: 'rgba(16, 185, 129, 0.3)',
  },
  {
    name: 'COVID Shock (2020)',
    x0: '2020-02-01',
    x1: '2020-05-31',
    color: 'rgba(59, 130, 246, 0.12)',
    lineColor: 'rgba(59, 130, 246, 0.3)',
  },
  {
    name: 'Tightening Cycle (2022-)',
    x0: '2022-01-01',
    x1: '2026-12-31',
    color: 'rgba(249, 115, 22, 0.10)',
    lineColor: 'rgba(249, 115, 22, 0.25)',
  },
];

// ============================================
// Common layout / config
// ============================================

const DARK_THEME = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'rgba(10, 14, 23, 0.3)',
  font: {
    family: "'Inter', system-ui, sans-serif",
    color: '#94a3b8',
    size: 12,
  },
  xaxis: {
    gridcolor: 'rgba(255,255,255,0.04)',
    linecolor: 'rgba(255,255,255,0.08)',
    tickfont: { color: '#64748b', size: 11 },
    zeroline: false,
    showspikes: true,
    spikecolor: 'rgba(59,130,246,0.3)',
    spikethickness: 1,
    spikedash: 'dot',
    spikemode: 'across',
  },
  yaxis: {
    gridcolor: 'rgba(255,255,255,0.04)',
    linecolor: 'rgba(255,255,255,0.08)',
    tickfont: { color: '#64748b', size: 11 },
    zeroline: false,
  },
  margin: { l: 56, r: 20, t: 8, b: 36 },
  hoverlabel: {
    bgcolor: '#1e293b',
    bordercolor: '#334155',
    font: { color: '#e2e8f0', family: "'Inter', sans-serif", size: 12 },
  },
  hovermode: 'x unified',
  showlegend: true,
  legend: {
    bgcolor: 'rgba(15,23,42,0.6)',
    bordercolor: 'rgba(255,255,255,0.06)',
    borderwidth: 1,
    font: { color: '#94a3b8', size: 11 },
    x: 0.01,
    y: 0.99,
    xanchor: 'left',
    yanchor: 'top',
  },
};

const CHART_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  displaylogo: false,
  toImageButtonOptions: {
    format: 'png',
    filename: 'sp500_erp_chart',
    height: 600,
    width: 1200,
    scale: 2,
  },
};

/**
 * Create event shapes for a chart.
 */
function createEventShapes(showEvents) {
  if (!showEvents) return [];

  return HISTORICAL_EVENTS.map((ev) => ({
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: ev.x0,
    x1: ev.x1,
    y0: 0,
    y1: 1,
    fillcolor: ev.color,
    line: { color: ev.lineColor, width: 0.5 },
    layer: 'below',
  }));
}

/**
 * Create event annotations.
 */
function createEventAnnotations(showEvents) {
  if (!showEvents) return [];

  return HISTORICAL_EVENTS.map((ev) => {
    const midDate = new Date((new Date(ev.x0).getTime() + new Date(ev.x1).getTime()) / 2);
    return {
      x: midDate.toISOString().split('T')[0],
      y: 1,
      xref: 'x',
      yref: 'paper',
      text: ev.name,
      showarrow: false,
      font: { size: 9, color: '#64748b' },
      yanchor: 'bottom',
      yshift: 4,
    };
  });
}

// ============================================
// Chart 1: S&P 500 Price (Log Scale)
// ============================================

export function renderPriceChart(containerId, data, showEvents) {
  const dates = data.map((d) => d.date);
  const prices = data.map((d) => d.price);

  const trace = {
    x: dates,
    y: prices,
    type: 'scatter',
    mode: 'lines',
    name: 'S&P 500',
    line: { color: '#3b82f6', width: 1.5, shape: 'spline', smoothing: 0.5 },
    hovertemplate: '%{x|%Y-%m}<br>$%{y:,.0f}<extra></extra>',
  };

  const layout = {
    ...DARK_THEME,
    yaxis: {
      ...DARK_THEME.yaxis,
      type: 'log',
      title: { text: 'Price (USD)', font: { size: 11, color: '#64748b' }, standoff: 8 },
    },
    shapes: createEventShapes(showEvents),
    annotations: createEventAnnotations(showEvents),
    showlegend: false,
  };

  Plotly.react(containerId, [trace], layout, CHART_CONFIG);
}

// ============================================
// Chart 2: Earnings Yield vs 10Y Treasury
// ============================================

export function renderYieldsChart(containerId, data, showEvents) {
  const dates = data.map((d) => d.date);

  const traceEY = {
    x: dates,
    y: data.map((d) => d.earningsYield),
    type: 'scatter',
    mode: 'lines',
    name: '益回り (Earnings Yield)',
    line: { color: '#10b981', width: 1.5 },
    hovertemplate: '%{y:.2f}%<extra>益回り</extra>',
  };

  const traceGS10 = {
    x: dates,
    y: data.map((d) => d.gs10),
    type: 'scatter',
    mode: 'lines',
    name: '10年国債利回り',
    line: { color: '#ef4444', width: 1.5 },
    hovertemplate: '%{y:.2f}%<extra>10年債</extra>',
  };

  const layout = {
    ...DARK_THEME,
    yaxis: {
      ...DARK_THEME.yaxis,
      title: { text: 'Yield (%)', font: { size: 11, color: '#64748b' }, standoff: 8 },
    },
    shapes: createEventShapes(showEvents),
    legend: {
      ...DARK_THEME.legend,
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: 1.02,
      yanchor: 'bottom',
    },
  };

  Plotly.react(containerId, [traceEY, traceGS10], layout, CHART_CONFIG);
}

// ============================================
// Chart 3: Equity Risk Premium
// ============================================

export function renderERPChart(containerId, data, showEvents, stats) {
  const dates = data.map((d) => d.date);
  const erpValues = data.map((d) => d.erp);

  // Main ERP trace
  const traceERP = {
    x: dates,
    y: erpValues,
    type: 'scatter',
    mode: 'lines',
    name: 'Equity Risk Premium',
    line: { color: '#3b82f6', width: 1.8 },
    hovertemplate: '%{x|%Y-%m-%d}<br>ERP: %{y:.2f}%<extra></extra>',
  };

  // Historical mean line
  const meanValue = stats?.erp?.mean ?? 3;
  const traceMean = {
    x: [dates[0], dates[dates.length - 1]],
    y: [meanValue, meanValue],
    type: 'scatter',
    mode: 'lines',
    name: `歴史的平均 (${meanValue.toFixed(1)}%)`,
    line: { color: '#8b5cf6', width: 1, dash: 'dot' },
    hoverinfo: 'skip',
  };

  // Shapes: zero line + red zone below zero + event rectangles
  const shapes = [
    // Prominent zero line
    {
      type: 'line',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 0,
      line: { color: '#ef4444', width: 2, dash: 'dash' },
    },
    // Red danger zone below zero
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: -15,
      y1: 0,
      fillcolor: 'rgba(239, 68, 68, 0.04)',
      line: { width: 0 },
      layer: 'below',
    },
    ...createEventShapes(showEvents),
  ];

  // Zero line annotation
  const annotations = [
    {
      x: 1.0,
      y: 0,
      xref: 'paper',
      yref: 'y',
      text: 'Zero Premium ▶',
      showarrow: false,
      font: { size: 10, color: '#ef4444' },
      xanchor: 'right',
      yshift: -12,
    },
    ...createEventAnnotations(showEvents),
  ];

  const layout = {
    ...DARK_THEME,
    yaxis: {
      ...DARK_THEME.yaxis,
      title: { text: 'Risk Premium (%)', font: { size: 11, color: '#64748b' }, standoff: 8 },
    },
    shapes,
    annotations,
    legend: {
      ...DARK_THEME.legend,
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: 1.02,
      yanchor: 'bottom',
    },
  };

  Plotly.react(containerId, [traceERP, traceMean], layout, CHART_CONFIG);
}

// ============================================
// Update all charts (called by main.js)
// ============================================

export function renderAllCharts(allData, startYear, showEvents, stats) {
  // Filter data by start year
  const startDate = `${startYear}-01-01`;
  const filtered = allData.filter((d) => d.date >= startDate);

  if (filtered.length === 0) return;

  renderPriceChart('chartPrice', filtered, showEvents);
  renderYieldsChart('chartYields', filtered, showEvents);
  renderERPChart('chartERP', filtered, showEvents, stats);
}
