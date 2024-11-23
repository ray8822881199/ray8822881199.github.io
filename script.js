/* jshint esversion: 6 */
/*
 * Copyright © 2024 Ray. All Rights Reserved.
 * 本網站上所有內容，包括文字、圖形、標誌、設計以及源代碼，均受到適用的著作權法律保護。  未經授權，嚴禁用於商業或非法用途的複製、分發或修改。  
 */


window.analysisWidth = 6; // 價位寬度(%)
window.part = 100; // 切成幾分

window.items=20; // 價平上下檔數
window.positions = []; // 存放所有持倉數據

window.contractMultiplier=50; // 每點價值

window.dataDate = new Date('2024-11-11'); // 資料更新日期
window.underlyingPrice = 23000; // 價平
window.isdrawtest = true; // 繪制測試倉
window.iscalctest = true; // 計算測試倉

window.opFee = 25; // 選擇權手續
window.miniFee = 25; // 期貨手續
window.totalFee = 0; // 當前手續

window.opTaxRate = 0.001; // 期交稅率(選擇權)
window.miniTaxRate = 0.00002; // 期交稅率(期貨)
window.tax = 0; // 總期交稅
window.marginInfo={
    // 原始保證金
    od:{
        miniMargin: 80500,
        AValue: 81000,
        BValue: 41000,
        CValue: 8200
    },
    // 維持保證金
    mm:{
        miniMargin: 61750,
        AValue: 63000,
        BValue: 32000,
        CValue: 6400
    }
};


// 設定 HTML 元素的內容
$("#dataGetDate").text(window.dataDate.toISOString().split('T')[0]);
$("#contractMultiplier").text(window.contractMultiplier);
$("#od-miniMargin").text(window.marginInfo.od.miniMargin);
$("#od-AValue").text(window.marginInfo.od.AValue);
$("#od-BValue").text(window.marginInfo.od.BValue);
$("#od-CValue").text(window.marginInfo.od.CValue);
$("#mm-miniMargin").text(window.marginInfo.mm.miniMargin);
$("#mm-AValue").text(window.marginInfo.mm.AValue);
$("#mm-BValue").text(window.marginInfo.mm.BValue);
$("#mm-CValue").text(window.marginInfo.mm.CValue);


// 更新畫面資訊

$(document).ready(function () {

    const tradeLine = $('<div class="trade-line"></div>').appendTo('body'); // 建倉拖拉線
    const chartDom = document.getElementById('chart');
    const chart = echarts.init(chartDom);
    //更新浮動圖表
    chart.off('finished').on('finished', function () {
        updatefloatingChart();
    });
    // 浮動圖表
    let lastChartImage = '';
    let chartRectChanged = false;
    const floatingChart = $('#floating-chart');
    floatingChart.draggable({
        containment: "window"  // 限制在視窗內部拖動
    });

    const positionOptions = [
        { id: 'long_mini', text: '小台多單' },
        { id: 'short_mini', text: '小台空單' },
        { id: 'buy_call', text: 'Buy Call' },
        { id: 'sell_call', text: 'Sell Call' },
        { id: 'buy_put', text: 'Buy Put' },
        { id: 'sell_put', text: 'Sell Put' }
    ];

    let priceRange = { min: underlyingPrice*(1-analysisWidth/100), max: underlyingPrice*(1+analysisWidth/100) }; // 收盤價格範圍（可調整）
    let point=50; // 每檔間隔
    let linewidth=5; // 建倉表拖拉線寬
    let isBuilding = false; // 是否處於建倉模式
    let startCell = null; // 開始的單元格
    let endCell = null; // 結束的單元格

    // 初始數字配入
    $('#market-price').val(underlyingPrice);
    $('#analysis-width').val(analysisWidth);
    $('#precision').val(part);
    $("#opFee").val(window.opFee);
    $("#miniFee").val(window.miniFee);

    // 配置區更新
    $('.overall_config').off('change').on('change',function () {
        underlyingPrice = Number($('#market-price').val()||underlyingPrice);
        analysisWidth = Number($('#analysis-width').val()||analysisWidth);

        isdrawtest = $('#isdrawtest').is(':checked');
        iscalctest = $('#iscalctest').is(':checked');

        opFee = Number($('#opFee').val()||opFee);
        miniFee = Number($('#miniFee').val()||miniFee);

        part = Number($('#precision').val()||part);
        priceRange = { min: underlyingPrice*(1-analysisWidth/100), max: underlyingPrice*(1+analysisWidth/100) };
 
        updateOptionTable();
        updateChart();
    });

    $('#isdrawtest').off('click').on('click', function(){
        const $isdrawtest = $(this);
        $('.istest:checked').each(function(){
            const $tr = $(this).closest('tr');
            $tr.find('.isactive').prop('checked', $isdrawtest.is(':checked'));
            updatePositions($tr);
        });
    });

    // 新增倉位
    $('#addPosition').off('click').on('click', () => addItem(0, 0,''));

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
        if (startCell.hasClass('call')) {startCell.css('background-color', '#7e0104');}
        if (startCell.hasClass('put')) {startCell.css('background-color', '#045b1c');}
    });
    // 建倉表事件 拖拉
    $(document).off('mousemove').on('mousemove', function (e) {
        if (isBuilding) {
            const nowCell = $(document.elementFromPoint(startCell.offset().left - window.scrollX, e.pageY - window.scrollY));
            const offset = startCell.offset();
            const startX = offset.left + startCell.outerWidth() * (startCell.hasClass('call')?0.25:0.75)-(startCell.hasClass('call')?linewidth:0);
            const startY = offset.top + startCell.outerHeight() * 0.5;
            const endX = e.pageX;
            const endY = e.pageY;

            if (nowCell.hasClass('call')) {nowCell.css('background-color', '#7e0104');}
            if (nowCell.hasClass('put')) {nowCell.css('background-color', '#045b1c');}

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

                const groupId = Math.max(
                    ...$('tr[data-id] .groupId').map(function () {
                        const value = $(this).val();
                        const numberPart = value.match(/\d+/); // 提取數字部分
                        return numberPart ? Number(numberPart[0]) : 0;
                    }).get(), 
                    0 // 當沒有任何 groupId 時，返回 -1
                ) + 1;

                const groupCode = 
                    (endPrice>startPrice ? 'Bull ':'Bear ')+
                    (startCell.hasClass('call') ? 'Call Spread ':'Put Spread ')+
                    groupId;

                if(e.button === 0){
                    if(startPrice!==endPrice){
                        addItem(starttype,startPrice,groupCode);
                        addItem(endtype,endPrice,groupCode);
                    }else{
                        addItem(starttype,startPrice,'');
                    }
                }else if(startPrice==endPrice){
                    addItem(endtype,endPrice,'');
                }
                updateOptionTable();
            }
        }
    });

    // 滾動事件監聽
    $(window).off('scroll').on('scroll', updatefloatingChart);

    // 建倉表禁用預設右鍵
    $('.trade-builder').off('contextmenu').on('contextmenu', function(e) {
        e.preventDefault(); 
    });

    // 持倉改動
    $('#positions tbody').off('change').on('change', 'select, input', function () {

        const $tr = $(this).closest('tr');
        const $istest = $tr.find('.istest');
        const $isclosed = $tr.find('.isclosed');

        //勾選已平倉時將測試倉取消
        $(this).hasClass('isclosed') && $istest.prop('checked', false);
        //勾選測試倉時將已平倉取消
        $(this).hasClass('istest') && $isclosed.prop('checked', false);

        updatePositions($tr);
        updateChart();
    });

    
    initChart();
    updateOptionTable();
    updateChart();

    function updatefloatingChart() {
        const chartRect = chartDom.getBoundingClientRect();
        if (chartRect.bottom < 0) {

            // 計算小圖的寬高
            const ratio = 1.7;
            // 更新浮動圖
            floatingChart.css({
                width: `${chartDom.offsetWidth / ratio}px`,
                height: `${chartDom.offsetHeight / ratio}px`,
            });
            // 使用 ECharts 提供的 getDataURL 獲取當前圖表的圖片
            if (!lastChartImage || chartRectChanged) {
                lastChartImage = chart.getDataURL({
                    backgroundColor: '#000', // 背景色
                });
                floatingChart.attr('src', lastChartImage);
            }
            floatingChart.css('visibility', 'visible');
            floatingChart.stop().animate({ opacity: 0.8 },300);
            chartRectChanged = false;
        } else {
            floatingChart.stop().animate({ opacity: 0 },300,
                function() {
                    floatingChart.css('visibility', 'hidden');
                }
            );
        }
        

    }

    function groupPositionsByGroupId(totalPositions) {
        const grouped = {};  // 用來存儲按 groupId 分組的結果
        const noGroup = [];  // 用來存儲沒有 groupId 的項目

        totalPositions.forEach(position => {
            const { groupId, positionId } = position;
            if(position.isclosed||!position.isactive) return; // 不處理已平倉或不計算的保證金
            if (groupId) {
                // 如果有 groupId，將 positionId 加入相應的 groupId 陣列
                if (!grouped[groupId]) {
                    grouped[groupId] = [];  // 如果這個 groupId 還沒出現過，先創建一個空陣列
                }
                grouped[groupId].push(positionId);
            } else {
                // 如果沒有 groupId，將這筆資料放入 noGroup 陣列
                noGroup.push([positionId]);
            }
        });

        // 將 grouped 與 noGroup 合併
        const groupedArray = Object.keys(grouped).map(groupId => grouped[groupId]);
        return [...groupedArray, ...noGroup];
    }

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
        const positionId = Number(row.data('id'));
        const type = row.find('.position-select').val();
        const strikePrice = parseFloat(row.find('.strike-price').val()) || 0;
        const cost = parseFloat(row.find('.cost').val()) || 0;
        const quantity = parseFloat(row.find('.quantity').val()) || 0;
        const istest = row.find('.istest').is(':checked');
        const isactive = row.find('.isactive').is(':checked');
        const isclosed = row.find('.isclosed').is(':checked');
        const closeAmount = parseFloat(row.find('.close-amount').val()) || 0;
        const groupId = row.find('.groupId').val() || '';
        const pos = positions.find((p) => p.positionId === positionId);
        if(pos){
            Object.assign(pos, {type,strikePrice,cost,quantity,istest,isactive,isclosed,closeAmount,groupId});
        }else{
            positions.push({type,strikePrice,cost,quantity,istest,isactive,isclosed,closeAmount,positionId,groupId});
        }
    }

    function calculateOptionMargin(strikePrice, optionType, positionType, premium, price, isOriginal) {
        if (positionType === 'buy') {
            throw new Error('無效的持倉類型，僅支持 "sell"。');
        }

        let a = 0, b = 0;
        if(isOriginal){
            a = marginInfo.od.AValue || 0;
            b = marginInfo.od.BValue || 0;
        }else{
            a = marginInfo.mm.AValue || 0;
            b = marginInfo.mm.BValue || 0;
        }

        // 計算價內外距離，調整 AValue 和 BValue
        const distance = Math.abs(price - strikePrice);
        if (distance >= 500) {
            a *= distance < 1000 ? 1.2 : 1.5;
            b *= distance < 1000 ? 1.2 : 1.5;
        }
        if (positionType === 'sell') {
            const outOfTheMoneyValue = 
                optionType === 'call' ? 
                    Math.max((strikePrice - price) * contractMultiplier, 0) : 
                    Math.max((price - strikePrice) * contractMultiplier, 0);
            return premium * contractMultiplier + Math.max(a - outOfTheMoneyValue, b); // 賣出選擇權，計算保證金
        }
    }

    //增加持倉項目
    function addItem(itemType, itemPrice, itemGroupId) {

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
                <td><input type="number" class="strike-price" placeholder="持倉點位" /></td>
                <td><input type="number" class="cost" placeholder="建倉成本" /></td>
                <td><input type="number" class="quantity" placeholder="持倉數量" value="1" /></td>
                <td><input type="checkbox" class="istest" checked/></td>
                <td><input type="checkbox" class="isactive" ${isdrawtest?'checked':''}/></td>
                <td><input type="checkbox" class="isclosed"/></td>
                <td><input type="number" class="close-amount" placeholder="平倉點數" /></td>
                <td><input type="text" class="groupId" placeholder="分組標籤" /></td>
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
        if (itemGroupId) {
            row.find('.groupId').val(itemGroupId); // 填充 groupId
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

    function calculateComboMarginAndPremium(positionIds, price, isOriginal) {

        if (positionIds.length !== 1 && positionIds.length !== 2) {
            throw new Error('僅支援一個或兩個 positionId 的組合計算。');
        }
        // 初始化變數
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
            if (position.type == null) {
                return {
                    p1: positionIds[0],
                    p2: null,
                    margin: 0,
                    premiumReceived: 0,
                    premiumPaid: 0
                };
            }
            const [positionType, optionType] = position.type.split('_');
            const isSell = positionType === 'sell';
            const isBuy = positionType === 'buy';
            const isMini = optionType === 'mini';

            if (!isSell && !isBuy && !isMini) {
                throw new Error('無效的持倉類型。');
            }
            // 計算
            premiumReceived = isSell ? position.cost * position.quantity : 0;
            premiumPaid = isBuy ? position.cost * position.quantity : 0;
            margin = isSell ? calculateOptionMargin(position.strikePrice, optionType, 'sell', position.cost, price, isOriginal) : 0;

            if(isMini){
                premiumReceived = 0;
                premiumPaid = 0;
                margin = isOriginal ? marginInfo.od.miniMargin : marginInfo.mm.miniMargin;
            }

            return {
                p1: positionIds[0],
                p2: null,
                margin: margin,
                premiumReceived: premiumReceived,
                premiumPaid: premiumPaid
            };
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
            return (longPos.strikePrice - shortPos.strikePrice) * longPos.quantity * contractMultiplier;
        };
        if (scPos && spPos) {
            const c = isOriginal ? marginInfo.od.CValue : marginInfo.mm.CValue;
            const scMargin = calculateOptionMargin(scPos.strikePrice, 'call', 'sell', scPos.cost, price, isOriginal);
            const spMargin = calculateOptionMargin(spPos.strikePrice, 'put', 'sell', spPos.cost, price, isOriginal);
            const minPos = scMargin > spMargin ? spPos : scPos;
            margin = (Math.max(scMargin, spMargin) + minPos.cost * contractMultiplier + c) * scPos.quantity; 
        } else if (bcPos && scPos) {
            margin = bcPos.strikePrice > scPos.strikePrice ? calculateSpreadMargin(bcPos, scPos) : 0; 
        } else if (bpPos && spPos) {
            margin = bpPos.strikePrice > spPos.strikePrice ? 0 : calculateSpreadMargin(spPos, bpPos);
        }

        // 返回結果
        return {
            p1: positionIds[0],
            p2: positionIds[1],
            margin: margin,
            premiumReceived: premiumReceived,
            premiumPaid: premiumPaid
        };
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
        const od_marginData = [];
        const mm_marginData = [];
        const profitRateData = [];


        const profitPrice = new Array(part).fill(0); // 價位陣列
        const totalProfit = new Array(part).fill(0); // 持倉單總損益陣列
        const testTotalProfit = new Array(part).fill(0); // 測試單加持倉單總損益陣列
        const onlyTestProfit = new Array(part).fill(0); // 僅測試單損益陣列

        const od_totalMargin = new Array(part).fill(0); // 保證金陣列
        const mm_totalMargin = new Array(part).fill(0); // 保證金陣列

        const profitRate = new Array(part).fill(0); // 獲利率陣列

        chartRectChanged = true;

        //更新分組資料
        const groupPositions = groupPositionsByGroupId(positions);

        // 測試加持倉的保證金
        for (let i = 0; i <= part; i++) {
            let closingPrice = priceRange.min + (priceRange.max - priceRange.min) / part * i;
            for (let index = 0; index < groupPositions.length; index++) {
                let ps = groupPositions[index];
                // 計算每個 position 組合的保證金和權利金
                const od_marginData = calculateComboMarginAndPremium(ps, closingPrice, true);
                const mm_marginData = calculateComboMarginAndPremium(ps, closingPrice, false);
                od_totalMargin[i] += od_marginData.margin;
                mm_totalMargin[i] += mm_marginData.margin;
            }
        }
        
        // 計算測試倉個數
        let testPositionsCount = 0; 
        // 計算總交易個數
        let tradeOpCount = 0; 
        let tradeMiniCount = 0;
        // 總期交稅
        let totalOpTax = 0.0; 
        let totalMiniTax = 0.0;

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

            const isMini = pos.type.split('_')[1] === 'mini';
            const isClosed = pos.isclosed;
            const isTest = pos.istest;

            // 稅額計算公式
            const taxBase = cost * contractMultiplier;
            const taxBaseClose = ( isClosed ? closeAmount : 0 ) * contractMultiplier;

            if(!isTest || iscalctest){
                if (isMini) {
                    // 手續費
                    tradeMiniCount += (isClosed ? quantity * 2 : quantity);
                    // 期交稅計算
                    totalMiniTax += (Math.round(taxBase * miniTaxRate,0) + Math.round(taxBaseClose * miniTaxRate,0)) * quantity;
                } else {
                    // 手續費
                    tradeOpCount += (isClosed ? quantity * 2 : quantity);
                    // 期交稅計算
                    totalOpTax += (Math.round(taxBase * opTaxRate,0) + Math.round(taxBaseClose * opTaxRate,0)) * quantity;
                }
            }

            // 遍歷收盤價格範圍
            for (let i = 0; i <= part; i++) {
                let closingPrice = Math.round(priceRange.min + (priceRange.max - priceRange.min) / part * i,0);
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
                    testPositionsCount++;
                }else{
                    // 僅持倉
                    totalProfit[i] += profit;
                }
                // 測試加持倉
                testTotalProfit[i] += profit;
                profitPrice[i] = closingPrice;
            }

        });

        // 計算手續費
        const totalMiniFee = tradeMiniCount * miniFee;
        const totalOpFee = tradeOpCount * opFee;
        const totalFee = totalMiniFee + totalOpFee;
        // 計算期交稅
        const totalTax = totalMiniTax + totalOpTax;

        const feeAndTax = totalFee + totalTax;

        $('#totalTaxAndFee').text(` (${totalMiniFee} + ${totalMiniTax}) + (${totalOpFee} + ${totalOpTax}) = ${feeAndTax} `);


        // 組合總損益數據
        profitPrice.forEach((price, i) => {

            // 組合損益數據
            totalData.push([price, totalProfit[i] * contractMultiplier - feeAndTax]);

            if (testPositionsCount > 0) {
                totalTestData.push([price, testTotalProfit[i] * contractMultiplier - feeAndTax]);
                onlyTestData.push([price, onlyTestProfit[i] * contractMultiplier - feeAndTax]);
            }

            // 組合保證金數據
            od_marginData.push([price, od_totalMargin[i]]);
            mm_marginData.push([price, mm_totalMargin[i]]);

            // 保證金獲利率
            profitRateData.push(
                [
                    price, 
                    od_totalMargin[i] !== 0 ? ((testTotalProfit[i] * contractMultiplier - feeAndTax) / od_totalMargin[i]) : 0
                ]
            );
        });

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
                od: '#B766AD',          // 原始保證金線顏色
                mm: '#B766AD',          // 維持保證金線顏色
            },
            tooltipBackgroundColor: 'rgba(0, 0, 0, 0.4)', // 提示框背景色 (深色，70%透明度)
            tooltipTextColor: '#dcdcdc'                   // 提示框文字顏色
        };

        // 更新圖表
        chart.setOption({
            backgroundColor: nightModeColors.backgroundColor, // 背景顏色
            title: {
                textStyle: {
                    color: nightModeColors.titleTextColor // 標題文字顏色
                }
            },
            axisPointer: {
                type: 'cross', // 交叉指示器
                label: { backgroundColor: '#6a7985' },
                link: { xAxisIndex: 'all' },
            },
            tooltip: {
                trigger: 'axis', // 軸觸發
                backgroundColor: nightModeColors.tooltipBackgroundColor, // 背景顏色 (透明度 70%)
                textStyle: {
                    color: nightModeColors.tooltipTextColor, // 文字顏色
                    fontWeight: 'bold' // 粗體
                },
                formatter: function (params) {
                    // 當只有未選 type 的倉在清單中時會顯示一長串的 tooltip
                    if (!positions.find((p) => p.type !== null && p.isactive)) {
                        return null; // 不顯示 tooltip
                    }

                    // 取得點位
                    let tooltipContent = `點位：${params[0].axisValue}<br>`;
                    let positionContent = ""; // 用於存放持倉內容
                    let marginContent = "";   // 用於存放保證金內容
                    // 遍歷每一條線
                    params.forEach(item => {
                        let value = Array.isArray(item.data) ? item.data[1] : item.data; // 取得數據
                        let content = `
                            <div style="display: flex; justify-content: space-between; width: 200px;">
                                <span style="text-align: left;">${item.marker}${item.seriesName}</span>
                                <span style="text-align: right;">${value.toFixed(2)}</span>
                            </div>
                        `;
                        if (['持倉','測試倉套用','測試倉'].includes(item.seriesName)) {
                            positionContent += content;
                        } else if (['原始保證金','維持保證金'].includes(item.seriesName)) {
                            marginContent += content;
                        } else if (['保證金獲利率'].includes(item.seriesName)) {
                            marginContent += `
                            <div style="display: flex; justify-content: space-between; width: 200px;">
                                <span style="text-align: left;">${item.marker}${item.seriesName}</span>
                                <span style="text-align: right;">${(value*100).toFixed(2)}%</span>
                            </div>
                        `;
                        }
                    });
                    // 返回格式化的 tooltip 內容
                    tooltipContent += positionContent + `<br>保證金：<br>` + marginContent;
                    return tooltipContent;
                }
            },
            grid: [
                {
                    top: '14%', // 上方圖表位置
                    height: '50%' // 上方圖表高度
                },
                {
                    top: '72%', // 下方圖表位置
                    height: '20%' // 下方圖表高度
                }
            ],
            legend: {
                show: true, // 開啟圖例
                textStyle: {
                    color: nightModeColors.legendTextColor, // 圖例文字顏色
                }
            },
            xAxis: [
                {

                    gridIndex: 0, 
                    type: 'value',
                    name: '最終收盤價格',
                    nameTextStyle: {
                        color: nightModeColors.textColor // X 軸名稱顏色
                    },
                    axisLine: {
                        lineStyle: {
                            color: nightModeColors.axisLineColor // X 軸線顏色
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
                {
                    gridIndex: 1, 
                    type: 'value',
                    nameTextStyle: {
                        color: nightModeColors.textColor // X 軸名稱顏色
                    },
                    axisLine: {
                        lineStyle: {
                            color: nightModeColors.axisLineColor // X 軸線顏色
                        },
                        show: false,
                    },
                    axisTick:{show: false},
                    splitLine: {
                        lineStyle: {
                            color: nightModeColors.gridColor // 網格線顏色
                        }
                    },
                    min: priceRange.min,
                    max: priceRange.max,
                },
                {
                    gridIndex: 1, 
                    type: 'value',
                    show: false,
                    min: priceRange.min,
                    max: priceRange.max,
                }
            ],
            yAxis: [
                {
                    gridIndex: 0, // 上方圖表 Y 軸
                    type: 'value',
                    name: '損益',
                    nameTextStyle: {
                        color: nightModeColors.textColor // Y 軸名稱顏色
                    },
                    axisLine: {
                        lineStyle: {
                            color: nightModeColors.axisLineColor // Y 軸線顏色
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: nightModeColors.gridColor // 網格線顏色
                        }
                    }
                },
                {
                    gridIndex: 1, // 下方圖表 Y 軸
                    type: 'value',
                    nameTextStyle: {
                        color: nightModeColors.textColor // Y 軸名稱顏色
                    },
                    axisLine: {
                        lineStyle: {
                            color: nightModeColors.axisLineColor // Y 軸線顏色
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: nightModeColors.gridColor // 網格線顏色
                        }
                    },
                    min: 'dataMin',
                    splitNumber: 3,
                },
                {
                    gridIndex: 1, 
                    type: 'value',
                    show: false,
                    min: 'dataMin',
                }
            ],
            visualMap: {
                seriesIndex:5,
                show: false,
                pieces: [
                    {
                        gt: -1000,
                        lte: 0,
                        color: '#0f0'
                    }
                ],
                outOfRange: {
                    color: '#f00'
                }
            },
            series: [
                // 上方圖表數據
                {
                    name: '持倉',
                    type: 'line',
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: totalData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.position,
                    lineStyle: {
                        width: 2
                    }
                },
                {
                    name: '測試倉套用',
                    type: 'line',
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: totalTestData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.applied,
                    lineStyle: {
                        type: 'dashed',
                        width: 1
                    }
                },
                {
                    name: '測試倉',
                    type: 'line',
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: onlyTestData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.test,
                    lineStyle: {
                        type: 'dashed',
                        width: 1
                    }
                },
                // 下方圖表數據
                {
                    name: '原始保證金',
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: od_marginData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.od,
                    lineStyle: {
                        width: 2
                    }
                },
                {
                    name: '維持保證金',
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: mm_marginData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.mm,
                    lineStyle: {
                        type: 'dashed',
                        width: 2
                    }
                },
                {
                    name: '保證金獲利率',
                    type: 'line',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: profitRateData,
                    symbol: 'none',
                    emphasis: {
                        focus: 'series',
                    },
                    color: nightModeColors.seriesColors.applied,
                    lineStyle: {
                        type: 'dashed',
                        width: 2
                    }
                }
            ]
        });

    }

});





