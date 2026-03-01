// ==UserScript==
// @name         Auto Builder Pro - AlGzawy (V3.0 Free Finish)
// @version      3.0
// @description  مدير قرية متكامل: إنهاء تلقائي (3د)، التزام صارم بالترتيب، واجهة قابلة لتغيير الحجم، وتحريك حر.
// @author       AlGzawy & Manus
// @match        https://*/game.php?village=*&screen=main*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VILLAGE_ID = game_data.village.id;
    const STATUS_KEY = `proBuilder_status_${VILLAGE_ID}`;
    const QUEUE_KEY = `proBuilder_queue_${VILLAGE_ID}`;
    const LEN_KEY = `proBuilder_len_${VILLAGE_ID}`;
    const TEMPLATE_KEY = `proBuilder_template_${VILLAGE_ID}`;
    const POS_KEY = `proBuilder_pos_${VILLAGE_ID}`;
    const DIM_KEY = `proBuilder_dim_${VILLAGE_ID}`;
    const MIN_KEY = `proBuilder_minimized_${VILLAGE_ID}`;
    const FARM_LIMIT_PERCENT = 95;

    let isRunning = localStorage.getItem(STATUS_KEY) === 'true';
    let buildingQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    let maxQueueLength = parseInt(localStorage.getItem(LEN_KEY) || (game_data.features.Premium.active ? "5" : "2"));
    let activeTemplate = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "null");
    let isMinimized = localStorage.getItem(MIN_KEY) === 'true';
    let isProcessing = false;

    const buildingConfig = [
        { id: 'main', name: 'المبنى الرئيسي' },
        { id: 'barracks', name: 'الثكنات' },
        { id: 'stable', name: 'الأسطبل' },
        { id: 'garage', name: 'الورشه' },
        { id: 'watchtower', name: 'برج المراقبة' },
        { id: 'snob', name: 'الأكاديمية' },
        { id: 'smith', name: 'الحداد' },
        { id: 'statue', name: 'النصب التذكاري' },
        { id: 'market', name: 'السوق' },
        { id: 'wood', name: 'الخشاب' },
        { id: 'stone', name: 'حفرة الطمي' },
        { id: 'iron', name: 'منجم الحديد' },
        { id: 'farm', name: 'المزارع' },
        { id: 'storage', name: 'المخازن' },
        { id: 'hide', name: 'المخابئ' },
        { id: 'wall', name: 'الحائط' }
    ];

    const internalOrder = ['main', 'barracks', 'stable', 'garage', 'church', 'church_f', 'snob', 'smith', 'place', 'statue', 'market', 'wood', 'stone', 'iron', 'farm', 'storage', 'hide', 'wall', 'watchtower'];
    const nameMap = {};
    buildingConfig.forEach(b => nameMap[b.id] = b.name);

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function decodeTWTemplate(code) {
        try {
            const binaryString = atob(code);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const template = {};
            let dataOffset = 4;
            for (let i = 0; i < internalOrder.length; i++) {
                if (dataOffset < bytes.length) {
                    const level = bytes[dataOffset];
                    if (level > 0) template[internalOrder[i]] = level;
                    dataOffset++;
                }
            }
            return Object.keys(template).length > 0 ? template : null;
        } catch (e) { return null; }
    }

    function decodeTextSequence(text) {
        let seq = [];
        let counts = {};
        let lines = text.split(/[\r\n,-]+/);
        let foundAny = false;
        for (let line of lines) {
            let name = line.trim();
            if (!name) continue;
            let b = buildingConfig.find(bc => bc.name === name || bc.id === name);
            if (b) {
                counts[b.id] = (counts[b.id] || 0) + 1;
                seq.push({ id: b.id, target: counts[b.id] });
                foundAny = true;
            }
        }
        return foundAny ? seq : null;
    }

    function applyTemplateLogic() {
        if (!activeTemplate || buildingQueue.length > 0) return;
        const currentLevels = {};
        buildingConfig.forEach(b => {
            const row = $(`#main_buildrow_${b.id}`);
            currentLevels[b.id] = row.length ? (parseInt(row.find(".mw").text().match(/\d+/)?.[0]) || 0) : 0;
        });

        let changed = false;
        
        if (Array.isArray(activeTemplate)) {
            for (let step of activeTemplate) {
                if (currentLevels[step.id] < step.target) {
                    buildingQueue.push(step.id);
                    changed = true;
                    break;
                }
            }
        } else {
            for (const bId of internalOrder) {
                const b = buildingConfig.find(bc => bc.id === bId);
                if (!b) continue;
                const target = activeTemplate[b.id] || 0;
                const current = currentLevels[b.id];
                if (current < target) {
                    buildingQueue.push(b.id);
                    changed = true;
                    break;
                }
            }
        }
        if (changed) { saveData(); updateUI(); }
    }

    async function processBuilding() {
        if (!isRunning || isProcessing) return;
        isProcessing = true;
        try {
            // ميزة الإنهاء التلقائي (أقل من 3 دقائق)
            $(".btn-instant-free:visible").each(function() {
                const btn = $(this);
                console.log("[Auto Finish] إنهاء مبنى متاح مجاناً!");
                btn[0].click();
            });

            if (activeTemplate) applyTemplateLogic();

            const farmText = $("#pop_max_label").text().split('/');
            if (farmText.length === 2 && (parseInt(farmText[0])/parseInt(farmText[1])*100) >= FARM_LIMIT_PERCENT) {
                const farmRow = $("#main_buildrow_farm");
                if (farmRow.length && farmRow.find(".btn-build").length && ($("#buildqueue tr").length - 2) < maxQueueLength) {
                    farmRow.find(".btn-build")[0].click();
                    await wait(1000);
                    isProcessing = false;
                    return;
                }
            }

            if (buildingQueue.length > 0 && ($("#buildqueue tr").length - 2) < maxQueueLength) {
                const nextBuilding = buildingQueue[0];
                const buildRow = $(`#main_buildrow_${nextBuilding}`);

                if (buildRow.length) {
                    const buildBtn = buildRow.find(".btn-build");
                    if (buildBtn.length && !buildBtn.hasClass("btn-disabled")) {
                        buildBtn[0].click();
                        buildingQueue.shift();
                        saveData();
                        await wait(1200);
                    }
                }
            }
            updateUI();
        } catch (e) { console.error(e); }
        isProcessing = false;
    }

    function setupUI() {
        if ($("#pro_builder_panel").length) return;

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes custom_rainbow {
                0% { color: #000000; }
                14% { color: #ffffff; }
                28% { color: #ffff00; }
                42% { color: #0000ff; }
                56% { color: #00ff00; }
                70% { color: #800080; }
                84% { color: #ff0000; }
                100% { color: #000000; }
            }
            .algzawy-rainbow-fixed {
                animation: custom_rainbow 5s linear infinite;
                font-weight: bold;
            }
            .signature-box-final {
                text-align: center;
                margin-top: 10px;
                margin-bottom: 5px;
                font-size: 12px;
                padding: 10px 5px;
                border-top: 1px solid rgba(125, 81, 15, 0.3);
                color: #000;
                font-weight: bold;
                background: rgba(125, 81, 15, 0.05);
                border-bottom-left-radius: 6px;
                border-bottom-right-radius: 6px;
            }
            #pro_builder_panel {
                resize: both;
                overflow: hidden;
                min-width: 200px;
                min-height: 150px;
            }
            #panel_content {
                height: calc(100% - 35px);
                display: flex;
                flex-direction: column;
            }
            #building_controls {
                flex-grow: 1;
                overflow-y: auto;
                padding-left: 5px;
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);

        const savedPos = JSON.parse(localStorage.getItem(POS_KEY) || '{"top":"60px","right":"10px"}');
        const savedDim = JSON.parse(localStorage.getItem(DIM_KEY) || '{"width":"220px","height":"auto"}');

        const panelHtml = `
            <div id="pro_builder_panel" style="position: fixed; top: ${savedPos.top}; left: ${savedPos.left || 'auto'}; right: ${savedPos.right || '10px'}; width: ${savedDim.width}; height: ${savedDim.height}; z-index: 10000; background: #f4e4bc; border: 2px solid #7d510f; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); direction: rtl; font-family: Tahoma, sans-serif; font-size: 11px;">
                <div id="panel_header" style="display: flex; justify-content: space-between; align-items: center; background: #7d510f; color: white; padding: 5px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: move; height: 25px;">
                    <strong style="font-size: 12px;">Auto Builder Pro V3.0</strong>
                    <div style="display: flex; gap: 5px;">
                        <span id="min_btn" style="cursor: pointer; font-weight: bold; padding: 0 5px;">${isMinimized ? '□' : '_'}</span>
                    </div>
                </div>

                <div id="panel_content" style="padding: 10px; display: ${isMinimized ? 'none' : 'flex'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0;">
                        <button id="toggle_builder" class="btn" style="padding: 2px 12px; font-weight: bold; flex-grow: 1;"></button>
                    </div>

                    <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 4px; flex-shrink: 0;">
                        <span>الحد الأقصى:</span>
                        <input type="number" id="max_q_len" value="${maxQueueLength}" min="1" max="10" style="width: 30px; text-align: center; border: 1px solid #7d510f; border-radius: 3px;">
                    </div>

                    <div style="margin-bottom: 10px; flex-shrink: 0;">
                        <button id="import_template" class="btn" style="width: 100%; background: #8c5e1a; color: white; border: 1px solid #5e3f11; padding: 4px;">استيراد كود القالب</button>
                        ${activeTemplate ? '<div id="template_status" style="color: #1e7e34; text-align: center; font-weight: bold; margin-top: 4px;">القالب نشط ✓</div>' : ''}
                    </div>

                    <div id="building_controls">
                        ${buildingConfig.map(b => `
                            <div style="display: flex; align-items: center; background: #8c5e1a; border: 1px solid #5e3f11; border-radius: 4px; overflow: hidden; height: 22px; flex-shrink: 0; margin-bottom: 3px;">
                                <button class="sub-btn" data-id="${b.id}" style="width: 25px; height: 100%; background: #d9534f; color: white; border: none; cursor: pointer; font-weight: bold;">-</button>
                                <div class="add-btn-main" data-id="${b.id}" style="flex-grow: 1; height: 100%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; font-size: 10px; white-space: nowrap; padding: 0 4px;">
                                    <span class="b-name">${b.name}</span>
                                    <span class="b-count" id="count_${b.id}" style="margin-right: 4px; font-weight: bold; color: #ffeb3b; display: none;"></span>
                                </div>
                                <button class="plus-btn" data-id="${b.id}" style="width: 25px; height: 100%; background: #5cb85c; color: white; border: none; cursor: pointer; font-weight: bold;">+</button>
                            </div>
                        `).join('')}
                    </div>

                    <div style="border-top: 1px solid #7d510f; padding-top: 8px; margin-top: 5px; flex-shrink: 0;">
                        <strong style="color: #7d510f; display: block; margin-bottom: 5px;">قائمة الترتيب:</strong>
                        <div id="q_display" style="max-height: 80px; overflow-y: auto; background: rgba(255,255,255,0.7); border: 1px inset #7d510f; border-radius: 4px; padding: 5px; display: flex; flex-wrap: wrap; gap: 4px;">
                        </div>
                    </div>

                    <button id="clear_q" class="btn" style="width: 100%; margin-top: 10px; background: #d9534f; color: white; padding: 4px; font-size: 11px; flex-shrink: 0;">مسح الكل</button>

                    <div class="signature-box-final">
                        <span class="algzawy-rainbow-fixed">AlGzawy</span> | جميع الحقوق محفوظة
                    </div>
                </div>
            </div>
        `;
        $("body").append(panelHtml);

        const panel = document.getElementById("pro_builder_panel");
        const header = document.getElementById("panel_header");

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === panel) {
                    localStorage.setItem(DIM_KEY, JSON.stringify({
                        width: panel.style.width,
                        height: panel.style.height
                    }));
                }
            }
        });
        resizeObserver.observe(panel);

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            panel.style.top = (panel.offsetTop - pos2) + "px";
            panel.style.left = (panel.offsetLeft - pos1) + "px";
            panel.style.right = "auto";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            localStorage.setItem(POS_KEY, JSON.stringify({ top: panel.style.top, left: panel.style.left }));
        }

        $("#min_btn").on('click', function() {
            isMinimized = !isMinimized;
            localStorage.setItem(MIN_KEY, isMinimized);
            $("#panel_content").toggle(!isMinimized);
            $(this).text(isMinimized ? '□' : '_');
            panel.style.height = isMinimized ? "35px" : (JSON.parse(localStorage.getItem(DIM_KEY) || '{"height":"auto"}').height);
        });

        $(".add-btn-main, .plus-btn").on('click', function(e) {
            e.stopPropagation();
            buildingQueue.push($(this).data('id'));
            saveData(); updateUI(); processBuilding();
        });

        $(".sub-btn").on('click', function(e) {
            e.stopPropagation();
            const id = $(this).data('id');
            const idx = buildingQueue.lastIndexOf(id);
            if (idx !== -1) {
                buildingQueue.splice(idx, 1);
                saveData(); updateUI();
            }
        });

        $("#toggle_builder").on('click', function() {
            isRunning = !isRunning;
            localStorage.setItem(STATUS_KEY, isRunning);
            updateUI();
            if (isRunning) processBuilding();
        });

        $("#max_q_len").on('change', function() {
            maxQueueLength = parseInt($(this).val()) || 2;
            localStorage.setItem(LEN_KEY, maxQueueLength);
        });

        $("#import_template").on('click', function() {
            const raw = prompt("الصق كود القالب المشفر، أو قائمة المباني بالترتيب (كل مبنى في سطر) هنا:");
            if (raw) {
                let decoded = decodeTWTemplate(raw.trim());
                if (!decoded) {
                    decoded = decodeTextSequence(raw.trim());
                }
                
                if (decoded) {
                    activeTemplate = decoded;
                    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(activeTemplate));
                    saveData(); alert("تم التفعيل!"); location.reload();
                } else alert("كود غير صالح أو قائمة غير مفهومة.");
            }
        });

        $("#clear_q").on('click', function() {
            if (confirm("مسح الكل؟")) {
                buildingQueue = []; activeTemplate = null;
                localStorage.removeItem(TEMPLATE_KEY);
                saveData(); updateUI();
            }
        });

        updateUI();
    }

    function updateUI() {
        const btn = $("#toggle_builder");
        if (isRunning) {
            btn.text("إيقاف").css("background", "#d9534f").css("color", "white");
        } else {
            btn.text("تشغيل").css("background", "#5cb85c").css("color", "white");
        }

        buildingConfig.forEach(b => {
            const count = buildingQueue.filter(id => id === b.id).length;
            const countSpan = $(`#count_${b.id}`);
            const parent = countSpan.closest('.add-btn-main').parent();
            if (count > 0) {
                countSpan.text(`+${count}`).show();
                parent.css("background", "#28a745");
            } else {
                countSpan.hide();
                parent.css("background", "#8c5e1a");
            }
        });

        const qDiv = $("#q_display");
        if (buildingQueue.length === 0) {
            qDiv.html("<i style='color: #888; font-size: 10px;'>القائمة فارغة...</i>");
        } else {
            qDiv.html(buildingQueue.map((id, idx) => `
                <div style="display: flex; align-items: center; background: #7d510f; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; white-space: nowrap;">
                    <span>${nameMap[id] || id}</span>
                    <span class="remove-single" data-idx="${idx}" style="margin-right: 5px; cursor: pointer; font-weight: bold; color: #ffbbbb;">×</span>
                </div>
            `).join(''));

            $(".remove-single").on('click', function() {
                buildingQueue.splice($(this).data('idx'), 1);
                saveData();
                updateUI();
            });
        }
    }

    function saveData() {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(buildingQueue));
        localStorage.setItem(STATUS_KEY, isRunning);
        localStorage.setItem(LEN_KEY, maxQueueLength);
    }

    $(function() {
        setupUI();
        setInterval(processBuilding, 15000);
        setInterval(() => { if (isRunning) location.reload(); }, (Math.random() * 3 + 4) * 60 * 1000);
        if (isRunning) setTimeout(processBuilding, 2000);
    });

})();
