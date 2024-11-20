/* jshint esversion: 6 */
/*
 * Copyright © 2024 Ray. All Rights Reserved.
 * 本作品採用 CC BY-NC-SA 4.0 授權條款，允許非商業性質的轉載與修改，但需註明來源並以相同條件分享。
 */

window.underlyingPrice=22500; // 價平
window.analysisWidth = 0.06; // 價位寬度
window.part = 100; // 切成幾分

window.contractMultiplier=50; // 每點價值
window.AValue=81000;
window.BValue=41000;
window.CValue=8200;

window.items=20; // 價平上下檔數
window.positions = []; // 存放所有持倉數據


$(document).ready(function () {

    const tradeLine = $('<div class="trade-line"></div>').appendTo('body'); // 建倉拖拉線
    const chart = echarts.init(document.getElementById('chart'));
    const positionOptions = [
        { id: 'long_mini', text: '小台多單' },
        { id: 'short_mini', text: '小台空單' },
        { id: 'buy_call', text: 'Buy Call' },
        { id: 'sell_call', text: 'Sell Call' },
        { id: 'buy_put', text: 'Buy Put' },
        { id: 'sell_put', text: 'Sell Put' }
    ];

    let priceRange = { min: underlyingPrice*(1-analysisWidth), max: underlyingPrice*(1+analysisWidth) }; // 收盤價格範圍（可調整）
    let point=50; // 每檔間隔
    let linewidth=5; // 建倉表拖拉線寬
    let isBuilding = false; // 是否處於建倉模式
    let startCell = null; // 開始的單元格
    let endCell = null; // 結束的單元格

    $('#market-price').val(underlyingPrice);
    $('#analysis-width').val(analysisWidth);
    $('#precision').val(part);

    // 配置區更新
    $('.overall_config').on('change',function () {

        underlyingPrice = Number($('#market-price').val()||underlyingPrice);
        analysisWidth = Number($('#analysis-width').val()||analysisWidth);
        part = Number($('#precision').val()||part);
        priceRange = { min: underlyingPrice*(1-analysisWidth), max: underlyingPrice*(1+analysisWidth) };

        updateOptionTable();
        updateChart();
    });
    // 新增倉位
    $('#addPosition').off('click').on('click', () => addItem(0, 0));

    // 測試倉轉持倉
    $('#comfirmPosition').off('click').on('click', function(){
        $('.istest:checked').each(function(){
            $(this).prop('checked', false);
            updatePositions($(this).closest('tr'));
        });
        updateChart();
    });


    // 建倉表事件 按下
    $('#optionTable').off('mousedown').on('mousedown', 'td.call, td.put', function (e) {
        isBuilding = true;
        startCell = $(this);
        if(e.button === 0){
            tradeLine.show().css({ top: e.pageY, left: e.pageX,height:0 });
        }
    });
    // 建倉表事件 拖拉
    $(document).off('mousemove').on('mousemove', function (e) {
        if (isBuilding) {
            const nowCell = $(document.elementFromPoint(startCell.offset().left - window.scrollX, e.pageY - window.scrollY))
            const offset = startCell.offset();
            const startX = offset.left + startCell.outerWidth() * (startCell.hasClass('call')?0.25:0.75)-(startCell.hasClass('call')?linewidth:0);
            const startY = offset.top + startCell.outerHeight() * 0.5;
            const endX = e.pageX;
            const endY = e.pageY;

            if (nowCell.hasClass('call')) {nowCell.css('background-color', '#7e0104')};
            if (nowCell.hasClass('put')) {nowCell.css('background-color', '#045b1c')};

            tradeLine.css({
                'width': linewidth,
                'height': Math.max(endY-startY,startY-endY),
                'top': Math.min(startY,endY),
                'left': startX,
                'background-color': (startCell.hasClass('call')&&endY>startY)||(!startCell.hasClass('call')&&endY<startY) ? '#f00': '#0f0'
            });
        }
    });
    // 建倉表事件 放開
    $(document).off('mouseup').on('mouseup', function (e) {
        if (isBuilding) {
            isBuilding = false;
            tradeLine.hide();

            endCell = $(document.elementFromPoint(startCell.offset().left - window.scrollX, e.pageY - window.scrollY));
            if (endCell && endCell.closest('#optionTable').length > 0 && (endCell.hasClass('call') || endCell.hasClass('put'))) {
                const startPrice = startCell.siblings('.strike').text();
                const endPrice = endCell.siblings('.strike').text();
                const starttype = startCell.hasClass('call') ? 'buy_call' : 'buy_put';
                const endtype = endCell.hasClass('call') ? 'sell_call' : 'sell_put';

                if(e.button === 0){
                    addItem(starttype,startPrice);
                    if(startPrice!==endPrice){
                        addItem(endtype,endPrice);
                    }
                }else if(startPrice==endPrice){
                    addItem(endtype,endPrice);
                }

                updateChart();
                updateOptionTable();
            }
        }
    });



    // 建倉表禁用預設右鍵
    $('.trade-builder').on('contextmenu', function(e) {
        e.preventDefault(); 
    });

    // 持倉改動更新畫面
    $('#positions tbody').off('change').on('change', 'select, input', function () {
        updatePositions($(this).closest('tr'));
        updateChart();
    });

    initChart();
    updateChart();
    updateOptionTable();

    function updateOptionTable() {
        $('#optionTable tbody').html('');
        let base=Math.round(underlyingPrice/point,0)*point;
        for(let i = 0; i<=items*2; i++){
            let row = $(`
                <tr ><tr>
                    <td class="call">C</td>
                    <td class="strike">${base-(items-i)*point}</td>
                    <td class="put">P</td>
                </tr></tr>
            `);
            if(items==i){
                row.css({'background-color': '#5e5e5e'});
            }
            $('#optionTable tbody').append(row);
        }
    }

    function updatePositions(row) {
        const positionId = row.data('id');
        const type = row.find('.position-select').val();
        const strikePrice = parseFloat(row.find('.strike-price').val()) || 0;
        const cost = parseFloat(row.find('.cost').val()) || 0;
        const quantity = parseFloat(row.find('.quantity').val()) || 0;
        const istest = row.find('.istest').is(':checked');
        const isactive = row.find('.isactive').is(':checked');
        const isclosed = row.find('.isclosed').is(':checked');
        const closeAmount = parseFloat(row.find('.close-amount').val()) || 0;
        positions[positionId] = { type, strikePrice, cost, quantity, istest, isactive, isclosed, closeAmount, positionId };
        //console.log(strikePrice,type.split('_')[1],type.split('_')[0],cost);
        //console.log(calculateOptionMargin(strikePrice,type.split('_')[1],type.split('_')[0],cost)*quantity);
    }

    function calculateOptionMargin(strikePrice, optionType, positionType, premium) {
        if (positionType === 'buy') {
            throw new Error('無效的持倉類型，僅支持 "sell"。');
        }
        let a = AValue, b = BValue;
        // 計算價內外距離，調整 AValue 和 BValue
        const distance = Math.abs(underlyingPrice - strikePrice);
        if (distance >= 500) {
            a *= distance < 1000 ? 1.2 : 1.5;
            b *= distance < 1000 ? 1.2 : 1.5;
        }
        if (positionType === 'sell') {
            const outOfTheMoneyValue = 
                optionType === 'call' ? 
                    Math.max((strikePrice - underlyingPrice) * contractMultiplier, 0) : 
                    Math.max((underlyingPrice - strikePrice) * contractMultiplier, 0);
            return premium * contractMultiplier + Math.max(a - outOfTheMoneyValue, b); // 賣出選擇權，計算保證金
        }
    }

    //增加持倉項目
    function addItem(itemType, itemPrice) {

        const positionId = Math.max(
            ...$('tr[data-id]').map(function () {
                return Number($(this).data('id'));
            }).get(), 
            -1 // 當沒有任何 row 時，返回 -1
        ) + 1;
        const row = $(`
            <tr data-id="${positionId}">
                <td>
                    <select class="position-select">
                        <option value="" disabled selected>選擇類型</option>
                    </select>
                </td>
                <td><input type="text" class="strike-price" placeholder="持倉點位" /></td>
                <td><input type="text" class="cost" placeholder="建倉成本" /></td>
                <td><input type="number" class="quantity" placeholder="持倉數量" value="1" /></td>
                <td><input type="checkbox" class="istest" checked/></td>
                <td><input type="checkbox" class="isactive" checked/></td>
                <td><input type="checkbox" class="isclosed"/></td>
                <td><input type="text" class="close-amount" placeholder="平倉點數" /></td>
                <td><button class="remove-btn">移除</button></td>
            </tr>
        `); 

        // 動態加入選項
        positionOptions.forEach(option => {
            row.find('.position-select').append(new Option(option.text, option.id));
        });

        $('#positions tbody').append(row);
        if (itemType) {
            row.find('.position-select').val(itemType); // 填充選擇的類型
        }
        if (itemPrice) {
            row.find('.strike-price').val(itemPrice); // 填充持倉點位
        }

        // 觸發更新
        row.find('.position-select').trigger('change');

        row.off('click').on('click', '.remove-btn', function () {
            // 抓取被點擊的 row 的 data-id
            const idToRemove = Number(row.data('id'));
            // 根據 data-id 找到 positions 中的對應項目索引
            const indexToRemove = positions.findIndex(position => position.positionId === idToRemove);
            if (indexToRemove !== -1) {
                // 使用 splice 刪除對應項目
                positions.splice(indexToRemove, 1);
            }
            // 移除該行
            row.remove();
            // 更新圖表或其他動作
            updateChart();
        });
    }

    function calculateComboMarginAndPremium(positionIds) {

        if (positionIds.length !== 1 && positionIds.length !== 2) {
            throw new Error('僅支援一個或兩個 positionId 的組合計算。');
        }
        // 初始化變數
        let groupId = new Date().getTime(); // 使用時間戳作為分組ID
        let margin = 0;
        let premiumReceived = 0;
        let premiumPaid = 0;

        // 先檢查所有 positionId 是否有效
        const pos = positionIds.map(id => positions.find(p => p.positionId === id));
        if (pos.includes(undefined)) throw new Error('無效的 positionId。');

        // 單一持倉處理
        if (positionIds.length === 1) {
            // 檢查倉位
            const position = pos[0];
            const [positionType, optionType] = position.type.split('_');
            const isSell = positionType === 'sell';
            const isBuy = positionType === 'buy';
            if (!isSell && !isBuy) {
                throw new Error('無效的持倉類型。');
            }
            // 計算
            premiumReceived = isSell ? position.cost * position.quantity : 0;
            premiumPaid = isBuy ? position.cost * position.quantity : 0;
            margin = isSell ? calculateOptionMargin(position.strikePrice, optionType, 'sell', position.cost) : 0;

            return [positionIds[0], null, margin, premiumReceived, premiumPaid, groupId];
        }

        // 持倉分類
        const { scPos, bcPos, spPos, bpPos } = pos.reduce((acc, p) => {
            if (p.type === 'sell_call') acc.scPos = p;
            if (p.type === 'buy_call') acc.bcPos = p;
            if (p.type === 'sell_put') acc.spPos = p;
            if (p.type === 'buy_put') acc.bpPos = p;
            return acc;
        }, {});
        // 確定組合類型
        const combo = [pos[0].type, pos[1].type].sort().join(',');
        const validCombinations = [
            'sell_call,sell_put',   // SC+SP
            'buy_call,sell_call',   // BC+SC
            'buy_put,sell_put'      // BP+SP
        ];
        // 檢查組合是否有效
        if (!validCombinations.includes(combo)) {
            throw new Error('不支持的組合類型。');
        }
        // 確保 SC 的履約價 >= SP 的履約價
        if (combo === 'sell_call,sell_put' && scPos.strikePrice < spPos.strikePrice) {
            throw new Error('SC 的履約價必須大於等於 SP 的履約價。');
        }

        // 計算權利金
        const calculatePremium = (position) => position ? position.cost * position.quantity : 0;
        premiumReceived = calculatePremium(scPos) + calculatePremium(spPos);
        premiumPaid = calculatePremium(bcPos) + calculatePremium(bpPos);

        // 計算價差單保證金
        const calculateSpreadMargin = (longPos, shortPos) => {
            return (longPos.strikePrice - shortPos.strikePrice) * longPos.quantity;
        };
        if (scPos && spPos) {
            const scMargin = calculateOptionMargin(scPos.strikePrice, 'call', 'sell', scPos.cost);
            const spMargin = calculateOptionMargin(spPos.strikePrice, 'put', 'sell', spPos.cost);
            const minPos = scMargin > spMargin ? spPos : scPos;
            margin = (Math.max(scMargin, spMargin) + minPos.cost * contractMultiplier + CValue) * scPos.quantity; 
        } else if (bcPos && scPos) {
            margin = bcPos.strikePrice > scPos.strikePrice ? calculateSpreadMargin(bcPos, scPos) : 0; 
        } else if (bpPos && spPos) {
            margin = bpPos.strikePrice > spPos.strikePrice ? 0 : calculateSpreadMargin(spPos, bpPos);
        }

        // 返回結果
        return [
            positionIds[0],
            positionIds[1],
            margin,
            premiumReceived,
            premiumPaid,
            groupId
        ];
    }

    // 初始化圖表
    function initChart() {
        chart.setOption({
            title: { text: '最終結算損益線圖' },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value', name: '標的價格' },
            yAxis: { type: 'value', name: '損益' },
            series: [{ type: 'line', data: [] }]
        });
    }

    // 更新圖表
    function updateChart() {
        const totalData = [];
        const totalTestData = [];
        const onlyTestData = [];
        const profitPrice = new Array(part).fill(0); // 價位陣列
        const totalProfit = new Array(part).fill(0); // 持倉單總損益陣列
        const testTotalProfit = new Array(part).fill(0); // 測試單加持倉單總損益陣列
        const onlyTestProfit = new Array(part).fill(0); // 僅測試單損益陣列

        // 遍歷每個倉位
        positions.forEach((pos, index) => {
            // 檢查倉位數據是否完整
            if (
                !pos || 
                !pos.type || 
                pos.strikePrice === undefined || 
                pos.cost === undefined || 
                pos.quantity === undefined ||
                !pos.isactive
            ) {
                return; // 跳過這個倉位
            }

            const strikePrice = pos.strikePrice || 0;
            const cost = pos.cost || 0;
            const quantity = pos.quantity || 1;
            const test = pos.quantity || 1;
            const closeAmount = pos.closeAmount || 0;

            // 遍歷收盤價格範圍
            for (let i = 0; i <= part; i++) {
                let closingPrice = priceRange.min + (priceRange.max - priceRange.min) / part * i;
                let profit = 0;
                if(!pos.isclosed){
                    switch (pos.type) {
                        case 'long_mini':
                            profit = (closingPrice - strikePrice - cost) * quantity;
                            break;
                        case 'short_mini':
                            profit = (strikePrice - closingPrice - cost) * quantity;
                            break;
                        case 'buy_call':
                            profit = closingPrice <= strikePrice ? -cost * quantity : (closingPrice - strikePrice - cost) * quantity;
                            break;
                        case 'sell_call':
                            profit = closingPrice <= strikePrice ? cost * quantity : (cost - (closingPrice - strikePrice)) * quantity;
                            break;
                        case 'buy_put':
                            profit = closingPrice >= strikePrice ? -cost * quantity : (strikePrice - closingPrice - cost) * quantity;
                            break;
                        case 'sell_put':
                            profit = closingPrice >= strikePrice ? cost * quantity : (cost - (strikePrice - closingPrice)) * quantity;
                            break;
                    }
                }else{
                    switch (pos.type) {
                        case 'long_mini':
                            profit = (closeAmount - strikePrice) * quantity;
                            break;
                        case 'short_mini':
                            profit = (strikePrice - closeAmount) * quantity;
                            break;
                        case 'buy_call':
                            profit = (closeAmount - cost) * quantity;
                            break;
                        case 'sell_call':
                            profit = (cost - closeAmount) * quantity;
                            break;
                        case 'buy_put':
                            profit = (closeAmount - cost) * quantity;
                            break;
                        case 'sell_put':
                            profit = (cost - closeAmount) * quantity;
                            break;
                    }
                }

                if(pos.istest){
                    // 僅測試
                    onlyTestProfit[i] += profit;
                }else{
                    // 僅持倉
                    totalProfit[i] += profit;
                }
                // 測試加持倉
                testTotalProfit[i] += profit;

                profitPrice[i] = closingPrice;
            }

        });

        // 組合總損益數據
        for (let i = 0; i < totalProfit.length; i++) {
            totalData.push([profitPrice[i], totalProfit[i]*contractMultiplier]);
            totalTestData.push([profitPrice[i], testTotalProfit[i]*contractMultiplier]);
            onlyTestData.push([profitPrice[i], onlyTestProfit[i]*contractMultiplier]);
        }

        // 夜間模式配色配置
        const nightModeColors = {
            backgroundColor: '#2c343c', // 背景色
            textColor: '#dcdcdc',       // 通用文字顏色
            axisLineColor: '#888',      // 軸線顏色
            gridColor: '#555',          // 網格線顏色
            legendTextColor: '#dcdcdc', // 圖例文字顏色
            titleTextColor: '#dcdcdc',  // 標題文字顏色
            seriesColors: {
                position: 'cyan',       // 持倉線顏色
                applied: 'orange',      // 套用後線顏色
                test: 'red',            // 測試倉線顏色
            }
        };

        // 更新圖表
        chart.setOption({
            backgroundColor: nightModeColors.backgroundColor, // 背景顏色
            title: {
                textStyle: {
                    color: nightModeColors.titleTextColor, // 標題文字顏色
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    let tooltip = `${params[0].axisValue}<br>`;
                    params.forEach(item => {
                        tooltip += `${item.seriesName}: ${item.data[1].toFixed(2)}<br>`;
                    });
                    return positions.length && tooltip;
                },
            },
            legend: {
                show: true, // 開啟圖例
                textStyle: {
                    color: nightModeColors.legendTextColor, // 圖例文字顏色
                }
            },
            xAxis: {
                type: 'value',
                name: '最終收盤價格',
                nameTextStyle: {
                    color: nightModeColors.textColor // X軸名稱顏色
                },
                axisLine: {
                    lineStyle: {
                        color: nightModeColors.axisLineColor // X軸線顏色
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: nightModeColors.gridColor // 網格線顏色
                    }
                },
                min: priceRange.min,
                max: priceRange.max,
            },
            yAxis: {
                type: 'value',
                name: '損益',
                nameTextStyle: {
                    color: nightModeColors.textColor // Y軸名稱顏色
                },
                axisLine: {
                    lineStyle: {
                        color: nightModeColors.axisLineColor // Y軸線顏色
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: nightModeColors.gridColor // 網格線顏色
                    }
                },
            },
            series: [{
                name: '持倉',
                type: 'line',
                data: totalData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: nightModeColors.seriesColors.position, // 設定線顏色
                lineStyle: {
                    type: 'solid', // 設定實線
                    width: 2       // 設定線寬，視需要可調整
                }
            }, {
                name: '套用後',
                type: 'line',
                data: totalTestData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: nightModeColors.seriesColors.applied, // 設定線顏色
                lineStyle: {
                    type: 'dashed', // 設定虛線
                    width: 2       // 設定線寬，視需要可調整
                }
            }, {
                name: '測試倉',
                type: 'line',
                data: onlyTestData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: nightModeColors.seriesColors.test, // 設定線顏色
                lineStyle: {
                    type: 'dashed', // 設定虛線
                    width: 2       // 設定線寬，視需要可調整
                }
            }],
        });
    }

});






//拆倉
//組單
//計算整串的保證金

//匯出CSV
//匯入CSV
