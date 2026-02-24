const ReagentsScanner = {
    isInit: false,
    chartObserver: null,

    init: function() {
        if (this.isInit) return;
        this.injectStyles();
        this.createModal();
        this.isInit = true;
        this.render();
        console.log("🧪 Reagents Scanner Initialized (Smooth Charts & Tier Icons Scaled)");
    },

    injectStyles: function() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* ... (SAME STYLES) ... */
            .prof-grid-wrapper { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 0 20px 40px 20px; align-items: start; }
            .prof-section { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #151515; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; flex-direction: column; }
            .prof-header { padding: 12px; font-size: 16px; letter-spacing: 1px; text-shadow: 0 2px 2px rgba(0,0,0,0.5); text-align: center; text-transform: uppercase; font-weight: bold; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .reagent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; padding: 12px; grid-auto-flow: dense; }
            .reagent-card { background: #222; border: 1px solid #333; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 12px; transition: transform 0.2s, background 0.2s; position: relative; overflow: hidden; flex-direction: row; min-height: 50px; cursor: pointer; }
            .reagent-card:hover { transform: translateY(-2px); border-color: #666; }
            
            .card-huge { grid-column: span 2; background: linear-gradient(90deg, #2a2a2a 0%, #222 100%); border-left: 4px solid var(--gold); padding: 12px 16px; min-height: 64px; }
            .card-huge .r-icon { width: 48px; height: 48px; border: 1px solid var(--gold); }
            .card-huge .r-name { font-size: 18px; font-weight: bold; color: #fff; }
            .card-huge .r-price { font-size: 22px; color: var(--gold); }

            .card-large { grid-column: span 1; background: #262626; border-left: 3px solid #666; padding: 10px 14px; min-height: 54px; }
            .card-large .r-icon { width: 40px; height: 40px; border: 1px solid #555; }
            .card-large .r-name { font-size: 15px; font-weight: bold; color: #ddd; }
            .card-large .r-price { font-size: 16px; color: #eee; }

            .card-normal { grid-column: span 1; border-left: 2px solid #333; padding: 8px 10px; min-height: 44px; }
            .card-normal .r-icon { width: 30px; height: 30px; border: 1px solid #444; }
            .card-normal .r-name { font-size: 12px; color: #aaa; }
            .card-normal .r-price { font-size: 13px; color: #ccc; }

            .r-icon-wrapper { position: relative; z-index: 2; padding: 2px; }
            .r-icon { border-radius: 4px; object-fit: cover; display: block; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
            .r-info { display: flex; flex-direction: column; justify-content: center; width: 100%; overflow: hidden; line-height: 1.2; position: relative; z-index: 2; text-shadow: 0 2px 4px rgba(0,0,0,0.9); }
            .r-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; display: flex; align-items: center; } /* For icon */
            .r-price { font-family: 'Segoe UI', sans-serif; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
            .chart-bg { position: absolute; bottom: -5px; left: 0; width: 100%; height: 70%; z-index: 0; opacity: 0.3; pointer-events: none; }

            .trend-val { font-size: 0.85em; font-weight: bold; display: flex; align-items: center; gap: 2px; opacity: 0.9; }
            .trend-up { color: var(--green); }
            .trend-down { color: #ff4444; }
            .trend-neutral { color: #666; }

            /* --- UPDATED SCALABLE ICON --- */
            .q-icon { 
                width: 1.1em; 
                height: 1.1em; 
                margin-left: 4px; 
                vertical-align: -0.2em; /* Centers relative to text baseline */
            }

            @keyframes modalFadeIn { from { opacity: 0; transform: translateY(-20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .modal-box { animation: modalFadeIn 0.25s ease-out forwards; }
            .detail-layout { display: flex; gap: 25px; height: 450px; }
            .detail-left { flex: 3; background: #111; border: 1px solid #333; border-radius: 8px; padding: 20px; position: relative; display: flex; flex-direction: column; }
            .detail-right { flex: 1; background: #181818; border: 1px solid #333; border-radius: 8px; padding: 0; overflow-y: auto; display:flex; flex-direction:column; }
            .chart-wrapper { flex-grow: 1; position: relative; cursor: crosshair; margin-top: 15px; width: 100%; min-height: 200px; }
            
            .chart-tooltip { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.9); border: 1px solid #444; padding: 10px; border-radius: 6px; pointer-events: none; font-size: 12px; color: #fff; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.5); min-width: 120px; opacity: 0; transition: opacity 0.25s ease-in-out; }
            .chart-cursor { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.3); pointer-events: none; display: none; z-index: 50; }
            .history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .history-table th { background: #222; padding: 8px 10px; text-align: left; color: #888; font-size: 11px; text-transform: uppercase; position: sticky; top: 0; border-bottom: 2px solid #333; }
            .history-table td { padding: 6px 10px; border-bottom: 1px solid #2a2a2a; color: #ccc; }
            .history-table tr:hover { background: #222; }
            .qty-col { color: var(--blue); font-weight: bold; text-align:right; }
            .chart-legend { display: flex; gap: 15px; position: absolute; top: 20px; right: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .legend-item { display: flex; align-items: center; gap: 5px; }
            .dot-price { width: 8px; height: 8px; background: #0070dd; border-radius: 50%; }
            .dot-qty { width: 8px; height: 8px; background: #ff8800; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    },

    createModal: function() {
        const modalHtml = `
            <div id="reagent-detail-modal" class="modal-overlay" onclick="if(event.target===this) ReagentsScanner.closeModal()">
                <div class="modal-box" style="width: 1200px; max-width: 95vw;">
                    <span class="close-modal" onclick="ReagentsScanner.closeModal()">×</span>
                    <div id="detail-header" style="display:flex; align-items:center; gap:15px; margin-bottom:25px; border-bottom:1px solid #333; padding-bottom:15px;"></div>
                    <div class="detail-layout">
                        <div class="detail-left">
                            <div style="font-size:14px; color:#888; text-transform:uppercase; margin-bottom:5px;">Market History (14 Days)</div>
                            <div class="chart-legend">
                                <div class="legend-item" style="color:#0070dd"><div class="dot-price"></div> Price</div>
                                <div class="legend-item" style="color:#ff8800"><div class="dot-qty"></div> Quantity</div>
                            </div>
                            <div id="interactive-chart" class="chart-wrapper"></div>
                        </div>
                        <div class="detail-right">
                            <div style="background:#222; padding:10px; border-bottom:1px solid #333; font-weight:bold; color:#fff; text-align:center; font-size:12px; text-transform:uppercase;">Current Lots (Top 10)</div>
                            <table class="history-table">
                                <thead><tr><th>Price</th><th style="text-align:right;">Qty</th></tr></thead>
                                <tbody id="lots-list"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    render: function() {
        const container = document.getElementById('reagents-content');
        if (!container || typeof REAGENTS_DB === 'undefined') return;

        let html = '<div class="prof-grid-wrapper">';

        for (const [profName, items] of Object.entries(REAGENTS_DB)) {
            const headerColor = (typeof PROF_COLORS !== 'undefined' && PROF_COLORS[profName]) 
                ? PROF_COLORS[profName] : 'linear-gradient(90deg, #333, #555)';

            html += `
                <div class="prof-section">
                    <div class="prof-header" style="background: ${headerColor};">${profName}</div>
                    <div class="reagent-grid">
            `;

            items.sort((a, b) => (parseInt(b.itemUsed)||0) - (parseInt(a.itemUsed)||0));

            items.forEach(item => {
                const count = parseInt(item.itemUsed) || 0;
                const dbData = PRICES[item.name] || { price: 0, icon: DEF_ICON };
                
                let cardClass = 'card-normal';
                if (count >= 20) cardClass = 'card-huge';
                else if (count >= 10) cardClass = 'card-large';

                const historyData = (typeof HISTORY !== 'undefined' && HISTORY[item.name]) ? HISTORY[item.name] : [];
                const svgChart = this.getSmoothSparklineSVG(historyData);
                const trendHtml = this.get24hChange(historyData, dbData.price);

                // --- TIER ICONS LOGIC ---
                let displayName = item.name;
                let tierHtml = '';
                const match = displayName.match(/ [tq]([1-3])/i);
                if (match) {
                    tierHtml = this.getQualityIcon(match[1]);
                    displayName = displayName.replace(match[0], '').trim();
                }

                html += `
                    <div class="reagent-card ${cardClass}" onclick="ReagentsScanner.openDetails('${item.name}')">
                        <div class="chart-bg">${svgChart}</div>
                        <div class="r-icon-wrapper">
                            <img src="${dbData.icon}" class="r-icon">
                        </div>
                        <div class="r-info">
                            <div class="r-name">${displayName} ${tierHtml}</div>
                            <div class="r-price">
                                ${this.formatPrice(dbData.price)}
                                ${trendHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`; 
        }
        html += '</div>'; 
        container.innerHTML = html;
    },

    getQualityIcon: function(tier) {
        if(!tier) return '';
        return `<img src="tier${tier}.png" class="q-icon">`;
    },

    get24hChange: function(history, currentPrice) {
        if (!history || history.length < 2) return '';
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        let oldPrice = null;
        for (let i = history.length - 1; i >= 0; i--) { if (history[i].t <= oneDayAgo) { oldPrice = history[i].p; break; } }
        if (oldPrice === null) oldPrice = history[0].p;
        const diffPercent = ((currentPrice - oldPrice) / oldPrice) * 100;
        const absPercent = Math.abs(diffPercent).toFixed(0); 
        if (diffPercent > 0.5) return `<span class="trend-val trend-up">▲${absPercent}%</span>`;
        else if (diffPercent < -0.5) return `<span class="trend-val trend-down">▼${absPercent}%</span>`;
        else return `<span class="trend-val trend-neutral">~0%</span>`;
    },

    openDetails: function(itemName) {
        const dbData = PRICES[itemName];
        const historyData = (typeof HISTORY !== 'undefined' && HISTORY[itemName]) ? HISTORY[itemName] : [];
        const lotsData = (typeof LOTS !== 'undefined' && LOTS[itemName]) ? LOTS[itemName] : [];
        
        // Tier Logic for Modal Title
        let displayName = itemName;
        let tierHtml = '';
        const match = displayName.match(/ [tq]([1-3])/i);
        if (match) {
            tierHtml = this.getQualityIcon(match[1]);
            displayName = displayName.replace(match[0], '').trim();
        }
        
        const header = document.getElementById('detail-header');
        header.innerHTML = `
            <img src="${dbData ? dbData.icon : DEF_ICON}" style="width:52px; height:52px; border-radius:6px; border:2px solid #555;">
            <div>
                <div style="font-size:26px; font-weight:bold; color:#fff; display:flex; align-items:center;">${displayName} ${tierHtml}</div>
                <div style="font-size:20px; color:var(--gold);">${this.formatPrice(dbData ? dbData.price : 0)}</div>
            </div>
        `;

        document.getElementById('reagent-detail-modal').style.display = 'flex';
        
        const chartContainer = document.getElementById('interactive-chart');
        chartContainer.innerHTML = '';
        if (this.chartObserver) this.chartObserver.disconnect();
        this.chartObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    this.renderInteractiveChart(historyData);
                    this.chartObserver.disconnect(); 
                }
            }
        });
        this.chartObserver.observe(chartContainer);
        setTimeout(() => { if (chartContainer.innerHTML === '') this.renderInteractiveChart(historyData); }, 100);

        const listBody = document.getElementById('lots-list');
        let listHtml = '';
        if (lotsData.length === 0) {
            listHtml = '<tr><td colspan="2" style="text-align:center; color:#666; padding:20px;">No active auctions found</td></tr>';
        } else {
            lotsData.forEach((lot) => {
                listHtml += `<tr><td style="color:#eee; font-weight:500;">${this.formatPrice(lot.p)}</td><td class="qty-col">${lot.q.toLocaleString()}</td></tr>`;
            });
        }
        listBody.innerHTML = listHtml;
    },

    closeModal: function() {
        document.getElementById('reagent-detail-modal').style.display = 'none';
        if (this.chartObserver) this.chartObserver.disconnect();
    },

    renderInteractiveChart: function(data) {
        const container = document.getElementById('interactive-chart');
        if (container.clientWidth === 0 || container.clientHeight === 0) return;

        if (!data || data.length < 2) { container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">Not enough history data</div>'; return; }

        let minP = Infinity, maxP = -Infinity;
        data.forEach(d => { if(d.p < minP) minP = d.p; if(d.p > maxP) maxP = d.p; });
        let padP = (maxP - minP) * 0.1; if(padP===0) padP = maxP*0.1 || 1;
        minP -= padP; maxP += padP;

        let minQ = Infinity, maxQ = -Infinity;
        data.forEach(d => { let q = d.q || 0; if(q < minQ) minQ = q; if(q > maxQ) maxQ = q; });
        let padQ = (maxQ - minQ) * 0.1; if(padQ===0) padQ = (maxQ*0.1) || 10;
        minQ -= padQ; maxQ += padQ; if (minQ < 0) minQ = 0;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const len = data.length - 1;

        const getX = (i) => (i / len) * width;
        const getY_Price = (p) => height - ((p - minP) / (maxP - minP)) * height;
        const getY_Qty = (q) => height - (((q || 0) - minQ) / (maxQ - minQ)) * height;

        // --- SMOOTH (BEZIER) CHART ---
        let pathP = `M 0 ${getY_Price(data[0].p)}`;
        for (let i = 1; i < data.length; i++) {
            const x = getX(i); const y = getY_Price(data[i].p);
            const x0 = getX(i-1); const y0 = getY_Price(data[i-1].p);
            const cp1x = x0 + (x - x0) / 2;
            pathP += ` C ${cp1x} ${y0}, ${cp1x} ${y}, ${x} ${y}`;
        }
        const fillP = pathP + ` L ${width} ${height} L 0 ${height} Z`;

        let pathQ = `M 0 ${getY_Qty(data[0].q)}`;
        for (let i = 1; i < data.length; i++) {
            const x = getX(i); const y = getY_Qty(data[i].q);
            const x0 = getX(i-1); const y0 = getY_Qty(data[i-1].q);
            const cp1x = x0 + (x - x0) / 2;
            pathQ += ` C ${cp1x} ${y0}, ${cp1x} ${y}, ${x} ${y}`;
        }
        const fillQ = pathQ + ` L ${width} ${height} L 0 ${height} Z`;

        container.innerHTML = `
            <div id="chart-tooltip" class="chart-tooltip"></div>
            <div id="chart-cursor" class="chart-cursor"></div>
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow:visible;">
                <defs>
                    <linearGradient id="gradP" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0070dd" stop-opacity="0.4"/><stop offset="100%" stop-color="#0070dd" stop-opacity="0"/></linearGradient>
                    <linearGradient id="gradQ" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ff8800" stop-opacity="0.2"/><stop offset="100%" stop-color="#ff8800" stop-opacity="0"/></linearGradient>
                </defs>
                <path d="${fillQ}" fill="url(#gradQ)" stroke="none" />
                <path d="${pathQ}" fill="none" stroke="#ff8800" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="4" />
                <path d="${fillP}" fill="url(#gradP)" stroke="none" />
                <path d="${pathP}" fill="none" stroke="#0070dd" stroke-width="3" vector-effect="non-scaling-stroke" />
            </svg>
        `;

        container.onmousemove = (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const index = Math.min(Math.max(Math.round((x / width) * len), 0), len);
            const point = data[index];
            if (!point) return;

            const cursor = document.getElementById('chart-cursor');
            const tooltip = document.getElementById('chart-tooltip');
            const exactX = getX(index);

            cursor.style.display = 'block';
            cursor.style.left = exactX + 'px';
            tooltip.style.opacity = '1';
            
            const date = new Date(point.t);
            tooltip.innerHTML = `
                <div style="color:#888; font-size:11px; margin-bottom:4px;">${date.toLocaleDateString()} ${date.getHours()}:00</div>
                <div style="display:flex; justify-content:space-between; gap:15px; margin-bottom:2px;">
                    <span style="color:#0070dd; font-weight:bold;">Price:</span>
                    <span style="color:#fff;">${point.p.toLocaleString()} g</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap:15px;">
                    <span style="color:#ff8800; font-weight:bold;">Supply:</span>
                    <span style="color:#fff;">${(point.q||0).toLocaleString()}</span>
                </div>
            `;
            if (x > width / 2) { tooltip.style.left = 'auto'; tooltip.style.right = (width - exactX + 15) + 'px'; } 
            else { tooltip.style.left = (exactX + 15) + 'px'; tooltip.style.right = 'auto'; }
        };

        container.onmouseleave = () => {
            document.getElementById('chart-cursor').style.display = 'none';
            document.getElementById('chart-tooltip').style.opacity = '0';
        };
    },

    getSmoothSparklineSVG: function(data) {
        if (!data || data.length < 2) return '';
        const w = 100, h = 50;
        let min = Infinity, max = -Infinity;
        data.forEach(d => { if(d.p < min) min = d.p; if(d.p > max) max = d.p; });
        if(min === max) { min -= 1; max += 1; }

        let path = `M 0 ${h - ((data[0].p - min) / (max - min)) * h}`;
        for (let i = 1; i < data.length; i++) {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((data[i].p - min) / (max - min)) * h;
            const x0 = ((i - 1) / (data.length - 1)) * w;
            const y0 = h - ((data[i-1].p - min) / (max - min)) * h;
            const cp1x = x0 + (x - x0) / 2;
            path += ` C ${cp1x} ${y0}, ${cp1x} ${y}, ${x} ${y}`;
        }
        const fillPath = path + ` L ${w} ${h} L 0 ${h} Z`;

        return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;">
            <path d="${fillPath}" fill="#0070dd" fill-opacity="0.3" stroke="none" />
            <path d="${path}" fill="none" stroke="#0070dd" stroke-width="1.5" stroke-opacity="0.6" />
        </svg>`;
    },

    formatPrice: function(n) {
        if (n === 0) return '0';
        let val;
        if (n < 100) { val = n.toFixed(2); } else { val = Math.floor(n).toLocaleString(); }
        const icon = (typeof GOLD_ICON !== 'undefined') ? GOLD_ICON : 'gold.jpg';
        return `${val} <img src="${icon}" style="width:12px; vertical-align:-2px; border-radius:50%;">`;
    }
};