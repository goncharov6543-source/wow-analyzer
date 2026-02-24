/* ===========================================================
   AUTO-LOADER: Підключаємо файли динамічно, бо HTML генерується
   =========================================================== */
   (function loadExternalScripts() {
    const scripts = [
        'profOverviewConcentrationDataBase.json', // База даних
        'profOverviewConcentration.js'          // Логіка
    ];

    scripts.forEach(src => {
        // Перевіряємо, чи скрипт вже є, щоб не дублювати
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Зберігаємо порядок завантаження
            document.head.appendChild(script);
            console.log(`🔌 Injecting script: ${src}`);
        }
    });
})();

/* ===========================================================
   MAIN LOGIC
   =========================================================== */
const ProfOverview = {
    isInit: false,
    activeTab: 'farming', // 'farming' | 'concentration'
    currentGallery: [],
    currentGalleryIndex: 0,

    init: function() {
        if (this.isInit) return;
        this.injectStyles();
        this.injectModalHtml();
        this.isInit = true;
        this.render();
        console.log("📜 Professions Overview Initialized");
    },

    injectStyles: function() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* --- CONTAINER --- */
            .overview-container { 
                background: #1e1e1e; border: 1px solid #333; border-radius: 8px; overflow: hidden; 
                animation: fadeIn 0.4s ease-in-out; width: 95%; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            }
            
            .ov-table { width: 100%; border-collapse: collapse; }
            .ov-table th { 
                padding: 15px 25px; background: #222; text-align: left; color: #888; 
                text-transform: uppercase; font-size: 12px; letter-spacing: 1px; font-weight: 600;
                border-bottom: 1px solid #333; vertical-align: middle; user-select: none;
            }
            
            .ov-table th:first-child, .ov-row td:first-child, .conc-row td:first-child { width: 100%; text-align: left; }
            .ov-table th:not(:first-child), .ov-row td:not(:first-child), .conc-row td:not(:first-child) { 
                width: 1%; white-space: nowrap; 
            }

            .header-controls { display: flex; align-items: center; gap: 10px; }
            
            .search-input {
                width: 220px; background: #121212; border: 1px solid #444; border-radius: 4px;
                padding: 6px 10px; color: #fff; font-family: inherit; font-size: 13px; outline: none; transition: all 0.2s ease;
            }
            .search-input:focus { border-color: #ffd700; background: #000; }

            .mode-select {
                background: #121212; color: #fff; border: 1px solid #444; border-radius: 4px;
                padding: 4px 10px; font-size: 13px; outline: none; cursor: pointer; font-weight: bold; height: 31px;
                text-align: center; text-align-last: center; transition: all 0.2s ease;
            }
            .mode-select:hover { border-color: #ffd700; background: #1a1a1a; }
            .mode-select:focus { border-color: #ffd700; box-shadow: 0 0 5px rgba(255,215,0,0.3); }
            .mode-select option {
                background: #1e1e1e; color: #fff; text-align: center; padding: 10px;
            }

            /* --- ROWS --- */
            .ov-row { cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #2a2a2a; position: relative; }
            .ov-row:hover { background: #262626; }
            .ov-row td { padding: 15px 25px; vertical-align: middle; }

            /* --- FARMING SPECIFIC --- */
            .ov-row.expanded { background: #292929; border-left: 4px solid var(--gold); }
            .group-cell-content { display: flex; align-items: center; }
            .group-icon { width: 44px; height: 44px; border-radius: 6px; margin-right: 18px; border: 1px solid #444; object-fit: cover; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
            .group-info { display: flex; flex-direction: column; justify-content: center; }
            .group-title { font-size: 16px; font-weight: bold; color: #fff; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
            .group-sub { font-size: 12px; color: #777; margin-top: 5px; }
            
            .prof-badge-cell { text-align: center; }
            .prof-badge {
                display: inline-block; padding: 4px 10px; border-radius: 4px; color: #fff; 
                font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8); box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
            }
            .profit-val { font-size: 16px; font-weight: bold; text-align: right; }

            /* --- CONCENTRATION SPECIFIC --- */
            .conc-row { cursor: default; border-bottom: 1px solid #2a2a2a; }
            .conc-row:hover { background: #222; }
            .conc-row td { padding: 12px 25px; vertical-align: middle; color: #ddd; }
            .conc-item-cell { display: flex; align-items: center; gap: 12px; }
            .conc-icon { width: 36px; height: 36px; border-radius: 4px; border: 1px solid #444; object-fit: cover; }
            .conc-name { font-weight: bold; color: #fff; font-size: 14px; }
            .conc-val { font-family: 'Segoe UI', sans-serif; font-weight: 500; font-size: 14px; }
            .val-profit { color: var(--green); font-weight: bold; }
            .val-pc { color: #00ccff; font-weight: bold; }

            /* --- CARDS & DETAILS --- */
            .ov-details-row { display: none; background: #121212; }
            .ov-details-row.show { display: table-row; }
            .ov-details-cell { padding: 0 !important; border-bottom: 1px solid #333; width: 100%; box-sizing: border-box; }
            
            .ov-expand-wrapper { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.4s ease-in-out, opacity 0.3s ease-in-out; width: 100%; }
            .ov-expand-wrapper.open { max-height: 15000px; opacity: 1; }
            
            .cards-container { padding: 30px; display: flex; flex-wrap: wrap; gap: 25px; align-items: flex-start; width: 100%; box-sizing: border-box; }
            
            .craft-unit { display: inline-flex; align-items: stretch; background: linear-gradient(135deg, #222 0%, #1d1d1d 100%); border: 1px solid; border-radius: 6px; padding: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.4); overflow: hidden; min-width: 420px; position: relative; box-sizing: border-box; height: 100%; }
            
            .po-info-btn {
                position: absolute; top: 12px; left: 12px; width: 22px; height: 22px; 
                border-radius: 50%; background: #ffd700; border: none; color: #000; 
                display: flex; align-items: center; justify-content: center; font-size: 14px; 
                font-weight: bold; cursor: pointer; transition: 0.2s; z-index: 10; font-family: monospace;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            }
            .po-info-btn:hover { transform: scale(1.15); }

            .cu-left { display: flex; flex-direction: column; padding: 18px; background: rgba(255, 255, 255, 0.03); border-right: 1px solid #444; width: 220px; flex-shrink: 0; box-sizing: border-box; min-height: max-content; }
            .cu-left-top { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
            .cu-icon { width: 56px; height: 56px; border-radius: 5px; border: 1px solid; margin-bottom: 12px; }
            .cu-title { font-size: 16px; font-weight: bold; color: #fff; line-height: 1.3; margin-bottom: 12px; height: 42px; overflow: hidden; display: flex; justify-content: center; align-items: flex-start; gap: 4px; text-align: center; }
            .cu-stat { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 13px; margin-bottom: 4px; }
            .cu-label { color: #888; text-transform: uppercase; font-size: 11px; font-weight: 700; }
            .cu-val { font-weight: bold; font-family: 'Segoe UI', sans-serif; font-size: 15px; } 
            .val-cost { color: #ddd; } .val-rev { color: #ffd700; } .p-pos { color: var(--green); text-shadow: 0 0 8px rgba(0, 255, 153, 0.15); } .p-neg { color: #ff4444; }
            .cu-divider { width: 100%; height: 1px; background: #444; margin: 15px 0; }
            .stats-section { width: 100%; }
            .stats-header { font-size: 12px; font-weight: bold; color: #fff; margin-bottom: 8px; }
            .stat-row { display: flex; justify-content: space-between; width: 100%; font-size: 12px; margin-bottom: 5px; color: #aaa; }
            .stat-val { color: #fff; font-weight: 500; }
            .avg-profit-header { font-size: 12px; font-weight: bold; color: #d6b0ff; margin-top: 12px; margin-bottom: 8px; border-top: 1px dashed #444; padding-top: 8px; }
            .stat-bonus { color: var(--green); font-weight: bold; }
            
            .cu-right { display: flex; flex-direction: column; padding: 15px; background: #1f1f1f; flex-grow: 1; gap: 12px; box-sizing: border-box; min-height: max-content; }
            
            .reagents-scroll-wrapper {
                display: flex; flex-direction: column; gap: 5px;
                max-height: 270px;
                overflow-y: auto; padding-right: 5px;
            }
            .reagents-scroll-wrapper::-webkit-scrollbar { width: 4px; }
            .reagents-scroll-wrapper::-webkit-scrollbar-track { background: #111; border-radius: 2px; }
            .reagents-scroll-wrapper::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
            .reagents-scroll-wrapper::-webkit-scrollbar-thumb:hover { background: #666; }

            .section-label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 3px; }
            .mini-reg, .mini-out { background: #2b2b2b; border: 1px solid #3d3d3d; border-radius: 4px; padding: 6px 10px; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; flex-shrink: 0; }
            .mini-out { background: #252a25; border-color: #2a442a; }
            
            .cheapest-highlight { border-color: var(--gold) !important; box-shadow: 0 0 10px rgba(255, 215, 0, 0.2); background: #332b1a; }
            .dimmed-reagent { opacity: 0.4; filter: grayscale(0.8); transition: all 0.2s ease; }
            .dimmed-reagent:hover { opacity: 0.8; filter: grayscale(0); }

            .mini-reg-icon, .mini-out-icon { width: 26px; height: 26px; border-radius: 3px; }
            .mini-reg-info, .mini-out-info { display: flex; flex-direction: column; line-height: 1.1; flex-grow: 1; }
            .mini-reg-name, .mini-out-name { font-size: 12px; color: #ccc; font-weight: 500; display:flex; align-items:center; }
            .mini-reg-sub, .mini-out-sub { font-size: 11px; color: #666; }
            .mini-reg-price { font-size: 12px; color: #888; font-family: monospace; } 
            .mini-out-val { font-size: 13px; color: var(--green); font-weight: bold; } 
            .q-icon { width: 1.1em; height: 1.1em; margin-left: 4px; vertical-align: -0.2em; }

            /* --- CUSTOM MODAL STYLES --- */
            .po-modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9000; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
            .po-modal-box { background: var(--panel, #1e1e1e); padding: 30px; border-radius: 12px; width: 650px; border: 1px solid #444; box-shadow: 0 10px 50px rgba(0,0,0,0.8); position: relative; display: flex; flex-direction: column; gap: 20px; }
            .po-close { position: absolute; top: 15px; right: 20px; color: #888; font-size: 28px; cursor: pointer; transition: 0.2s; line-height: 1; font-weight: bold; }
            .po-close:hover { color: #fff; transform: scale(1.1); }
            
            .po-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #333; padding-bottom: 15px; }
            .po-header-left { flex-grow: 1; padding-right: 20px; }
            .po-prof-title { font-size: 22px; font-weight: bold; color: var(--gold, #ffd700); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px; }
            
            .po-skill-container { width: 100%; max-width: 300px; }
            .po-skill-labels { display: flex; justify-content: space-between; font-size: 13px; color: #ccc; margin-bottom: 5px; font-weight: 500; }
            .po-skill-bg { height: 10px; background: #111; border-radius: 5px; overflow: hidden; border: 1px solid #444; }
            
            .po-skill-fill { height: 100%; width: 0%; transition: width 1.2s cubic-bezier(0.1, 1, 0.2, 1); }
            
            .po-tools { display: flex; gap: 8px; }
            .po-tool-icon { width: 40px; height: 40px; border: 1px solid #555; border-radius: 6px; background: #000; object-fit: cover; cursor: help; }
            
            .po-body { display: flex; justify-content: center; align-items: center; background: #111; border-radius: 8px; border: 1px solid #333; padding: 15px; min-height: 200px; overflow: hidden; position: relative; }
            
            .po-img-gallery { position: relative; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; }
            .po-nav-btn {
                position: absolute; top: 50%; transform: translateY(-50%);
                width: 34px; height: 34px; border-radius: 50%; background: rgba(0,0,0,0.6);
                color: #fff; display: flex; align-items: center; justify-content: center;
                cursor: pointer; border: 1px solid #555; transition: 0.2s; user-select: none; 
                font-weight: bold; font-family: monospace; font-size: 20px; z-index: 50;
            }
            .po-nav-btn:hover { background: var(--gold, #ffd700); color: #000; border-color: #000; transform: translateY(-50%) scale(1.1); }
            .po-nav-left { left: 10px; }
            .po-nav-right { right: 10px; }
            
            .po-img-wrapper {
                position: relative; display: inline-block; max-width: 100%; 
                cursor: zoom-in; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                transition: opacity 0.2s ease-in-out; overflow: hidden;
            }
            .po-gallery-img { max-width: 100%; max-height: 400px; display: block; transition: opacity 0.2s ease-in-out; }
            
            .po-gallery-note {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: rgba(0, 0, 0, 0.85); color: #ffd700; padding: 12px 15px;
                font-size: 14px; text-align: center; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
                backdrop-filter: blur(3px); font-weight: bold; pointer-events: none;
                box-shadow: 0 -5px 15px rgba(0,0,0,0.5);
            }
            
            .po-img-wrapper.zoomed {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                z-index: 10000; box-shadow: 0 0 0 10000px rgba(0,0,0,0.85); cursor: zoom-out;
            }
            .po-img-wrapper.zoomed .po-gallery-img { max-height: 90vh; max-width: 90vw; }
            
            .po-footer { display: flex; flex-direction: column; gap: 20px; border-top: 1px solid #333; padding-top: 20px; }
            .po-footer-icons { display: flex; justify-content: flex-start; gap: 8px; }
            
            .po-import-btn { 
                align-self: center; background: #2a2a2a; color: #ccc; border: 1px solid #444; 
                padding: 12px 40px; font-weight: bold; border-radius: 6px; cursor: pointer; 
                text-transform: uppercase; letter-spacing: 2px; font-size: 15px; transition: all 0.3s ease;
            }
            .po-import-btn:hover { background: #333; color: #fff; }

            /* Tooltips CSS */
            .img-tooltip-wrap { position: relative; display: inline-block; }
            .img-tooltip-wrap .tooltip-img { 
                display: none; position: absolute; z-index: 9999; 
                border: 1px solid #666; border-radius: 6px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.9); pointer-events: none;
            }
            
            .po-tools .img-tooltip-wrap .tooltip-img { right: 0; top: 115%; }
            .po-footer-icons .img-tooltip-wrap .tooltip-img { left: 0; bottom: 115%; }
            
            .img-tooltip-wrap:hover .tooltip-img { display: block; animation: fadeIn 0.2s ease-in-out; }
        `;
        document.head.appendChild(style);
    },

    injectModalHtml: function() {
        if (document.getElementById('po-custom-modal')) return;
        
        const modalHtml = `
            <div id="po-custom-modal" class="po-modal-overlay" onclick="if(event.target===this) ProfOverview.closeModal()">
                <div class="po-modal-box">
                    <span class="po-close" onclick="ProfOverview.closeModal()">×</span>
                    
                    <div class="po-header">
                        <div class="po-header-left">
                            <div id="po-modal-title" class="po-prof-title">PROFESSION</div>
                            <div class="po-skill-container">
                                <div class="po-skill-labels"><span>Skill</span><span id="po-modal-skill-txt">0 / 100</span></div>
                                <div class="po-skill-bg"><div id="po-modal-skill-fill" class="po-skill-fill"></div></div>
                            </div>
                        </div>
                        <div id="po-modal-tools" class="po-tools"></div>
                    </div>
                    
                    <div id="po-modal-body" class="po-body"></div>
                    
                    <div class="po-footer">
                        <div id="po-modal-footer-icons" class="po-footer-icons"></div>
                        <button id="po-modal-import-btn" class="po-import-btn">IMPORT</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    openModal: function(profName, gIdx, rIdx) {
        if (typeof OVERVIEW_DB === 'undefined' || !OVERVIEW_DB[profName] || !OVERVIEW_DB[profName][gIdx] || !OVERVIEW_DB[profName][gIdx].recipes[rIdx]) return;
        
        const method = OVERVIEW_DB[profName][gIdx].recipes[rIdx];
        const moreInfo = method.moreInfo;
        
        if (!moreInfo || moreInfo.length === 0) {
            alert("No detailed information available for this item.");
            return;
        }

        let skill = 0;
        let tools = [];
        let rawImages = [];
        let buffs = [];

        moreInfo.forEach(block => {
            if (block.header) {
                block.header.forEach(hItem => {
                    if (hItem.skill !== undefined) skill = hItem.skill;
                    if (hItem.tools) tools = hItem.tools;
                });
            }
            if (block.body) {
                block.body.forEach(bItem => {
                    if (bItem.talantes) {
                        let tals = Array.isArray(bItem.talantes) ? bItem.talantes : [bItem.talantes];
                        rawImages = tals.map(t => {
                            if (typeof t === 'string') return { screen: t, note: '' };
                            return { screen: t.screen || '', note: t.note || '' };
                        });
                    }
                });
            }
            if (block.footer) {
                block.footer.forEach(fItem => {
                    if (fItem.buffs) buffs = fItem.buffs;
                });
            } else if (block.buffs) { 
                buffs = block.buffs;
            }
        });

        document.getElementById('po-modal-title').innerText = profName;
        
        const maxSkill = 100;
        const skillVisual = Math.min(skill, maxSkill);
        document.getElementById('po-modal-skill-txt').innerText = `${skill} / ${maxSkill}`;
        
        const barColor = (typeof PROF_COLORS !== 'undefined' && PROF_COLORS[profName.toUpperCase()]) 
            ? PROF_COLORS[profName.toUpperCase()] 
            : '#ffd700'; 
        
        const fillEl = document.getElementById('po-modal-skill-fill');
        fillEl.style.background = barColor;
        
        setTimeout(() => {
            fillEl.style.width = `${skillVisual}%`;
        }, 50);

        const toolsHtml = tools.map(t => {
            const icon = t.iconAccessory1 || t.iconAccessory2 || t.iconAccessory3 || '';
            const info = t.iconAccessory1Info || t.iconAccessory2Info || t.iconAccessory3Info || '';
            if(!icon) return '';
            return `<div class="img-tooltip-wrap"><img src="${icon}" class="po-tool-icon"><img src="${info}" class="tooltip-img"></div>`;
        }).join('');
        document.getElementById('po-modal-tools').innerHTML = toolsHtml;

        this.currentGallery = rawImages.filter(g => g.screen);
        this.currentGalleryIndex = 0;
        
        let bodyHtml = '';
        if (this.currentGallery.length > 0) {
            let navHtml = '';
            if (this.currentGallery.length > 1) {
                navHtml = `
                    <div class="po-nav-btn po-nav-left" onclick="event.stopPropagation(); ProfOverview.changeGallery(-1)">&#8249;</div>
                    <div class="po-nav-btn po-nav-right" onclick="event.stopPropagation(); ProfOverview.changeGallery(1)">&#8250;</div>
                `;
            }
            
            const firstItem = this.currentGallery[0];
            const noteDisplay = firstItem.note ? 'block' : 'none';
            
            bodyHtml = `
                <div class="po-img-gallery">
                    ${navHtml}
                    <div id="po-modal-img-wrap" class="po-img-wrapper" onclick="this.classList.toggle('zoomed')">
                        <img id="po-modal-main-img" src="${firstItem.screen}" class="po-gallery-img">
                        <div id="po-modal-note" class="po-gallery-note" style="display: ${noteDisplay};">${firstItem.note}</div>
                    </div>
                </div>
            `;
        } else {
            bodyHtml = '<div style="color:#777; font-style:italic;">No image provided</div>';
        }
        document.getElementById('po-modal-body').innerHTML = bodyHtml;

        const footerIconsHtml = buffs.map(b => {
            const icon = b.buff1Icon || b.buff2Icon || '';
            const info = b.buff1Info || b.buff2Info || '';
            if(!icon) return '';
            return `<div class="img-tooltip-wrap"><img src="${icon}" class="po-tool-icon"><img src="${info}" class="tooltip-img"></div>`;
        }).join('');
        document.getElementById('po-modal-footer-icons').innerHTML = footerIconsHtml;

        const importBtn = document.getElementById('po-modal-import-btn');
        importBtn.innerText = "IMPORT"; 
        importBtn.style.backgroundColor = "";
        importBtn.style.color = "";
        importBtn.onclick = () => ProfOverview.copyRecipeJSON(method, importBtn);

        document.getElementById('po-custom-modal').style.display = 'flex';
    },

    copyRecipeJSON: function(method, btn) {
        const recipeData = JSON.parse(JSON.stringify(method));
        delete recipeData.moreInfo;

        if (recipeData.reagents) {
            let cheapestIdx = -1;
            let minCost = Infinity;

            recipeData.reagents.forEach((reg, idx) => {
                if (reg.pickCheapestReagent) {
                    const pItem = typeof PRICES !== 'undefined' ? PRICES[reg.name] || {} : {};
                    const price = pItem.price || 0;
                    const total = price * reg.count;
                    
                    if (total < minCost) {
                        minCost = total;
                        cheapestIdx = idx;
                    }
                }
            });

            if (cheapestIdx !== -1) {
                const cheapestReg = recipeData.reagents[cheapestIdx];
                
                // Якщо НЕмає прапорця keepMainIcon, тоді підміняємо ID і назву
                if (!recipeData.keepMainIcon) {
                    recipeData.item = cheapestReg.name;
                    if (cheapestReg.id) {
                        recipeData.id = cheapestReg.id;
                    }
                }

                recipeData.reagents = recipeData.reagents.filter((reg, idx) => {
                    return !reg.pickCheapestReagent || idx === cheapestIdx;
                });
            }

            recipeData.reagents.forEach(reg => {
                delete reg.pickCheapestReagent;
            });
        }
        
        // Видаляємо допоміжний прапорець перед імпортом
        delete recipeData.keepMainIcon;

        const jsonOutput = JSON.stringify(recipeData, null, 4);

        const tempText = document.createElement("textarea");
        tempText.value = jsonOutput;
        document.body.appendChild(tempText);
        tempText.select();
        document.execCommand("copy");
        document.body.removeChild(tempText);

        const originalText = "IMPORT";
        
        btn.innerText = "COPIED";
        btn.style.backgroundColor = "var(--green)";
        btn.style.color = "#000";
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.backgroundColor = ""; 
            btn.style.color = "";
        }, 2000);
    },

    changeGallery: function(direction) {
        if (!this.currentGallery || this.currentGallery.length <= 1) return;
        
        this.currentGalleryIndex += direction;
        if (this.currentGalleryIndex < 0) this.currentGalleryIndex = this.currentGallery.length - 1;
        if (this.currentGalleryIndex >= this.currentGallery.length) this.currentGalleryIndex = 0;
        
        const currentItem = this.currentGallery[this.currentGalleryIndex];
        const wrapEl = document.getElementById('po-modal-img-wrap');
        const imgEl = document.getElementById('po-modal-main-img');
        const noteEl = document.getElementById('po-modal-note');
        
        wrapEl.style.opacity = 0;
        
        setTimeout(() => {
            imgEl.src = currentItem.screen;
            
            if (currentItem.note) {
                noteEl.innerHTML = currentItem.note;
                noteEl.style.display = 'block';
            } else {
                noteEl.style.display = 'none';
            }
            
            wrapEl.style.opacity = 1;
        }, 200);
    },

    closeModal: function() {
        document.getElementById('po-custom-modal').style.display = 'none';
        document.getElementById('po-modal-skill-fill').style.width = '0%';
        
        const wrap = document.getElementById('po-modal-img-wrap');
        if (wrap) wrap.classList.remove('zoomed');
    },

    switchTab: function(mode) {
        this.activeTab = mode;
        this.render(); 
    },

    render: function() {
        const container = document.getElementById('profOverview-content');
        if (!container) return;

        let theadHtml = '';
        let tbodyHtml = '';
        
        if (this.activeTab === 'farming') {
            theadHtml = `
                <th style="padding-top: 12px; padding-bottom: 12px;">
                    <div class="header-controls">
                        <input type="text" class="search-input" placeholder="Search..." onkeyup="ProfOverview.filterRows(this.value)">
                        <select class="mode-select" onchange="ProfOverview.switchTab(this.value)">
                            <option value="farming" selected>Farming</option>
                            <option value="concentration">Concentration</option>
                        </select>
                    </div>
                </th>
                <th style="text-align: center; width: 1%;">Profession</th>
                <th style="text-align:right;">Exp. Profit (Best)</th>
            `;
            tbodyHtml = this.generateFarmingRows();
            if (!tbodyHtml.startsWith('<tbody')) tbodyHtml = `<tbody>${tbodyHtml}</tbody>`;

        } else {
            theadHtml = `
                <th style="padding-top: 12px; padding-bottom: 12px;">
                    <div class="header-controls">
                        <input type="text" class="search-input" placeholder="Search item..." onkeyup="ProfOverviewConcentration.filterRows(this.value)">
                        <select class="mode-select" onchange="ProfOverview.switchTab(this.value)">
                            <option value="farming">Farming</option>
                            <option value="concentration" selected>Concentration</option>
                        </select>
                    </div>
                </th>
                <th style="text-align:right;">AH Price</th>
                <th style="text-align:right; color: var(--green); cursor: pointer; user-select: none;" onclick="ProfOverviewConcentration.applySort('profit')" title="Sort by Profit">Profit ▼</th>
                <th style="text-align:right; color: #00ccff; cursor: pointer; user-select: none;" onclick="ProfOverviewConcentration.applySort('pc')" title="Sort by Profit/Concentration">P/C ▼</th>
            `;
            tbodyHtml = `<tbody id="conc-body-target"><tr><td colspan="4" style="text-align:center; padding:40px; color:#ffd700;">Loading Concentration Data...</td></tr></tbody>`;
        }

        container.innerHTML = `
            <div class="overview-container">
                <table class="ov-table">
                    <thead><tr>${theadHtml}</tr></thead>
                    ${tbodyHtml}
                </table>
            </div>
        `;

        if (this.activeTab === 'concentration') {
            setTimeout(() => {
                if (typeof ProfOverviewConcentration !== 'undefined' && ProfOverviewConcentration.init) {
                    ProfOverviewConcentration.init();
                }
            }, 50);
        }
    },

    filterRows: function(query) {
        const term = query.toLowerCase();

        if (this.activeTab === 'farming') {
            const rows = document.querySelectorAll('.ov-row');
            rows.forEach(row => {
                const groupTitle = row.querySelector('.group-title') ? row.querySelector('.group-title').innerText.toLowerCase() : '';
                const profBadge = row.querySelector('.prof-badge') ? row.querySelector('.prof-badge').innerText.toLowerCase() : '';
                const detailsRow = row.nextElementSibling;
                
                if (groupTitle.includes(term) || profBadge.includes(term)) {
                    row.style.display = '';
                    if(detailsRow && row.classList.contains('show')) detailsRow.style.display = ''; 
                } else {
                    row.style.display = 'none';
                    if(detailsRow) detailsRow.style.display = 'none';
                }
            });
        } else {
            const rows = document.querySelectorAll('.conc-row');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        }
    },

    fmt: function(n) {
        if (isNaN(n) || !n || n === 0) return '0 <img src="gold.jpg" style="width:12px; vertical-align:-2px; border-radius:50%;">';
        let val = (n < 100) ? n.toFixed(1) : Math.floor(n).toLocaleString();
        const icon = (typeof GOLD_ICON !== 'undefined') ? GOLD_ICON : 'gold.jpg';
        return `${val} <img src="${icon}" style="width:12px; vertical-align:-2px; border-radius:50%;">`;
    },

    getQualityIcon: function(tier) {
        if(!tier) return '';
        return `<img src="tier${tier}.png" class="q-icon">`;
    },

    toggle: function(id) {
        const wrapper = document.getElementById(id);
        const cell = wrapper.parentElement;
        const row = cell.parentElement;
        const mainRow = row.previousElementSibling;

        if (row.classList.contains('show')) {
            wrapper.style.overflow = 'hidden'; 
            wrapper.classList.remove('open');
            mainRow.classList.remove('expanded');
            setTimeout(() => {
                if(!wrapper.classList.contains('open')) row.classList.remove('show');
            }, 400); 
        } else {
            row.classList.add('show');
            mainRow.classList.add('expanded');
            setTimeout(() => {
                wrapper.classList.add('open');
                setTimeout(() => {
                    if (wrapper.classList.contains('open')) {
                        wrapper.style.overflow = 'visible'; 
                    }
                }, 400);
            }, 10);
        }
    },

    generateFarmingRows: function() {
        if (typeof OVERVIEW_DB === 'undefined') return '<tr><td colspan="3" style="padding:20px; text-align:center;">No farming data loaded.</td></tr>';

        let groupDataArray = [];

        for (const [profName, groups] of Object.entries(OVERVIEW_DB)) {
            const badgeColor = (typeof PROF_COLORS !== 'undefined' && PROF_COLORS[profName]) ? PROF_COLORS[profName] : '#333';

            groups.forEach((group, gIdx) => {
                const groupTitle = group.groupName || "Unnamed Group";
                const groupDisTime = group.disTime || 0; 

                let groupIconHtml = group.icon ? `<img src="${group.icon}" class="group-icon">` : '';

                let cardsHtml = '';
                let maxProfitPerCraft = -Infinity; 
                let maxGPH = 0; 

                if (group.recipes) {
                    group.recipes.forEach((method, rIdx) => {
                        const dbItem = PRICES[method.item] || { price: 0, icon: DEF_ICON };
                        const cardColor = method.color || '#ffd700';
                        const baseCraftTime = method.craftTime || 0; 
                        const timePenalty = (method.timePenalty !== undefined) ? method.timePenalty : 0;
                        const isGathering = method.isGathering || false;

                        let cardTitle = method.item;
                        let mainIcon = method.customIcon || dbItem.icon || DEF_ICON;

                        let baseCraftCost = 0;
                        let reagentsHtml = '';
                        let activeReagentsForStats = [];

                        if (method.reagents && method.reagents.length > 0) {
                            reagentsHtml += `<div class="section-label">INPUTS</div>`;
                            reagentsHtml += `<div class="reagents-scroll-wrapper">`;

                            let cheapestIdx = -1;
                            let minCost = Infinity;

                            method.reagents.forEach((reg, idx) => {
                                if (reg.pickCheapestReagent) {
                                    const pItem = PRICES[reg.name] || {};
                                    const price = pItem.price || 0;
                                    const total = price * reg.count;
                                    
                                    if (total < minCost) {
                                        minCost = total;
                                        cheapestIdx = idx;
                                    }
                                }
                            });

                            // [ОНОВЛЕНО] Перевірка прапорця method.keepMainIcon
                            if (cheapestIdx !== -1 && !method.customIcon && !method.keepMainIcon) {
                                const cName = method.reagents[cheapestIdx].name;
                                cardTitle = cName;
                                mainIcon = (PRICES[cName] || {}).icon || DEF_ICON;
                            } 

                            method.reagents.forEach((reg, idx) => {
                                const regData = PRICES[reg.name] || {};
                                const regPrice = regData.price || 0; 
                                const regIcon = regData.icon || DEF_ICON; 
                                const totalRegCost = regPrice * reg.count;
                                
                                let displayName = reg.name;
                                let tierHtml = '';
                                const match = displayName.match(/ [tq]([1-3])/i);
                                if (match) {
                                    tierHtml = this.getQualityIcon(match[1]);
                                    displayName = displayName.replace(match[0], '').trim();
                                }

                                let isActive = true;
                                let highlightClass = "";

                                if (reg.pickCheapestReagent) {
                                    if (idx === cheapestIdx) {
                                        highlightClass = "cheapest-highlight"; 
                                    } else {
                                        isActive = false; 
                                        highlightClass = "dimmed-reagent";
                                    }
                                }

                                reagentsHtml += `
                                    <div class="mini-reg ${highlightClass}">
                                        <img src="${regIcon}" class="mini-reg-icon">
                                        <div class="mini-reg-info">
                                            <div class="mini-reg-name">${displayName}${tierHtml}</div>
                                            <div class="mini-reg-sub">${reg.count}x</div>
                                        </div>
                                        <div class="mini-reg-price">-${this.fmt(totalRegCost)}</div>
                                    </div>`;

                                if (isActive) {
                                    baseCraftCost += totalRegCost;
                                    activeReagentsForStats.push({ ...reg, total: totalRegCost }); 
                                }
                            });
                            
                            reagentsHtml += `</div>`;
                        }

                        let cardTierHtml = '';
                        const titleMatch = cardTitle.match(/ [tq]([1-3])/i);
                        if (titleMatch) {
                            cardTierHtml = this.getQualityIcon(titleMatch[1]);
                            cardTitle = cardTitle.replace(titleMatch[0], '').trim();
                        }

                        let totalRevenue = 0;
                        let outputsHtml = '';
                        if (method.outputs && method.outputs.length > 0) {
                            outputsHtml += `<div class="section-label" style="margin-top:12px;">YIELDS</div>`;
                            method.outputs.forEach(out => {
                                const outData = PRICES[out.name] || { price: 0, icon: DEF_ICON };
                                const outValue = outData.price * out.count; 
                                totalRevenue += outValue;
                                
                                let displayName = out.name;
                                let tierHtml = '';
                                const match = displayName.match(/ [tq]([1-3])/i);
                                if (match) {
                                    tierHtml = this.getQualityIcon(match[1]);
                                    displayName = displayName.replace(match[0], '').trim();
                                }
                                outputsHtml += `<div class="mini-out"><img src="${outData.icon}" class="mini-out-icon"><div class="mini-out-info"><div class="mini-out-name">${displayName}${tierHtml}</div><div class="mini-out-sub">${out.count}x avg</div></div><div class="mini-out-val">+${this.fmt(outValue)}</div></div>`;
                            });
                        } else {
                            totalRevenue = dbItem.price;
                        }

                        let resSavings = 0;
                        let statsHtml = '';
                        let bonusRows = '';
                        let craftSpeedPct = 0;
                        
                        if (method.stats && method.stats.length > 0) {
                            let statsRows = `<div class="stats-header">Stats</div>`;
                            const MULTI_BONUS_VAL = typeof MULTI_BONUS !== 'undefined' ? MULTI_BONUS : 2.5; 

                            method.stats.forEach(stat => {
                                statsRows += `<div class="stat-row"><span>${stat.name}</span><span class="stat-val">${stat.count}%</span></div>`;
                                
                                const sName = stat.name.toLowerCase();
                                const penalty = stat.statPenalty !== undefined ? stat.statPenalty : null;

                                if (sName.includes('speed')) craftSpeedPct = stat.count;

                                if (sName.includes('resourcefulness')) {
                                    let currentResSaving = 0;
                                    let resCapeFactor = stat.resourcefulnessCape !== undefined ? (stat.resourcefulnessCape / 100) : null;
                                    const finalPenalty = stat.statPenalty !== undefined ? stat.statPenalty : 1.0;

                                    activeReagentsForStats.forEach(reg => {
                                        const returnFactor = resCapeFactor !== null ? resCapeFactor : ((reg.count === 1) ? 1.0 : 0.5);
                                        currentResSaving += reg.total * (stat.count / 100) * returnFactor;
                                    });
                                    
                                    resSavings = currentResSaving * finalPenalty;
                                    if (resSavings > 0) bonusRows += `<div class="stat-row"><span>Res. Save</span><span class="stat-bonus">+${this.fmt(resSavings)}</span></div>`;
                                }
                                
                                if (sName.includes('multicraft')) {
                                    const finalPenalty = stat.statPenalty !== undefined ? stat.statPenalty : 0.8;
                                    const mBonus = stat.multiBonus !== undefined ? stat.multiBonus : MULTI_BONUS_VAL;
                                    const extra = ((stat.count / 100) * mBonus * totalRevenue) * finalPenalty; 
                                    if (extra > 0) bonusRows += `<div class="stat-row"><span>Multicraft (${finalPenalty * 100}%)</span><span class="stat-bonus">+${this.fmt(extra)}</span></div>`;
                                }

                                if (sName.includes('ingenuity')) {
                                    const finalPenalty = stat.statPenalty !== undefined ? stat.statPenalty : 0.8;
                                    const extra = ((stat.count / 100) * (profName.toUpperCase().includes("ENCHANTING") ? 1.0 : 0.5) * totalRevenue) * finalPenalty;
                                    if (extra > 0) bonusRows += `<div class="stat-row"><span>Ingenuity (${finalPenalty * 100}%)</span><span class="stat-bonus">+${this.fmt(extra)}</span></div>`;
                                }
                            });
                            
                            if(bonusRows) bonusRows = `<div class="avg-profit-header">Avg Savings / Bonus</div>` + bonusRows;
                            
                            let efficiencyRows = '';
                            let currentGPH = 0;

                            if (isGathering) {
                                const effectiveCost = baseCraftCost - resSavings;
                                const currentProfit = totalRevenue - effectiveCost;
                                currentGPH = currentProfit;

                                efficiencyRows = `
                                    <div class="avg-profit-header" style="color:#00ccff; border-top:1px dashed #444; margin-top:8px;">Yield</div>
                                    <div class="stat-row"><span>Yield Period</span><span class="stat-val">1 Hour</span></div>
                                    <div class="stat-row"><span>Est. GPH</span><span class="stat-bonus" style="color:#ffd700; font-size:13px;">${this.fmt(currentGPH)}</span></div>
                                `;
                            } else {
                                if ((baseCraftTime > 0 || groupDisTime > 0)) {
                                    let realCraftTime = baseCraftTime;
                                    if(craftSpeedPct > 0) {
                                        realCraftTime = baseCraftTime * (1 - (craftSpeedPct / 100));
                                        if(realCraftTime < 0) realCraftTime = 0;
                                    }
                                    const rawCycleTime = realCraftTime + groupDisTime;
                                    const totalCycleTime = rawCycleTime * (1 + (timePenalty / 100)); 
                                    
                                    if (totalCycleTime > 0) {
                                        const itemsPerHour = 3600 / totalCycleTime;
                                        const effectiveCost = baseCraftCost - resSavings;
                                        const currentProfit = totalRevenue - effectiveCost;
                                        currentGPH = currentProfit * itemsPerHour;

                                        efficiencyRows = `
                                            <div class="avg-profit-header" style="color:#00ccff; border-top:1px dashed #444; margin-top:8px;">Efficiency</div>
                                            <div class="stat-row"><span>Cycle Time (+${timePenalty}%)</span><span class="stat-val">${totalCycleTime.toFixed(1)}s</span></div>
                                            <div class="stat-row"><span>Cycles/Hr</span><span class="stat-val">${Math.floor(itemsPerHour).toLocaleString()}</span></div>
                                            <div class="stat-row"><span>Exp. GPH</span><span class="stat-bonus" style="color:#ffd700; font-size:13px;">${this.fmt(currentGPH)}/hr</span></div>
                                        `;
                                    }
                                }
                            }
                            if (currentGPH > maxGPH) maxGPH = currentGPH;
                            statsHtml = `<div class="cu-divider"></div><div class="stats-section">${statsRows}${bonusRows}${efficiencyRows}</div>`;
                        }

                        const effectiveCost = baseCraftCost - resSavings;
                        const profit = totalRevenue - effectiveCost;
                        
                        const displayProfitValue = isGathering ? maxGPH : profit;

                        if (displayProfitValue > maxProfitPerCraft) maxProfitPerCraft = displayProfitValue;
                        const profitClass = displayProfitValue >= 0 ? 'p-pos' : 'p-neg';

                        const modalBtnHtml = (method.moreInfo && method.moreInfo.length > 0) 
                            ? `<div class="po-info-btn" onclick="event.stopPropagation(); ProfOverview.openModal('${profName.replace(/'/g, "\\'")}', ${gIdx}, ${rIdx})" title="More Info">i</div>` 
                            : '';

                        let hoverTitle = method.item;
                        cardsHtml += `
                            <div class="craft-unit" style="border-color: ${cardColor};">
                                ${modalBtnHtml}
                                <div class="cu-left">
                                    <div class="cu-left-top">
                                        <img src="${mainIcon}" class="cu-icon" style="border-color: ${cardColor};">
                                        <div class="cu-title" title="${hoverTitle}">${cardTitle}${cardTierHtml}</div>
                                        <div class="cu-stat"><span class="cu-label">Cost</span><span class="cu-val val-cost">${this.fmt(effectiveCost)}</span></div>
                                        <div class="cu-stat"><span class="cu-label">Revenue</span><span class="cu-val val-rev">${this.fmt(totalRevenue)}</span></div>
                                        <div class="cu-stat" style="margin-top:8px; border-top:1px solid #444; padding-top:5px;">
                                            <span class="cu-label">Net Profit</span><span class="cu-val ${profitClass}" style="font-size:16px;">${this.fmt(displayProfitValue)}</span>
                                        </div>
                                    </div>
                                    ${statsHtml}
                                </div>
                                <div class="cu-right">${reagentsHtml}${outputsHtml}</div>
                            </div>
                        `;
                    });
                }

                let sortValue = -99999999;
                if (maxGPH > 0) sortValue = maxGPH;
                else if (maxProfitPerCraft > -Infinity) sortValue = maxProfitPerCraft;

                let displayVal = 'N/A';
                if (maxGPH > 0) displayVal = `Up to <span style="color:#ffd700;">${this.fmt(maxGPH)}</span> / hr`;
                else if (maxProfitPerCraft > -Infinity) {
                    const color = maxProfitPerCraft >= 0 ? 'var(--green)' : '#f44';
                    displayVal = `Up to <span style="color:${color};">${this.fmt(maxProfitPerCraft)}</span> (craft)`;
                }
                
                const rowId = `group-${profName}-${gIdx}`.replace(/\s/g, '');

                const groupHtml = `
                    <tr class="ov-row" onclick="ProfOverview.toggle('${rowId}')">
                        <td>
                            <div class="group-cell-content">
                                ${groupIconHtml}
                                <div class="group-info">
                                    <div class="group-title">${groupTitle}</div>
                                    <div class="group-sub">${group.recipes ? group.recipes.length : 0} items monitored</div>
                                </div>
                            </div>
                        </td>
                        <td class="prof-badge-cell">
                            <span class="prof-badge" style="background: ${badgeColor};">${profName}</span>
                        </td>
                        <td><div class="profit-val">${displayVal}</div></td>
                    </tr>
                    <tr class="ov-details-row">
                        <td colspan="3" class="ov-details-cell">
                            <div id="${rowId}" class="ov-expand-wrapper">
                                <div class="cards-container">${cardsHtml}</div>
                            </div>
                        </td>
                    </tr>
                `;

                groupDataArray.push({ html: groupHtml, sortVal: sortValue });
            });
        }

        groupDataArray.sort((a, b) => b.sortVal - a.sortVal);

        return groupDataArray.map(item => item.html).join('');
    }
};