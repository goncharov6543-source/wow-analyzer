const fs = require('fs');
const path = require('path');

// ==========================================
// 1. НАЛАШТУВАННЯ
// ==========================================
const CLIENT_ID = process.env.CLIENT_ID || 'твій_локальний_id'; 
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'твій_локальний_секрет'; 
const REGION = 'eu';
const REALM_SLUG = 'tarren-mill';

const RES_FACTOR = 0.5; 
const MULTI_BONUS = 2; 
const HISTORY_LIMIT = 4320; 
const DEFAULT_PROF_COLOR = "linear-gradient(90deg, #333 0%, #555 100%)"; 

// Шляхи до файлів
const recipesPath = path.join(__dirname, 'recipes.json');
const traitsPath = path.join(__dirname, 'TalentTraits.json'); 
const reagentsDbPath = path.join(__dirname, 'reagents.json');
const historyPath = path.join(__dirname, 'price_history.json'); 
const ignoreListPath = path.join(__dirname, 'profIgnoreList.json');
const colorsPath = path.join(__dirname, 'profColors.json');
const overviewDbPath = path.join(__dirname, 'profOverviewDataBase.json');
const reagentsPath = path.join(__dirname, 'reagents.js');
const profOverviewPath = path.join(__dirname, 'profOverview.js');

const concDbPath = path.join(__dirname, 'profOverviewConcentrationDataBase.json');
const concScriptPath = path.join(__dirname, 'profOverviewConcentration.js');

let recipesArray = [];
let traitsDB = {}; 
let reagentsDB = {};
let historyDB = {}; 
let overviewDB = {}; 
let IGNORE_LIST = [];
let PROF_COLORS = {};
let reagentsScript = "";
let profOverviewScript = "";

let concLogicScript = "";  
let concDataArray = []; 

// Завантаження файлів
try { const rawData = JSON.parse(fs.readFileSync(recipesPath, 'utf8')); recipesArray = Array.isArray(rawData) ? rawData : [rawData]; } catch (e) {}
try { traitsDB = JSON.parse(fs.readFileSync(traitsPath, 'utf8')); } catch (e) {}
try { reagentsDB = JSON.parse(fs.readFileSync(reagentsDbPath, 'utf8')); } catch (e) {}
try { if (fs.existsSync(historyPath)) { historyDB = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } } catch (e) { historyDB = {}; }
try { IGNORE_LIST = JSON.parse(fs.readFileSync(ignoreListPath, 'utf8')); } catch (e) { IGNORE_LIST = []; }
try { PROF_COLORS = JSON.parse(fs.readFileSync(colorsPath, 'utf8')); } catch (e) { PROF_COLORS = {}; }
try { overviewDB = JSON.parse(fs.readFileSync(overviewDbPath, 'utf8')); } catch (e) { overviewDB = {}; }

try { 
    concDataArray = JSON.parse(fs.readFileSync(concDbPath, 'utf8')); 
    console.log(`✅ Loaded ${concDataArray.length} concentration items.`);
} catch(e) { 
    console.log("⚠️ Conc DB not found or invalid JSON"); 
    concDataArray = [];
}

try { concLogicScript = fs.readFileSync(concScriptPath, 'utf8'); } catch(e) { console.log("Conc Logic not found"); }
try { reagentsScript = fs.readFileSync(reagentsPath, 'utf8'); } catch(e) {}
try { profOverviewScript = fs.readFileSync(profOverviewPath, 'utf8'); } catch(e) {}

let pricesDB = {};
let lotsDB = {}; 

function cleanId(rawId) { if (!rawId) return null; return parseInt(String(rawId).split('-')[0]); }

// API Функції
async function getAccessToken() {
    if (!CLIENT_ID || !CLIENT_SECRET) return null;
    try {
        const res = await fetch('https://oauth.battle.net/token', { method: 'POST', body: 'grant_type=client_credentials', headers: { 'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' } });
        return (await res.json()).access_token;
    } catch (e) { return null; }
}
async function fetchItemMedia(itemId, token) {
    try {
        const res = await fetch(`https://${REGION}.api.blizzard.com/data/wow/media/item/${itemId}?namespace=static-${REGION}&locale=en_US`, { headers: { Authorization: `Bearer ${token}` } });
        if(!res.ok) return null;
        return (await res.json()).assets[0].value; 
    } catch (e) { return null; }
}

function addLot(id, price, qty, rawMap) {
    if (!rawMap[id]) rawMap[id] = [];
    rawMap[id].push({ p: price / 10000, q: qty });
}

function processLotsAndSafePrice(rawMap) {
    const results = {};
    for (const [id, lots] of Object.entries(rawMap)) {
        lots.sort((a, b) => a.p - b.p);
        let safePrice = 0;
        let totalQty = 0;
        lots.forEach(lot => totalQty += lot.q);
        if (lots.length > 0) {
            let p1 = lots[0].p;
            if (lots.length > 1) {
                let p2 = lots[1].p;
                if (p2 >= p1 * 2) safePrice = p2; else safePrice = p1;
            } else { safePrice = p1; }
        }
        lotsDB[id] = lots.slice(0, 10);
        results[id] = { price: safePrice, qty: totalQty };
    }
    return results;
}

// ОСНОВНА ФУНКЦІЯ ОТРИМАННЯ ДАНИХ
async function fetchAuctionData() {
    const token = await getAccessToken();
    if (!token) return;
    const rawLotsMap = {}; const trackedIDs = new Set();
    
    recipesArray.forEach(r => { if(r.id) trackedIDs.add(r.id); if(r.recipe) r.recipe.forEach(reg => trackedIDs.add(reg.id)); });
    for(const cat in reagentsDB) { reagentsDB[cat].forEach(i => trackedIDs.add(i.id)); }
    for(const prof in overviewDB) { overviewDB[prof].forEach(group => { if(group.recipes) { group.recipes.forEach(entry => { if(entry.id) trackedIDs.add(cleanId(entry.id)); if(entry.reagents) { entry.reagents.forEach(r => { if(r.id) trackedIDs.add(cleanId(r.id)); }); } if(entry.outputs) { entry.outputs.forEach(o => { if(o.id) trackedIDs.add(cleanId(o.id)); }); } }); } }); }
    
    concDataArray.forEach(item => {
        if(item.id) trackedIDs.add(cleanId(item.id));
        if(item.recipe) {
            item.recipe.forEach(r => {
                if(r.id) trackedIDs.add(cleanId(r.id));
            });
        }
    });

    try {
        console.log(`🌍 [API] Connecting...`);
        const idxReq = await fetch(`https://${REGION}.api.blizzard.com/data/wow/realm/index?namespace=dynamic-${REGION}&locale=en_US`, { headers: { Authorization: `Bearer ${token}` }});
        const realm = (await idxReq.json()).realms?.find(r => r.slug === REALM_SLUG);
        if (realm) {
            const detail = await (await fetch(realm.key.href, { headers: { Authorization: `Bearer ${token}` } })).json();
            const connectedId = detail.connected_realm.href.match(/connected-realm\/(\d+)/)[1];
            const localData = await (await fetch(`https://${REGION}.api.blizzard.com/data/wow/connected-realm/${connectedId}/auctions?namespace=dynamic-${REGION}&locale=en_US`, { headers: { Authorization: `Bearer ${token}` }})).json();
            (localData.auctions || []).forEach(auc => { if (trackedIDs.has(auc.item.id)) { const p = auc.buyout || auc.unit_price || 0; if(p > 0) addLot(auc.item.id, p, auc.quantity, rawLotsMap); } });
        }
        const commData = await (await fetch(`https://${REGION}.api.blizzard.com/data/wow/auctions/commodities?namespace=dynamic-${REGION}&locale=en_US`, { headers: { Authorization: `Bearer ${token}` }})).json();
        (commData.auctions || []).forEach(auc => { if (trackedIDs.has(auc.item.id)) { const p = auc.unit_price || 0; if(p > 0) addLot(auc.item.id, p, auc.quantity, rawLotsMap); } });

        const finalData = processLotsAndSafePrice(rawLotsMap);
        
        console.log("📈 Updating History...");
        const timestamp = Date.now();
        let updatedCount = 0;
        const updateSafe = (name, price, qty) => { const added = updateHistoryItem(name, price, qty, timestamp); if(added) updatedCount++; };

        for (const cat in reagentsDB) { for (const item of reagentsDB[cat]) { if (finalData[item.id]) updateSafe(item.name, finalData[item.id].price, finalData[item.id].qty); } }
        for(const prof in overviewDB) { overviewDB[prof].forEach(group => { if(group.recipes) { group.recipes.forEach(entry => { const mainId = cleanId(entry.id); if(mainId && finalData[mainId]) updateSafe(entry.item, finalData[mainId].price, finalData[mainId].qty); if(entry.reagents) { entry.reagents.forEach(r => { const regId = cleanId(r.id); if(regId && finalData[regId]) updateSafe(r.name, finalData[regId].price, finalData[regId].qty); }); } if(entry.outputs) { entry.outputs.forEach(o => { const outId = cleanId(o.id); if(outId && finalData[outId]) updateSafe(o.name, finalData[outId].price, finalData[outId].qty); }); } }); } }); }

        concDataArray.forEach(item => {
            const mainId = cleanId(item.id);
            if(mainId && finalData[mainId]) updateSafe(item.name, finalData[mainId].price, finalData[mainId].qty);
            if(item.recipe) {
                item.recipe.forEach(r => {
                    const rId = cleanId(r.id);
                    if(rId && finalData[rId]) updateSafe(r.name, finalData[rId].price, finalData[rId].qty);
                });
            }
        });

        if (updatedCount > 0) fs.writeFileSync(historyPath, JSON.stringify(historyDB));

        console.log("🎨 [Icons] Fetching...");
        const lotsByName = {};
        const ensureItemData = async (id, name) => { const safeId = cleanId(id); if (!safeId) return; if (!pricesDB[name]) pricesDB[name] = {}; if (finalData[safeId]) pricesDB[name].price = finalData[safeId].price; if (!pricesDB[name].icon) { const icon = await fetchItemMedia(safeId, token); if(icon) pricesDB[name].icon = icon; } if(lotsDB[safeId]) lotsByName[name] = lotsDB[safeId]; };

        for (const r of recipesArray) { if (r.id) await ensureItemData(r.id, r.name); if (r.recipe) for (const reg of r.recipe) if (reg.id) await ensureItemData(reg.id, reg.name); }
        for (const cat in reagentsDB) { for (const item of reagentsDB[cat]) { await ensureItemData(item.id, item.name); } }
        for(const prof in overviewDB) { for(const group of overviewDB[prof]) { if(group.recipes) { for(const entry of group.recipes) { if(entry.id) await ensureItemData(entry.id, entry.item); if(entry.reagents) { for(const r of entry.reagents) if(r.id) await ensureItemData(r.id, r.name); } if(entry.outputs) { for(const o of entry.outputs) if(o.id) await ensureItemData(o.id, o.name); } } } } }

        for (const item of concDataArray) {
            if(item.id) await ensureItemData(item.id, item.name);
            if(item.recipe) {
                for (const r of item.recipe) {
                    if(r.id) await ensureItemData(r.id, r.name);
                }
            }
        }

        lotsDB = lotsByName;
        console.log(`✅ [Done] Ready.`);
    } catch (e) { console.error("❌ [Error]", e); }
}

function updateHistoryItem(name, price, qty, timestamp) {
    if (!historyDB[name]) historyDB[name] = [];
    const arr = historyDB[name];
    const lastEntry = arr[arr.length - 1];
    if (lastEntry) {
        const timeDiff = timestamp - lastEntry.t;
        if (timeDiff < 3600000) { lastEntry.p = price; lastEntry.q = qty; lastEntry.t = timestamp; return true; }
    }
    arr.push({ t: timestamp, p: price, q: qty || 0 });
    if (arr.length > HISTORY_LIMIT) arr.shift();
    return true;
}

// ==========================================
// ГЕНЕРАЦІЯ HTML
// ==========================================
async function main() {
    await fetchAuctionData();

    const pricesJson = JSON.stringify(pricesDB);
    const recipesJson = JSON.stringify(recipesArray);
    const traitsJson = JSON.stringify(traitsDB);
    const reagentsDbJson = JSON.stringify(reagentsDB);
    const historyJson = JSON.stringify(historyDB);
    const lotsJson = JSON.stringify(lotsDB);
    const profColorsJson = JSON.stringify(PROF_COLORS);
    const defaultColorJson = JSON.stringify(DEFAULT_PROF_COLOR);
    const ignoreListJson = JSON.stringify(IGNORE_LIST);
    const overviewDbJson = JSON.stringify(overviewDB);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>WoW Analyzer</title>
        <link rel="icon" type="image/png" href="gold.jpg">
        <script src="https://wow.zamimg.com/js/tooltips.js"></script>
        <style>
            :root { --bg: #121212; --panel: #1e1e1e; --border: #333; --gold: #ffd700; --blue: #0070dd; --green: #00ff99; --red: #ff4444; }
            html { scrollbar-gutter: stable; } 

            body { background-color: var(--bg); color: #e0e0e0; font-family: 'Segoe UI', sans-serif; padding: 25px; margin: 0; font-size: 16px; }
            
            /* DARK THIN SCROLLBARS */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #1a1a1a; }
            ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #444; }

            a { color: #fff; text-decoration: none; }

            .fade-in { animation: fadeIn 0.4s ease-in-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

            .top-bar { display: flex; align-items: center; margin-bottom: 25px; gap: 20px; flex-wrap: wrap; justify-content: space-between; }
            
            .char-chip { 
                position: relative; display: flex; align-items: center; background: var(--panel); 
                padding: 6px 1px 6px 6px; border-radius: 50px; border: 2px solid var(--border); 
                box-shadow: 0 4px 10px rgba(0,0,0,0.4); cursor: pointer; transition: 0.2s; user-select: none; 
                margin-right: 15px; margin-top: 5px; margin-bottom: 5px;
                min-width: 220px; /* Ensure space for icons */
                justify-content: space-between; 
            }
            .char-chip:hover { border-color: #666; }
            .char-chip.active { border-color: var(--blue); background: #252525; }
            
            .char-chip-main { display: flex; align-items: center; flex-grow: 1; margin-right: 15px; }
            .char-chip img.cls-icon { width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--gold); margin-right: 10px; object-fit: cover; }
            
            .chip-info { display: flex; flex-direction: column; }
            .chip-name { font-weight: bold; color: #fff; font-size: 15px; line-height: 1.2; }
            .chip-realm { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }

            .char-prof-wrapper { display: flex; gap: 5px; margin-right: 10px; }
            .prof-icon-round { width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--gold); object-fit: cover; background: #000; }

            .circle-btn {
                position: absolute; width: 22px; height: 22px; border-radius: 50%; 
                display: flex; align-items: center; justify-content: center;
                font-size: 13px; font-weight: bold; cursor: pointer; line-height: 1;
                opacity: 0; transition: 0.2s; border: 2px solid var(--bg); z-index: 20;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5); flex-shrink: 0;
            }
            .char-chip:hover .circle-btn { opacity: 1; }
            .delete-char { right: -6px; top: -6px; background: var(--red); color: white; padding-bottom: 2px; }
            .edit-char { left: -6px; top: -6px; background: var(--blue); color: white; font-size: 12px; }
            
            .add-btn-small { width: 40px; height: 40px; background: var(--blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; cursor: pointer; transition: 0.2s; border: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }

            .nav-bar { display: flex; gap: 15px; margin-left: auto; }
            .nav-btn {
                background: transparent; border: 2px solid #444; color: #888;
                padding: 10px 25px; font-weight: bold; font-size: 14px; cursor: pointer;
                transition: 0.2s; text-transform: uppercase; border-radius: 4px; letter-spacing: 1px;
            }
            .nav-btn:hover { border-color: #777; color: #fff; }
            .nav-btn.active { background: var(--blue); border-color: var(--blue); color: #fff; box-shadow: 0 0 15px rgba(0, 112, 221, 0.3); }

            #view-reagents { display: block; }
            #view-dashboard, #view-profOverview { display: none; margin-top: 20px; }
            
            #dashboard-controls { 
                display: flex; 
                align-items: center; 
                min-height: 56px; 
                opacity: 0; 
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease; 
            }
            #dashboard-controls.visible {
                opacity: 1;
                visibility: visible;
            }

            .prof-section { margin-bottom: 30px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #151515; }
            .reagent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; padding: 20px; }
            .chart-bg { position: absolute; bottom: 0; left: 0; width: 100%; height: 100%; z-index: 0; opacity: 0.25; pointer-events: none; }
            .reagent-card { position: relative; z-index: 1; }
            .r-info, .r-icon-wrapper { position: relative; z-index: 2; } 

            #big-add-container { display: flex; justify-content: center; align-items: center; height: 70vh; flex-direction: column; gap: 20px; }
            .big-plus-btn { width: 140px; height: 140px; border-radius: 50%; background: var(--panel); border: 2px dashed #555; color: #555; font-size: 70px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
            .big-plus-btn:hover { border-color: var(--blue); color: var(--blue); transform: scale(1.1); box-shadow: 0 0 30px rgba(0, 112, 221, 0.2); }

            .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
            .modal-box { background: var(--panel); padding: 40px; border-radius: 12px; width: 800px; border: 1px solid var(--border); box-shadow: 0 10px 40px rgba(0,0,0,0.7); position: relative; }
            .modal-title { font-size: 24px; font-weight: bold; margin-bottom: 25px; color: #fff; text-align: center; }
            .input-group { margin-bottom: 20px; }
            .input-label { font-size: 14px; color: #aaa; text-transform: uppercase; margin-bottom: 8px; display: block; }
            textarea { width: 100%; height: 100px; background: #111; border: 1px solid #333; color: var(--green); padding: 12px; font-family: monospace; border-radius: 6px; resize: none; box-sizing: border-box; font-size: 14px; }
            .import-btn { width: 100%; padding: 15px; background: var(--blue); color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 18px; cursor: pointer; margin-top: 15px; }
            .close-modal { position: absolute; top: 20px; right: 25px; color: #888; font-size: 28px; font-weight: bold; cursor: pointer; transition: 0.2s; line-height: 1; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
            .close-modal:hover { color: #fff; background: rgba(255,255,255,0.1); }

            .dashboard-grid { display: none; grid-template-columns: 1fr 1fr; gap: 25px; align-items: start; }
            .prof-column { background: var(--panel); border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
            .prof-header { background: #252525; padding: 18px; font-weight: bold; text-transform: uppercase; color: var(--gold); text-align: center; border-bottom: 1px solid var(--border); font-size: 16px; letter-spacing: 1px; }

            table { width: 100%; border-collapse: collapse; }
            
            th, td { border-bottom: 1px solid #333; }
            
            th:first-child, td:first-child { 
                text-align: left; 
                padding: 12px 15px; 
                width: auto; 
            }
            
            th:not(:first-child), td:not(:first-child) {
                width: 1%;
                white-space: nowrap;
                padding: 12px 25px 12px 15px;
                text-align: right;
            }

            th { background: #222; color: #aaa; font-size: 13px; text-transform: uppercase; cursor: default; user-select: none; }
            th.sortable:hover { color: #fff; background: #2a2a2a; cursor: pointer; }
            th:not(.sortable):hover { background: #222; }

            td { vertical-align: middle; font-size: 16px; }
            tr.main-row { cursor: pointer; transition: 0.1s; }
            tr.main-row:hover { background: #2a2a2a; }
            .item-cell { display: flex; align-items: center; gap: 12px; }
            .item-icon { width: 40px; height: 40px; border-radius: 4px; border: 1px solid #444; }
            .coin-icon { width: 18px; height: 18px; vertical-align: -3px; margin-left: 5px; border-radius: 50%; }
            .gold-txt { color: var(--gold); font-weight: 500; font-size: 15px; }
            .profit-pos { color: var(--green); font-weight: bold; }
            .profit-neg { color: #ff4444; }
            .conc-col { color: #00ccff; font-weight: bold; font-size: 14px; }

            .char-header-block { display: flex; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #333; }
            .char-header-block img { width: 64px; height: 64px; border-radius: 50%; margin-right: 20px; border: 3px solid var(--gold); }
            .char-header-info { display: flex; flex-direction: column; }
            .char-header-name { font-size: 24px; font-weight: bold; color: #fff; }
            .char-header-server { font-size: 14px; color: #999; text-transform: uppercase; }
            .trait-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            
            .trait-column { background: #151515; padding: 20px; border-radius: 8px; border: 1px solid #333; height: auto; }
            
            .trait-header { font-weight: bold; color: var(--gold); margin-bottom: 15px; text-align: center; text-transform: uppercase; font-size: 18px; }
            .skill-container { margin-bottom: 20px; }
            .skill-labels { display: flex; justify-content: space-between; font-size: 14px; color: #ccc; margin-bottom: 6px; }
            .skill-bar-bg { height: 10px; background: #222; border-radius: 5px; overflow: hidden; border: 1px solid #444; }
            .skill-bar-fill { height: 100%; background: var(--blue); width: 0%; transition: width 0.5s; }
            .trait-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #333; font-size: 15px; }
            .trait-left { display: flex; align-items: center; gap: 10px; }
            .trait-icon { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #444; }
            .trait-rank { color: var(--green); font-weight: bold; font-family: monospace; font-size: 16px; }

            tr.details-row { visibility: collapse; }
            tr.details-row.open { visibility: visible; }
            .details-container { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; background: #151515; border-bottom: 1px solid #333; }
            .details-container.active { max-height: 700px; }
            .details-wrapper { padding: 20px; display: flex; gap: 25px; border-left: 5px solid var(--blue); }
            .stats-col, .reagents-col { flex: 1; }
            .stat-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; border-bottom: 1px dashed #333; padding-bottom: 3px; }
            .reagent-item { display: flex; justify-content: space-between; padding: 6px; background: #222; margin-bottom: 6px; border-radius: 4px; font-size: 14px; }
            .reagent-left { display: flex; align-items: center; gap: 10px; }

            /* --- DASHBOARD HEADER --- */
            .dash-search-container { display: flex; align-items: center; gap: 8px; width: 100%; }
            .dash-search-input { 
                width: 140px; background: #121212; border: 1px solid #444; border-radius: 4px; 
                padding: 6px 10px; color: #fff; font-size: 13px; outline: none; transition: 0.2s; 
            }
            .dash-search-input:focus { border-color: var(--gold); }
            .setup-btn { 
                background: #333; border: 1px solid #555; color: #ccc; border-radius: 4px; 
                padding: 5px 12px; cursor: pointer; font-size: 12px; font-weight: bold; text-transform: uppercase;
                transition: 0.2s; white-space: nowrap;
            }
            .setup-btn:hover { background: #444; color: #fff; border-color: #777; }

            /* --- SETUP MODAL --- */
            .setup-header-row { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 25px; }
            .setup-label { color: #aaa; font-size: 16px; text-transform: uppercase; font-weight: bold; }
            .setup-input { 
                width: 80px; height: 35px; background: #111; border: 1px solid #444; color: var(--gold); 
                padding: 0 10px; text-align: center; font-size: 18px; font-weight: bold; border-radius: 6px; 
                box-sizing: border-box; -moz-appearance: textfield;
            }
            .setup-input::-webkit-outer-spin-button,
            .setup-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            
            .setup-gen-btn { 
                height: 35px; background: var(--blue); color: white; border: none; padding: 0 20px; 
                border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; box-sizing: border-box; display: flex; align-items: center;
            }
            .setup-gen-btn:hover { filter: brightness(1.2); }
            
            .setup-results { 
                margin-top: 20px; border-top: 1px solid #333; 
                padding: 20px 25px;
                max-height: 400px; overflow-y: auto; overflow-x: hidden; 
            }
            
            .setup-row { 
                position: relative; display: flex; align-items: center; justify-content: space-between; 
                background: #222; padding: 10px 15px; margin-bottom: 12px; border-radius: 6px; border: 1px solid #333; 
                transition: background 0.2s;
            }
            .setup-row:hover { background: #2a2a2a; }
            .setup-item-info { display: flex; align-items: center; gap: 12px; }
            .setup-count-badge { 
                background: var(--gold); color: #000; font-weight: bold; padding: 4px 10px; 
                border-radius: 4px; font-size: 14px; min-width: 30px; text-align: center; 
            }
            
            .action-badge { 
                position: absolute; width: 22px; height: 22px; border-radius: 50%; 
                display: flex; align-items: center; justify-content: center; cursor: pointer; 
                color: white; font-weight: bold; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                opacity: 0; transition: opacity 0.2s, transform 0.2s; z-index: 100;
            }
            .setup-row:hover .action-badge { opacity: 1; }
            .action-badge:hover { transform: scale(1.1); }
            
            .action-badge.edit { top: -8px; left: -8px; background: var(--blue); border: 2px solid var(--bg); }
            .action-badge.del { top: -8px; right: -8px; background: var(--red); border: 2px solid var(--bg); }

            .add-recipe-row {
                border: 2px dashed #444; border-radius: 6px; padding: 12px; text-align: center; 
                color: #777; cursor: pointer; transition: 0.2s; font-weight: bold; margin-top: 15px;
                text-transform: uppercase; font-size: 13px; letter-spacing: 1px;
            }
            .add-recipe-row:hover { border-color: var(--blue); color: var(--blue); background: rgba(0, 112, 221, 0.05); }

            .recipe-dropdown {
                position: fixed; /* Fixed position */
                background: #252525; border: 1px solid #444; border-radius: 6px;
                width: 300px; max-height: 250px; overflow-y: auto; z-index: 2000;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: none;
            }
            
            .rd-search-container { position: sticky; top: 0; background: #252525; padding: 8px; border-bottom: 1px solid #444; z-index: 10; }
            .rd-search-input { 
                width: 100%; box-sizing: border-box; background: #151515; border: 1px solid #444; 
                padding: 6px 8px; color: #fff; font-size: 12px; border-radius: 4px; outline: none;
            }
            .rd-search-input:focus { border-color: var(--blue); }

            .rd-item { 
                padding: 8px 12px; display: flex; align-items: center; gap: 10px; 
                cursor: pointer; border-bottom: 1px solid #333; 
            }
            .rd-item:hover { background: var(--blue); color: white; }
            .rd-item:last-child { border-bottom: none; }
            .rd-img { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #000; }
            .rd-name { font-size: 13px; font-weight: bold; }

            .setup-footer { 
                margin-top: 20px; border-top: 1px solid #333; padding-top: 20px; 
                display: flex; justify-content: center; 
            }
            .setup-import-btn {
                background: var(--green); color: #000; border: none; padding: 12px 30px;
                border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;
                transition: background-color 0.3s ease, transform 0.1s; 
            }
            .setup-import-btn:hover { filter: brightness(1.2); }
        </style>
        
        <script>
            ${concLogicScript}
            ${reagentsScript}
            ${profOverviewScript}

            const PRICES = ${pricesJson};   
            const RECIPES = ${recipesJson}; 
            const TRAITS_DB = ${traitsJson};
            const REAGENTS_DB = ${reagentsDbJson}; 
            const HISTORY = ${historyJson}; 
            const LOTS = ${lotsJson}; 
            const IGNORE = ${ignoreListJson};
            const PROF_COLORS = ${profColorsJson};
            const DEFAULT_PROF_COLOR = ${defaultColorJson};
            const OVERVIEW_DB = ${overviewDbJson}; 

            const CONCENTRATION_DB = ${JSON.stringify(concDataArray)};
            
            const DEF_ICON = 'https://render.worldofwarcraft.com/eu/icons/56/inv_misc_questionmark.jpg';
            const GOLD_ICON = 'gold.jpg';
            const DEF_TRAIT_ICON = 'https://render.worldofwarcraft.com/eu/icons/56/inv_inscription_talent_tome.jpg'; 
            const RES_FACTOR = 0.5; 
            const MULTI_BONUS = 2; 

            let savedCharacters = []; 
            let activeCharIndex = -1;
            let sortConfig = { col: 'profit', asc: false }; 
            let currentTab = 'reagents'; 
            
            let currentSetupRecipes = []; 
            let setupTotalChars = 0;
            let allProfRecipes = []; 
            let activeDropdownIndex = null; 

            window.onload = function() {
                const storedData = localStorage.getItem('wow_dashboard_chars');
                if(storedData) { savedCharacters = JSON.parse(storedData); }
                switchTab('reagents'); 
                
                document.addEventListener('click', function(e) {
                    const dd = document.getElementById('recipe-dropdown');
                    if(dd.style.display === 'block' && !e.target.closest('.action-badge') && !e.target.closest('.add-recipe-row') && !e.target.closest('.recipe-dropdown')) {
                        dd.style.display = 'none';
                    }
                });
            };

            function saveToStorage() { localStorage.setItem('wow_dashboard_chars', JSON.stringify(savedCharacters)); }

            function switchTab(tab) {
                currentTab = tab;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('btn-'+tab).classList.add('active');
                document.getElementById('view-reagents').style.display = 'none';
                document.getElementById('view-dashboard').style.display = 'none';
                document.getElementById('view-profOverview').style.display = 'none';
                
                const view = document.getElementById('view-'+tab);
                view.style.display = 'block';
                
                const dashControls = document.getElementById('dashboard-controls');
                if(tab === 'dashboard') { 
                    dashControls.classList.add('visible'); 
                } else { 
                    dashControls.classList.remove('visible'); 
                }
                
                view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in');
                if(tab === 'reagents' && typeof ReagentsScanner !== 'undefined') ReagentsScanner.init();
                if(tab === 'profOverview' && typeof ProfOverview !== 'undefined') ProfOverview.init(); 
                if(tab === 'dashboard' && savedCharacters.length > 0 && activeCharIndex === -1) loadCharacter(0);
            }

            function loadCharacter(index) {
                if(index < 0 || index >= savedCharacters.length) return;
                activeCharIndex = index;
                const charData = savedCharacters[index];
                document.getElementById('big-add-container').style.display = 'none';
                document.getElementById('dashboard-grid').style.display = 'grid';
                renderTopBar();
                renderTables(charData.p1, charData.p2, charData.profNames);
            }

            function processImport() {
                const txt1 = document.getElementById('input-1').value;
                const txt2 = document.getElementById('input-2').value;
                if(!txt1 && !txt2) return alert("Empty input!");
                try {
                    let charInfo = { name: 'Unknown', realm: '', class: 'WARRIOR' };
                    let p1Data = null, p2Data = null;
                    let p1Name = "PROFESSION 1", p2Name = "PROFESSION 2";
                    const parseData = (jsonStr) => {
                        const d = JSON.parse(jsonStr);
                        if (!charInfo.name || charInfo.name === 'Unknown') charInfo = { name: d.character, realm: d.realm, class: d.class };
                        if (d.professions && d.professions[0]) return { data: d.professions[0], name: cleanProfName(d.professions[0].name) };
                        return null;
                    };
                    if(txt1) { const res = parseData(txt1); if(res) { p1Data = res.data; p1Name = res.name; } }
                    if(txt2) { const res = parseData(txt2); if(res) { p2Data = res.data; p2Name = res.name; } }
                    const newChar = { info: charInfo, p1: p1Data, p2: p2Data, profNames: [p1Name, p2Name] };
                    const existingIdx = savedCharacters.findIndex(c => c.info.name === charInfo.name && c.info.realm === charInfo.realm);
                    if(existingIdx >= 0) { savedCharacters[existingIdx] = newChar; loadCharacter(existingIdx); }
                    else { savedCharacters.push(newChar); loadCharacter(savedCharacters.length - 1); }
                    saveToStorage();
                    closeModal('modal');
                    document.getElementById('input-1').value = '';
                    document.getElementById('input-2').value = '';
                } catch(e) { alert("JSON Error: " + e.message); }
            }

            function deleteCharacter(index, event) {
                event.stopPropagation();
                if(!confirm("Delete this character?")) return;
                savedCharacters.splice(index, 1);
                saveToStorage();
                if(savedCharacters.length === 0) {
                    activeCharIndex = -1;
                    document.getElementById('dashboard-grid').style.display = 'none';
                    document.getElementById('big-add-container').style.display = 'flex';
                    renderTopBar();
                } else { loadCharacter(0); }
            }

            function openTraitModal(index, event) {
                event.stopPropagation();
                const char = savedCharacters[index];
                const cls = char.info.class ? char.info.class.toUpperCase().replace(/\\s+/g, '') : "WARRIOR";
                document.getElementById('trait-char-header').innerHTML = \`
                    <img src="https://render.worldofwarcraft.com/eu/icons/56/classicon_\${cls.toLowerCase()}.jpg">
                    <div class="char-header-info"><div class="char-header-name">\${char.info.name}</div><div class="char-header-server">\${char.info.realm}</div></div>\`;
                renderTraitColumn('trait-col-1', char.profNames[0], char.p1);
                renderTraitColumn('trait-col-2', char.profNames[1], char.p2);
                openModal('trait-modal');
            }

            function renderTraitColumn(colId, profName, profData) {
                const col = document.getElementById(colId);
                if(!profData) { col.innerHTML = \`<div class="trait-header">\${profName}</div><div style="text-align:center;color:#555;">No Data</div>\`; return; }
                const skill = profData.skill || 0;
                const maxSkill = profData.maxSkill || 100;
                const percent = Math.min((skill / maxSkill) * 100, 100);
                const profKey = profName.toUpperCase();
                const barColor = PROF_COLORS[profKey] ? PROF_COLORS[profKey] : DEFAULT_PROF_COLOR;
                
                let html = \`<div class="trait-header">\${profName}</div><div class="skill-container"><div class="skill-labels"><span>Skill</span><span>\${skill} / \${maxSkill}</span></div><div class="skill-bar-bg"><div class="skill-bar-fill" style="width:\${percent}%; background: \${barColor};"></div></div></div>\`;
                
                col.innerHTML = html;
            }

            function renderTopBar() {
                const container = document.getElementById('char-chips-container');
                container.innerHTML = '';
                savedCharacters.forEach((char, idx) => {
                    const div = document.createElement('div');
                    div.className = \`char-chip \${idx === activeCharIndex ? 'active' : ''}\`;
                    div.onclick = () => loadCharacter(idx);
                    const cls = char.info.class ? char.info.class.toUpperCase().replace(/\\s+/g, '') : "WARRIOR";
                    
                    let profIconsHTML = '';
                    if (char.profNames && char.profNames.length > 0) {
                        profIconsHTML = '<div class="char-prof-wrapper">';
                        char.profNames.forEach(pName => {
                            if(pName && !pName.includes('PROFESSION')) {
                                const simpleName = pName.trim().split(' ').pop(); 
                                profIconsHTML += \`<img src="prof_class_icons/\${simpleName}.jpg" class="prof-icon-round" title="\${pName}">\`;
                            }
                        });
                        profIconsHTML += '</div>';
                    }

                    div.innerHTML = \`
                        <div class="char-chip-main">
                            <img src="https://render.worldofwarcraft.com/eu/icons/56/classicon_\${cls.toLowerCase()}.jpg" class="cls-icon">
                            <div class="chip-info">
                                <span class="chip-name">\${char.info.name}</span>
                                <span class="chip-realm">\${char.info.realm}</span>
                            </div>
                        </div>
                        \${profIconsHTML}
                        <div class="circle-btn edit-char" onclick="openTraitModal(\${idx}, event)" title="Edit Traits">✎</div>
                        <div class="circle-btn delete-char" onclick="deleteCharacter(\${idx}, event)" title="Delete">×</div>
                    \`;
                    container.appendChild(div);
                });
            }

            function applySort(col) {
                if (sortConfig.col === col) sortConfig.asc = !sortConfig.asc;
                else { sortConfig.col = col; sortConfig.asc = false; }
                if(activeCharIndex >= 0) loadCharacter(activeCharIndex);
            }

            function renderTables(p1, p2, names) {
                const h1 = document.getElementById('header-p1');
                const h2 = document.getElementById('header-p2');
                h1.innerText = names[0];
                h1.style.background = PROF_COLORS[names[0].toUpperCase()] || DEFAULT_PROF_COLOR;
                h2.innerText = names[1];
                h2.style.background = PROF_COLORS[names[1].toUpperCase()] || DEFAULT_PROF_COLOR;
                updateSortHeaders();
                
                const createHeader = (id, profIdx) => \`
                    <tr>
                        <th style="height: 50px; vertical-align: middle;">
                            <div class="dash-search-container">
                                <input type="text" class="dash-search-input" placeholder="Search item..." onkeyup="filterDashTable(this, '\${id}')">
                                <button class="setup-btn" onclick="openSetupModal(\${profIdx})">SETUP</button>
                            </div>
                        </th>
                        <th>AH Price</th>
                        <th class="sortable" onclick="applySort('profit')" data-name="Profit" style="color:var(--green)">Profit</th>
                        <th class="sortable" onclick="applySort('ppc')" data-name="P/C" style="color:var(--blue)">P/C</th>
                    </tr>\`;

                document.querySelector('#dashboard-grid .prof-column:nth-child(1) table thead').innerHTML = createHeader('body-p1', 0);
                document.querySelector('#dashboard-grid .prof-column:nth-child(2) table thead').innerHTML = createHeader('body-p2', 1);

                if(p1) renderColumn('body-p1', processProfession(p1, names[0])); else document.getElementById('body-p1').innerHTML = '';
                if(p2) renderColumn('body-p2', processProfession(p2, names[1])); else document.getElementById('body-p2').innerHTML = '';
            }

            function filterDashTable(input, bodyId) {
                const term = input.value.toLowerCase();
                const rows = document.querySelectorAll('#' + bodyId + ' tr.main-row');
                rows.forEach(row => {
                    const text = row.querySelector('.item-cell b').innerText.toLowerCase();
                    const onclickAttr = row.getAttribute('onclick');
                    const detailsId = onclickAttr ? 'd-' + onclickAttr.match(/toggleDetails\\('([^']+)'\\)/)[1] : null;
                    const details = detailsId ? document.getElementById(detailsId) : null;

                    if(text.includes(term)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                        if(details) {
                            details.classList.remove('open'); 
                            const container = details.querySelector('.details-container');
                            if(container) container.classList.remove('active');
                        }
                    }
                });
            }

            function updateSortHeaders() {
                const headers = document.querySelectorAll('th.sortable');
                headers.forEach(th => {
                    let text = th.getAttribute('data-name');
                    if (th.getAttribute('onclick').includes(sortConfig.col)) { text += sortConfig.asc ? ' ▲' : ' ▼'; }
                    th.innerText = text;
                });
            }

            function processProfession(prof, profName) {
                const isEnchanting = profName && profName.toUpperCase().includes("ENCHANTING");
                const ingFactor = isEnchanting ? 1.0 : 0.5;
                let rows = [];
                prof.recipes.forEach((r, i) => {
                    if(IGNORE.includes(r.name)) return;
                    let dbItem = PRICES[r.name];
                    const recData = findRecipe(r.name);
                    if(!dbItem && recData) dbItem = PRICES[recData.name];
                    dbItem = dbItem || {};
                    const sell = dbItem.price || 0;
                    const icon = dbItem.icon || DEF_ICON;

                    if (icon === DEF_ICON) return;

                    let cost = 0;
                    let reagents = [];
                    let resSavingsValue = 0;
                    let multiProfitValue = 0;
                    let ingProfitValue = 0;
                    if(recData && recData.recipe) {
                        recData.recipe.forEach(reg => {
                            const pItem = PRICES[reg.name] || {};
                            const rPrice = pItem.price || 0;
                            cost += rPrice * reg.count;
                            reagents.push({ id: reg.id, name: reg.name, count: reg.count, pricePer: rPrice, total: rPrice * reg.count, icon: pItem.icon || DEF_ICON });
                            if (r.res > 0) resSavingsValue += (r.res / 100) * RES_FACTOR * reg.count * rPrice;
                        });
                    }
                    if (r.multi > 0) multiProfitValue = ((r.multi / 100) * MULTI_BONUS * sell) * 0.8;
                    if (r.ing > 0) ingProfitValue = ((r.ing / 100) * ingFactor * sell) * 0.8;
                    const baseProfit = sell - cost;
                    const totalSmartProfit = baseProfit + resSavingsValue + multiProfitValue + ingProfitValue;
                    const concCost = (recData && recData.ConcCost) ? recData.ConcCost : (r.conc || 0);
                    const ppc = concCost > 0 ? totalSmartProfit / concCost : 0;
                    
                    const realId = recData ? recData.id : null;

                    rows.push({
                        id: Math.random().toString(36).substr(2, 9),
                        recipeId: realId, 
                        name: recData ? recData.name : r.name,
                        icon: icon, cost: cost, sell: sell, profit: totalSmartProfit, conc: concCost, ppc: ppc, reagents: reagents, raw: r, resSavings: resSavingsValue, multiProfit: multiProfitValue, ingProfit: ingProfitValue, profName: profName
                    });
                });
                return rows.sort((a,b) => {
                    let valA = a[sortConfig.col];
                    let valB = b[sortConfig.col];
                    return sortConfig.asc ? valA - valB : valB - valA;
                });
            }

            function renderColumn(bodyId, data) {
                const tbody = document.getElementById(bodyId);
                tbody.innerHTML = '';
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = 'main-row';
                    tr.onclick = () => toggleDetails(row.id);
                    tr.innerHTML = \`<td><div class="item-cell"><img src="\${row.icon}" class="item-icon"><b>\${row.name}</b></div></td><td class="gold-txt">\${fmt(row.sell)}</td><td class="\${row.profit>=0?'profit-pos':'profit-neg'}">\${fmt(row.profit)}</td><td class="conc-col">\${row.ppc > 0 ? fmt(row.ppc) : '-'}</td>\`;
                    tbody.appendChild(tr);
                    const trD = document.createElement('tr');
                    trD.id = 'd-' + row.id;
                    trD.className = 'details-row';
                    let regsHTML = '';
                    row.reagents.forEach(r => { regsHTML += \`<div class="reagent-item"><div class="reagent-left"><img src="\${r.icon}" width="16" style="border-radius:2px"> \${r.name} \${r.count}x</div><div style="text-align:right; font-size:14px; color:#eee;">\${fmt(r.pricePer)}</div></div>\`; });
                    trD.innerHTML = \`
                        <td colspan="4" style="padding:0;">
                            <div class="details-container" id="dc-\${row.id}">
                                <div class="details-wrapper">
                                    <div class="stats-col">
                                        <div style="font-weight:bold;margin-bottom:8px;color:#fff">Stats</div>
                                        <div class="stat-row"><span>Difficulty:</span><b>\${row.raw.diff}</b></div>
                                        <div class="stat-row"><span>Concentration:</span><b style="color:var(--gold)">\${row.conc}</b></div>
                                        <div class="stat-row"><span>Multicraft:</span><b>\${row.raw.multi}%</b></div>
                                        <div class="stat-row"><span>Resourcefulness:</span><b>\${row.raw.res}%</b></div>
                                        <div class="stat-row"><span>Crafting Speed:</span><b>\${row.raw.speed}%</b></div>
                                        <div class="stat-row"><span>Ingenuity:</span><b>\${row.raw.ing}%</b></div>
                                        <div style="margin-top:20px; font-weight:bold; color:#d6b0ff; border-top:1px solid #333; padding-top:8px;">Avg Profit (per craft)</div>
                                        <div class="stat-row"><span>Resourcefulness:</span><span style="color:#0f9">+\${fmt(row.resSavings)}</span></div>
                                        <div class="stat-row"><span>Multicraft:</span><span style="color:#0f9">+\${fmt(row.multiProfit)}</span></div>
                                        <div class="stat-row"><span>Ingenuity:</span><span style="color:#0f9">+\${fmt(row.ingProfit)}</span></div>
                                    </div>
                                    <div class="reagents-col">
                                        <div style="font-weight:bold;margin-bottom:8px;color:#fff">Reagents</div>\${regsHTML}
                                        <div style="margin-top:8px; border-top:1px solid #444; padding-top:8px; display:flex; justify-content:space-between;"><span style="color:#aaa">Total Cost:</span><span class="gold-txt">\${fmt(row.cost)}</span></div>
                                    </div>
                                </div>
                            </div>
                        </td>\`;
                    tbody.appendChild(trD);
                });
            }

            function toggleDetails(id) {
                const row = document.getElementById('d-'+id);
                const container = document.getElementById('dc-'+id);
                if (row.classList.contains('open')) { container.classList.remove('active'); setTimeout(() => row.classList.remove('open'), 300); } else { row.classList.add('open'); setTimeout(() => container.classList.add('active'), 10); }
            }

            function findRecipe(name) {
                const n = name.toLowerCase().trim();
                let f = RECIPES.find(r => r.name.toLowerCase() === n);
                if(!f) f = RECIPES.find(r => r.name.toLowerCase().includes(n));
                if(!f) f = RECIPES.find(r => n.includes(r.name.toLowerCase()));
                return f;
            }
            function cleanProfName(name) { return name ? name.replace("Khaz Algar", "").replace("Algari", "").trim() : "PROFESSION"; }
            function fmt(n) { 
                let val = '';
                if (n === 0) val = '0';
                else if (n < 1) val = n.toFixed(2); 
                else if (n < 100) val = n.toFixed(1);
                else val = Math.floor(n).toLocaleString();
                return \`\${val}<img src="\${GOLD_ICON}" class="coin-icon">\`;
            }

            function openModal(id) { 
                document.getElementById(id || 'modal').style.display = 'flex'; 
                document.body.style.overflow = 'hidden'; 
            }
            function closeModal(id) { 
                document.getElementById(id || 'modal').style.display = 'none'; 
                document.body.style.overflow = '';
            }

            // [SETUP MODAL LOGIC]
            let setupProfIndex = 0; 

            function openSetupModal(profIdx) { 
                setupProfIndex = profIdx;
                openModal('setup-modal'); 
            }
            
            function calculateSetup() {
                const inputEl = document.getElementById('setup-count');
                const count = parseInt(inputEl.value);
                if (!count || count <= 0) return alert("Please enter a valid number of characters.");
                setupTotalChars = count; 
                
                if (activeCharIndex === -1) return alert("Please import a character first.");
                const char = savedCharacters[activeCharIndex];
                
                if (setupProfIndex === 0 && char.p1) {
                    allProfRecipes = processProfession(char.p1, char.profNames[0]);
                } else if (setupProfIndex === 1 && char.p2) {
                    allProfRecipes = processProfession(char.p2, char.profNames[1]);
                }
                
                let sortedRecipes = [...allProfRecipes].sort((a, b) => b.ppc - a.ppc);
                const TARGET_RECIPES = 6;
                currentSetupRecipes = sortedRecipes.slice(0, TARGET_RECIPES);
                
                recalcAndRenderSetup();
            }

            function recalcAndRenderSetup() {
                const container = document.getElementById('setup-results');
                
                const numRecipes = currentSetupRecipes.length;
                let results = [];

                if (numRecipes > 0) {
                    if (setupTotalChars < numRecipes) {
                        results = currentSetupRecipes.map((r, i) => {
                            return { ...r, charCount: (i < setupTotalChars) ? 1 : 0 };
                        }).filter(r => r.charCount > 0);
                    } else {
                        const base = Math.floor(setupTotalChars / numRecipes);
                        const remainder = setupTotalChars % numRecipes;
                        results = currentSetupRecipes.map((r, i) => {
                            const charCount = (i < remainder) ? base + 1 : base;
                            return { ...r, charCount: charCount };
                        });
                    }
                }
                
                currentSetupRecipes = results;

                let html = '';
                results.forEach((r, idx) => {
                    html += \`
                        <div class="setup-row">
                            <div class="action-badge edit" onclick="showRecipeDropdown(event, \${idx})">✎</div>
                            <div class="action-badge del" onclick="removeSetupItem(\${idx})">×</div>
                            
                            <div class="setup-item-info">
                                <img src="\${r.icon}" style="width:36px; height:36px; border-radius:4px; border:1px solid #444;">
                                <div style="color:#fff; font-weight:bold;">\${r.name}</div>
                            </div>
                            <div class="setup-count-badge">\${r.charCount}</div>
                        </div>
                    \`;
                });

                html += \`<div class="add-recipe-row" onclick="showRecipeDropdown(event, -1)">+ Add Recipe</div>\`;
                html += \`<div id="recipe-dropdown" class="recipe-dropdown"></div>\`;

                container.innerHTML = html;
            }

            function removeSetupItem(index) {
                currentSetupRecipes.splice(index, 1);
                recalcAndRenderSetup();
            }

            function showRecipeDropdown(e, targetIndex) {
                e.stopPropagation();
                activeDropdownIndex = targetIndex; 
                
                const dd = document.getElementById('recipe-dropdown');
                const btnRect = e.target.getBoundingClientRect();
                
                let listHtml = \`
                    <div class="rd-search-container">
                        <input type="text" class="rd-search-input" placeholder="Search recipe..." onclick="event.stopPropagation()" onkeyup="filterRecipeDropdown(this)">
                    </div>
                \`;
                
                // Якщо додаємо (targetIndex === -1), приховуємо всі існуючі рецепти
                // Якщо редагуємо, приховуємо ТІЛЬКИ поточний рецепт. Всі інші існуючі - залишаємо, щоб можна було поміняти їх місцями (SWAP)
                const usedNames = targetIndex === -1 
                    ? currentSetupRecipes.map(item => item.name)
                    : [currentSetupRecipes[targetIndex].name]; 

                allProfRecipes.forEach((r, idx) => {
                    // Пропускаємо рецепти, які є в usedNames
                    if (usedNames.includes(r.name)) return;

                    listHtml += \`
                        <div class="rd-item" onclick="selectRecipeFromDropdown(\${idx})">
                            <img src="\${r.icon}" class="rd-img">
                            <div class="rd-name">\${r.name}</div>
                        </div>\`;
                });
                
                dd.innerHTML = listHtml;
                
                dd.style.display = 'block';
                dd.style.left = btnRect.left + 'px';
                
                if (targetIndex === -1) {
                    dd.style.top = 'auto';
                    dd.style.bottom = (window.innerHeight - btnRect.top + 5) + 'px';
                } else {
                    dd.style.bottom = 'auto';
                    dd.style.top = (btnRect.bottom + 5) + 'px';
                }
            }

            function filterRecipeDropdown(input) {
                const term = input.value.toLowerCase();
                const items = document.querySelectorAll('.rd-item');
                items.forEach(item => {
                    const name = item.querySelector('.rd-name').innerText.toLowerCase();
                    if(name.includes(term)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }

            function selectRecipeFromDropdown(recipeIndex) {
                const selected = allProfRecipes[recipeIndex];
                
                if (activeDropdownIndex === -1) {
                    // Якщо додаємо новий
                    currentSetupRecipes.push(selected);
                } else {
                    // Якщо редагуємо існуючий
                    const existingIndex = currentSetupRecipes.findIndex(r => r.name === selected.name);
                    
                    if (existingIndex !== -1 && existingIndex !== activeDropdownIndex) {
                        // Якщо вибраний рецепт вже є в списку - МІНЯЄМО МІСЦЯМИ (SWAP)
                        const temp = currentSetupRecipes[activeDropdownIndex];
                        currentSetupRecipes[activeDropdownIndex] = currentSetupRecipes[existingIndex];
                        currentSetupRecipes[existingIndex] = temp;
                    } else {
                        // Якщо вибрали абсолютно новий рецепт - ЗАМІНЮЄМО (REPLACE)
                        currentSetupRecipes[activeDropdownIndex] = selected;
                    }
                }
                
                document.getElementById('recipe-dropdown').style.display = 'none';
                recalcAndRenderSetup();
            }

            function generateImport() {
                if(!currentSetupRecipes || currentSetupRecipes.length === 0) return alert("Generate setup first!");
                
                let craftsList = [];
                let reagentMap = {}; 

                currentSetupRecipes.forEach(r => {
                    craftsList.push({
                        id: r.recipeId || 0,
                        name: r.name,
                        count: r.charCount
                    });

                    const concCost = r.conc || 0;
                    if(concCost > 0) {
                        const baseCrafts = 1000 / concCost;
                        const ingPct = r.raw.ing || 0;
                        const totalCraftsPerChar = Math.floor(baseCrafts * (1 + (ingPct / 100)));
                        const totalCraftsAllChars = totalCraftsPerChar * r.charCount;

                        r.reagents.forEach(reg => {
                            const regQty = reg.count * totalCraftsAllChars;
                            const rId = reg.id || 0;
                            
                            if (!reagentMap[rId]) {
                                reagentMap[rId] = { id: rId, name: reg.name, count: 0 };
                            }
                            reagentMap[rId].count += regQty;
                        });
                    }
                });

                const exportObj = {
                    crafts: craftsList,
                    reagents: Object.values(reagentMap)
                };

                const jsonOutput = JSON.stringify(exportObj, null, 2);

                const tempText = document.createElement("textarea");
                tempText.value = jsonOutput;
                document.body.appendChild(tempText);
                tempText.select();
                document.execCommand("copy");
                document.body.removeChild(tempText);

                const btn = document.querySelector('.setup-import-btn');
                const originalText = btn.innerText;
                const originalBg = btn.style.backgroundColor; 
                
                btn.innerText = "COPIED";
                btn.style.backgroundColor = "var(--green)";
                btn.style.color = "#000";
                
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = ""; 
                    btn.style.color = "";
                }, 2000);
            }
        </script>
    </head>
    <body>
        <div id="top-bar" class="top-bar">
            <div id="dashboard-controls">
                <div id="char-chips-container" style="display:flex; gap:15px; flex-wrap:wrap;"></div>
                <button class="add-btn-small" onclick="openModal('modal')" title="Add New Character">+</button>
            </div>
            <div class="nav-bar">
                <button id="btn-reagents" class="nav-btn active" onclick="switchTab('reagents')">Reagents Scanner</button>
                <button id="btn-dashboard" class="nav-btn" onclick="switchTab('dashboard')">Dashboard</button>
                <button id="btn-profOverview" class="nav-btn" onclick="switchTab('profOverview')">Professions Overview</button>
            </div>
        </div>
        <div id="view-reagents"><div id="reagents-content"></div></div>
        <div id="view-dashboard">
            <div id="big-add-container">
                <button class="big-plus-btn" onclick="openModal('modal')">+</button>
                <div style="color:#555; margin-top:10px">Add your first character</div>
            </div>
            <div id="dashboard-grid" class="dashboard-grid">
                <div class="prof-column"><div id="header-p1" class="prof-header">PROF 1</div><table><thead></thead><tbody id="body-p1"></tbody></table></div>
                <div class="prof-column"><div id="header-p2" class="prof-header">PROF 2</div><table><thead></thead><tbody id="body-p2"></tbody></table></div>
            </div>
        </div>
        <div id="view-profOverview"><div id="profOverview-content"></div></div>
        
        <div id="modal" class="modal-overlay" onclick="if(event.target===this)closeModal('modal')">
            <div class="modal-box">
                <span class="close-modal" onclick="closeModal('modal')">×</span>
                <div class="modal-title">IMPORT CHARACTER</div>
                <div class="input-group"><span class="input-label">Profession 1 (Paste JSON)</span><textarea id="input-1"></textarea></div>
                <div class="input-group"><span class="input-label">Profession 2 (Paste JSON)</span><textarea id="input-2"></textarea></div>
                <button class="import-btn" onclick="processImport()">SAVE CHARACTER</button>
            </div>
        </div>

        <div id="trait-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('trait-modal')">
            <div class="modal-box" style="width: 700px;">
                <span class="close-modal" onclick="closeModal('trait-modal')">×</span>
                <div id="trait-char-header" class="char-header-block"></div>
                <div class="trait-grid"><div id="trait-col-1" class="trait-column"></div><div id="trait-col-2" class="trait-column"></div></div>
            </div>
        </div>

        <div id="setup-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('setup-modal')">
            <div class="modal-box" style="width: 900px;">
                <span class="close-modal" onclick="closeModal('setup-modal')">×</span>
                <div class="modal-title">SETUP CRAFTERS</div>
                <div class="setup-header-row">
                    <span class="setup-label">Вкажи свою кількість персонажів:</span>
                    <input type="number" id="setup-count" class="setup-input" placeholder="">
                    <button class="setup-gen-btn" onclick="calculateSetup()">GENERATE</button>
                </div>
                <div id="setup-results" class="setup-results"></div>
                <div class="setup-footer">
                    <button class="setup-import-btn" onclick="generateImport()">IMPORT</button>
                </div>
            </div>
        </div>
    </body>
    </html>`;

    const filePath = path.join(__dirname, 'index.html');
    fs.writeFileSync(filePath, html);
    console.log(`✅ Сторінка згенерована: ${filePath}`);
}

main();