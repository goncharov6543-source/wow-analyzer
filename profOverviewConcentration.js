const ProfOverviewConcentration = {
    // Внутрішній стан
    isInit: false,
    sortConfig: { col: 'profit', dir: 'desc' }, 
    
    // === 1. ЗАПУСК ===
    init: function() {
        console.log("🚀 Concentration Tab: Initializing...");
        
        const container = document.getElementById('conc-body-target');
        if (!container) return;

        if (typeof PRICES === 'undefined' || Object.keys(PRICES).length === 0) {
            console.warn("⚠️ PRICES object is empty.");
        }

        this.injectLocalStyles();
        this.renderRows();
    },

    // === 2. СОРТУВАННЯ ===
    applySort: function(colName) {
        if (this.sortConfig.col === colName) {
            this.sortConfig.dir = (this.sortConfig.dir === 'desc') ? 'asc' : 'desc';
        } else {
            this.sortConfig.col = colName;
            this.sortConfig.dir = 'desc';
        }
        this.renderRows();
    },

    getQualityIcon: function(tier) {
        if(!tier) return '';
        return `<img src="tier${tier}.png" class="q-icon">`;
    },

    // === 3. РЕНДЕРИНГ ===
    renderRows: function() {
        const container = document.getElementById('conc-body-target');
        
        if (!CONCENTRATION_DB || !CONCENTRATION_DB.length) {
            container.innerHTML = '<tr><td colspan="4" style="text-align:center;">Database empty.</td></tr>';
            return;
        }

        // Константи з index.js
        const RES_FACTOR = 0.5;
        const MULTI_BONUS = 2;

        // 1. Розрахунки (Базові + Бонуси по логіці index.js)
        let calculatedRows = CONCENTRATION_DB.map((item, index) => {
            const ahPrice = this.getPrice(item.name);
            const iconUrl = this.getIcon(item.name);
            const badgeColor = (typeof PROF_COLORS !== 'undefined' && PROF_COLORS[item.prof]) ? PROF_COLORS[item.prof] : '#444';

            let craftCost = 0;
            const reagentsList = [];

            if (item.recipe) {
                item.recipe.forEach(r => {
                    const rPrice = this.getPrice(r.name); 
                    const rIcon = this.getIcon(r.name);
                    const totalR = rPrice * r.count;
                    craftCost += totalR;
                    reagentsList.push({ name: r.name, qty: r.count, price: rPrice, total: totalR, icon: rIcon });
                });
            }

            const fee = ahPrice * 0.05;
            const baseProfit = ahPrice - fee - craftCost;
            
            const profName = item.prof ? item.prof.toUpperCase() : "";
            const isEnchanting = profName.includes("ENCHANTING");
            const ingFactor = isEnchanting ? 1.0 : 0.5;

            const penalty = item.statPenalty || 0;
            const penaltyMult = Math.max(0, (100 - penalty) / 100);

            // --- РОЗРАХУНОК БОНУСІВ ---
            let totalBonus = 0;
            let bonusBreakdown = {}; 

            if (item.stats && item.stats.length > 0) {
                item.stats.forEach(stat => {
                    let val = stat.count; 
                    let bonusGold = 0;
                    const sName = stat.name.toLowerCase();

                    if (sName.includes('resourcefulness')) {
                        let currentResSaving = 0;
                        reagentsList.forEach(reg => {
                            currentResSaving += reg.total * (val / 100) * RES_FACTOR;
                        });
                        bonusGold = currentResSaving;
                    } 
                    else if (sName.includes('ingenuity')) {
                         bonusGold = (ahPrice * (val / 100) * ingFactor) * 0.8;
                    }
                    else if (sName.includes('multicraft')) {
                         bonusGold = (ahPrice * (val / 100) * MULTI_BONUS) * 0.8;
                    }

                    if (bonusGold > 0) {
                        bonusGold *= penaltyMult; 
                        totalBonus += bonusGold;
                        bonusBreakdown[stat.name] = bonusGold; 
                    }
                });
            }

            const totalProfit = baseProfit + totalBonus;
            const profitPerConc = item.ConcCost > 0 ? (totalProfit / item.ConcCost) : 0;
            const isNoData = ahPrice === 0;

            return {
                originalIndex: index,
                item, ahPrice, iconUrl, badgeColor, reagentsList, craftCost, 
                baseProfit, profit: totalProfit, bonusBreakdown, profitPerConc, isNoData
            };
        });

        // 2. Сортування
        calculatedRows.sort((a, b) => {
            let valA = (this.sortConfig.col === 'pc') ? a.profitPerConc : a.profit;
            let valB = (this.sortConfig.col === 'pc') ? b.profitPerConc : b.profit;
            
            if (a.isNoData) return 1;
            if (b.isNoData) return -1;

            return (this.sortConfig.dir === 'desc') ? (valB - valA) : (valA - valB);
        });

        // 3. HTML Генерація
        let html = '';
        calculatedRows.forEach(row => {
            const { item, ahPrice, iconUrl, badgeColor, profit, profitPerConc, isNoData, originalIndex } = row;
            
            const profitClass = isNoData ? 'val-gray' : (profit >= 0 ? 'val-profit' : 'val-neg');
            const displayProfit = isNoData ? 'N/A' : this.fmt(profit);
            const displayPrice = isNoData ? 'N/A' : this.fmt(ahPrice);
            const displayConcGold = isNoData ? 'N/A' : this.fmtDec(profitPerConc);

            const rowId = `conc-row-${originalIndex}`;
            
            let displayNameMain = item.name;
            let tierHtmlMain = '';
            const matchMain = displayNameMain.match(/ [tq]([1-3])/i);
            if (matchMain) {
                tierHtmlMain = this.getQualityIcon(matchMain[1]);
                displayNameMain = displayNameMain.replace(matchMain[0], '').trim();
            }

            html += `
                <tr class="conc-main-row" onclick="ProfOverviewConcentration.toggleDetails('${rowId}')">
                    <td>
                        <div class="conc-flex" style="justify-content: space-between;">
                            <div style="display:flex; align-items:center; gap:15px;">
                                <img src="${iconUrl}" class="conc-icon">
                                <div class="conc-name">${displayNameMain}${tierHtmlMain}</div>
                            </div>
                            <span class="prof-badge" style="background: ${badgeColor};">${item.prof}</span>
                        </div>
                    </td>
                    <td class="text-right val-gold">${displayPrice}</td>
                    <td class="text-right ${profitClass}">${displayProfit}</td>
                    <td class="text-right" style="color:#00ccff; font-weight:bold;">${displayConcGold}</td>
                </tr>
                <tr id="details-${rowId}" class="conc-details-row">
                    <td colspan="4" style="padding:0;">
                        <div id="wrapper-${rowId}" class="expand-wrapper">
                            ${this.generateDetailsHtml(row)}
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    generateDetailsHtml: function(data) {
        let statsHtml = '';
        let avgProfitHtml = '';
        
        if (data.item.stats && data.item.stats.length > 0) {
            data.item.stats.forEach(stat => {
                let val = stat.count;
                let unit = stat.unit || '';
                let bonusGold = (data.bonusBreakdown && data.bonusBreakdown[stat.name]) ? data.bonusBreakdown[stat.name] : 0;

                statsHtml += `
                    <div class="stat-row">
                        <span style="color:#aaa">${stat.name}:</span>
                        <span style="font-weight:bold; color:#fff;">${val}${unit}</span>
                    </div>
                `;

                if (bonusGold > 0) {
                    avgProfitHtml += `
                        <div class="stat-row">
                            <span style="color:#aaa">${stat.name}:</span>
                            <span style="font-weight:bold; color:#00ff99;">+${this.fmt(bonusGold)}</span>
                        </div>
                    `;
                }
            });
        } else {
            statsHtml = '<div style="color:#666; font-style:italic;">No stats in DB</div>';
        }

        let penaltyHtml = '';
        if (data.item.statPenalty > 0) {
            penaltyHtml = `<div style="font-size:12px; color:#ff5555; margin-top:5px; font-style:italic;">* Stats profit reduced by ${data.item.statPenalty}%</div>`;
        }

        if (avgProfitHtml !== '') {
            avgProfitHtml = `
                <div class="avg-profit-section">
                    <div class="avg-profit-header">Avg Profit (per craft)</div>
                    ${avgProfitHtml}
                    ${penaltyHtml}
                </div>
            `;
        }

        const regsHtml = data.reagentsList.map(r => {
            let dName = r.name;
            let tHtml = '';
            const m = dName.match(/ [tq]([1-3])/i);
            if (m) {
                tHtml = this.getQualityIcon(m[1]);
                dName = dName.replace(m[0], '').trim();
            }
            return `
            <div class="reg-item">
                <div style="display:flex; align-items:center;">
                     <img src="${r.icon}" class="reg-icon-small">
                     <span style="color:#fff;">${dName}${tHtml} <span style="color:#777">x${r.qty}</span></span>
                </div>
                <span style="color:#ffd700;">${this.fmt(r.total)}</span>
            </div>
            `;
        }).join('');

        return `
            <div class="conc-expanded-container">
                <div class="exp-col left-col">
                    <div class="section-title">Stats</div>
                    <div class="stats-list">${statsHtml}</div>
                    ${avgProfitHtml}
                </div>
                <div class="exp-col right-col">
                    <div class="section-title">Reagents</div>
                    <div class="reagents-list">${regsHtml}</div>
                    <div class="total-cost-row">
                        <span>Total Cost:</span>
                        <span class="val-gold">${this.fmt(data.craftCost)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // === 4. ДЕТАЛІ ===
    toggleDetails: function(rowId) {
        const row = document.getElementById(`details-${rowId}`);
        const wrapper = document.getElementById(`wrapper-${rowId}`);

        if (row.classList.contains('open')) {
            wrapper.classList.remove('active');
            setTimeout(() => { row.classList.remove('open'); }, 300);
        } else {
            row.classList.add('open');
            setTimeout(() => wrapper.classList.add('active'), 10);
        }
    },

    fmt: function(n) { 
        if (isNaN(n) || !n || n === 0) return '0 <img src="gold.jpg" class="coin-icon-small">';
        return `${Math.floor(n).toLocaleString()} <img src="gold.jpg" class="coin-icon-small">`; 
    },
    fmtDec: function(n) { 
        if (isNaN(n) || !n || n === 0) return '0 <img src="gold.jpg" class="coin-icon-small">';
        return `${n.toFixed(1)} <img src="gold.jpg" class="coin-icon-small">`; 
    },
    getPrice: function(name) { if (PRICES[name]) return PRICES[name].price || 0; return 0; },
    getIcon: function(name) { if (PRICES[name]) return PRICES[name].icon; return 'https://render.worldofwarcraft.com/eu/icons/56/inv_misc_questionmark.jpg'; },

    injectLocalStyles: function() {
        if (document.getElementById('conc-styles')) return;
        const style = document.createElement('style');
        style.id = 'conc-styles';
        style.innerHTML = `
            .conc-main-row { cursor: pointer; transition: background 0.1s; }
            .conc-main-row:hover { background: #252525; }
            .conc-main-row td { border-bottom: 1px solid #333; }
            
            .conc-flex { display: flex; align-items: center; width: 100%; } 
            .conc-icon { width: 36px; height: 36px; border-radius: 4px; border: 1px solid #444; object-fit: cover; }
            .conc-name { font-weight: bold; color: #fff; font-size: 14px; display: flex; align-items: center; }
            .coin-icon-small { width: 14px; height: 14px; vertical-align: -2px; border-radius: 50%; margin-left: 2px; }
            .text-right { text-align: right; }
            .val-gold { color: #ffd700; font-family: 'Segoe UI', sans-serif; font-weight: 500; }
            .val-profit { color: #00ff99; font-weight: bold; }
            .val-neg { color: #ff5555; }
            .val-gray { color: #666; font-style: italic; }
            .prof-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; color: #fff; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.1); }
            
            /* Animation matching index.js */
            .conc-details-row { visibility: collapse; }
            .conc-details-row.open { visibility: visible; }
            .expand-wrapper { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; background: #151515; border-bottom: 1px solid #333; }
            .expand-wrapper.active { max-height: 700px; }
            
            .q-icon { width: 1.1em; height: 1.1em; margin-left: 4px; vertical-align: -0.2em; }
            
            .conc-expanded-container { display: flex; padding: 25px; gap: 40px; }
            .exp-col { flex: 1; }
            .section-title { font-weight: bold; font-size: 16px; color: #fff; margin-bottom: 15px; }
            .stats-list { margin-bottom: 20px; }
            .stat-row { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; border-bottom: 1px solid #333; }
            .avg-profit-section { margin-top: 15px; }
            .avg-profit-header { font-weight: bold; color: #d6b0ff; margin-bottom: 8px; font-size: 15px; }
            .reagents-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
            .reg-item { display: flex; justify-content: space-between; background: #222; padding: 8px 12px; border-radius: 4px; font-size: 14px; border: 1px solid #333; align-items: center; }
            .reg-icon-small { width: 24px; height: 24px; border-radius: 4px; margin-right: 10px; border: 1px solid #444; }
            .total-cost-row { display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #444; font-size: 15px; color: #aaa; }
        `;
        document.head.appendChild(style);
    },

    filterRows: function(val) { 
        const rows = document.querySelectorAll('.conc-main-row');
        rows.forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
            const next = row.nextElementSibling;
            if(next && next.classList.contains('conc-details-row')) {
                next.classList.remove('open');
                const wrapper = next.querySelector('.expand-wrapper');
                if (wrapper) wrapper.classList.remove('active');
            }
        });
    }
};

window.ProfOverviewConcentration = ProfOverviewConcentration;