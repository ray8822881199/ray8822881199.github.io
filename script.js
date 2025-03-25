/* jshint esversion: 8 */
/*
 * Copyright © 2024 Ray. All Rights Reserved.
 * 本網站上所有內容，包括文字、圖形、標誌、設計以及源代碼，均受到適用的著作權法律保護。  未經授權，嚴禁用於商業或非法用途的複製、分發或修改。  
 */


window.analysisWidth = 6; // 價位寬度(%)
window.part = 100; // 切成幾分

window.items=20; // 價平上下檔數
window.positions = []; // 存放所有持倉數據

window.contractMultiplier=50; // 每點價值

window.dataDate = new Date('2025-03-25'); // 資料更新日期
window.underlyingPrice = 23000; // 價平
window.isdrawtest = true; // 繪制測試倉
window.iscalctest = true; // 計算測試倉
window.isshowfloatchart = true; // 計算測試倉

window.opFee = 25; // 選擇權手續
window.miniFee = 25; // 期貨手續
window.totalFee = 0; // 當前手續

window.opTaxRate = 0.001; // 期交稅率(選擇權)
window.miniTaxRate = 0.00002; // 期交稅率(期貨)
window.tax = 0; // 總期交稅
window.marginInfo={
    // 原始
    od:{
        miniMargin: 76750,
        microMargin: 15350,
        AValue: 77000,
        BValue: 39000,
        CValue: 7800
    },
    // 維持
    mm:{
        miniMargin: 58750,
        microMargin: 11750,
        AValue: 59000,
        BValue: 30000,
        CValue: 6000
    }
};

// 限制資料位元數 小數部分只取一位 其餘失真
window.jsonDataLength = {
    type: 3, // 資料 < 8
    istest: 1,
    isactive: 1,
    isclosed: 1,
    strikePrice: 16, // 大盤點位 < 65536
    quantity: 10, // 持倉口數 < 1024
    cost: 16, // 成本*10 < 65536
    closeAmount: 16 // 平倉*10 < 65536
};

// 設定 HTML 元素的內容
$("#dataGetDate").text(window.dataDate.toISOString().split('T')[0]);
$("#contractMultiplier").text(window.contractMultiplier);
$("#od-miniMargin").text(window.marginInfo.od.miniMargin);
$("#od-microMargin").text(window.marginInfo.od.microMargin);
$("#od-AValue").text(window.marginInfo.od.AValue);
$("#od-BValue").text(window.marginInfo.od.BValue);
$("#od-CValue").text(window.marginInfo.od.CValue);
$("#mm-miniMargin").text(window.marginInfo.mm.miniMargin);
$("#mm-microMargin").text(window.marginInfo.mm.microMargin);
$("#mm-AValue").text(window.marginInfo.mm.AValue);
$("#mm-BValue").text(window.marginInfo.mm.BValue);
$("#mm-CValue").text(window.marginInfo.mm.CValue);
$("#opTaxRate").text(window.opTaxRate);
$("#miniTaxRate").text(window.miniTaxRate);


const tradeLine = $('<div class="trade-line" style="z-Index: 100000000;"></div>').appendTo('body'); // 建倉拖拉線
const chartDom = document.getElementById('chart');
const chart = echarts.init(chartDom);

let lastChartImage = '';
let chartRectChanged = false;
const floatingChart = $('#floating-chart');
const btt = $('.back-to-top');

const positionOptions = [
    { id: 'long_mini', text: '小台多單' },
    { id: 'short_mini', text: '小台空單' },
    { id: 'long_micro', text: '微台多單' },
    { id: 'short_micro', text: '微台空單' },
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


// 畫面主邏輯
$(document).ready(function () {

    //更新浮動圖表
    chart.off('finished').on('finished', function () {
        updatefloatingChart();
    });
    // 浮動圖表
    floatingChart.draggable({
        containment: "window"  // 限制在視窗內部拖動
    });


    // 初始數字配入
    $('#market-price').val(underlyingPrice);
    $('#analysis-width').val(analysisWidth);
    $('#precision').val(part);
    $("#opFee").val(window.opFee);
    $("#miniFee").val(window.miniFee);

    // 滾動到咖啡
    $('.scroll-link').off('click').on('click', function(event) {
        event.preventDefault();
        const target = $($(this).attr('href')); 
        $('html, body').animate({
            scrollTop: target.offset().top
        }, 200);
    });

    // 配置區更新
    $('.overall_config').off('change').on('change',function () {
        underlyingPrice = Number($('#market-price').val()||underlyingPrice);
        analysisWidth = Number($('#analysis-width').val()||analysisWidth);

        isdrawtest = $('#isdrawtest').is(':checked');
        iscalctest = $('#iscalctest').is(':checked');
        isshowfloatchart = $('#isshowfloatchart').is(':checked');

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
    $('#addPosition').off('click').on('click', () => addItem(0, 0,'',0,1));

    // 測試倉轉持倉
    $('#comfirmPosition').off('click').on('click', function(){
        $('.istest:checked').each(function(){
            $(this).prop('checked', false);
            updatePositions($(this).closest('tr'));
        });
        updateChart();
    });


    const getTouchEventPosition = (event) => {
        const touch = event.touches[0] || event.changedTouches[0];
        return { pageX: touch.pageX, pageY: touch.pageY };
    };

    // mousedown/touchstart
    $('#optionTable').on('mousedown touchstart', 'td.call, td.put', function (e) {
        e.stopPropagation(); // 防止事件冒泡
        e.preventDefault(); // 防止觸控事件與預設行為（如滾動）衝突
        isBuilding = true;
        startCell = $(this);
        const { pageX, pageY } = e.type === 'touchstart' ? getTouchEventPosition(e.originalEvent) : e;

        tradeLine.show().css({ top: pageY, left: pageX, height: 0 });
        if (startCell.hasClass('call')) {
            startCell.css('background-color', '#7e0104');
        }
        if (startCell.hasClass('put')) {
            startCell.css('background-color', '#045b1c');
        }
    });

    // mousemove/touchmove
    $(document).on('mousemove touchmove', function (e) {
        if (isBuilding) {
            const { pageX, pageY } = e.type === 'touchmove' ? getTouchEventPosition(e.originalEvent) : e;
            const offset = startCell.offset();
            const nowCell = $(document.elementFromPoint(
                offset.left - window.scrollX + 5,
                pageY - window.scrollY
            ));
            //$('#debug').text(`${getTouchEventPosition(e.originalEvent)}`);
            const startX = offset.left + startCell.outerWidth() * (startCell.hasClass('call') ? 0.25 : 0.75) - (startCell.hasClass('call') ? linewidth : 0);
            const startY = offset.top + startCell.outerHeight() * 0.5;

            if (nowCell.hasClass('call')) {
                nowCell.css('background-color', '#7e0104');
            }
            if (nowCell.hasClass('put')) {
                nowCell.css('background-color', '#045b1c');
            }

            tradeLine.css({
                'width': linewidth,
                'height': Math.abs(pageY - startY),
                'top': Math.min(startY, pageY),
                'left': startX,
                'background-color': (startCell.hasClass('call') && pageY > startY) || (!startCell.hasClass('call') && pageY < startY) ? '#f00' : '#0f0'
            });
        }
    });

    // mouseup/touchend
    $(document).on('mouseup touchend', function (e) {
        if (isBuilding) {
            isBuilding = false;
            tradeLine.hide();

            const { pageX, pageY } = e.type === 'touchend' ? getTouchEventPosition(e.originalEvent) : e;
            const endCell = $(document.elementFromPoint(
                startCell.offset().left - window.scrollX + 5,
                pageY - window.scrollY
            ));

            if (endCell && endCell.closest('#optionTable').length > 0 && (endCell.hasClass('call') || endCell.hasClass('put'))) {
                const startPrice = startCell.siblings('.strike').text();
                const endPrice = endCell.siblings('.strike').text();
                const startType = startCell.hasClass('call') ? 'buy_call' : 'buy_put';
                const endType = endCell.hasClass('call') ? 'sell_call' : 'sell_put';

                const groupId = Math.max(
                    ...$('tr[data-id] .groupId').map(function () {
                        const value = $(this).val();
                        const numberPart = value.match(/\d+/); // 提取數字部分
                        return numberPart ? Number(numberPart[0]) : 0;
                    }).get(),
                    0
                ) + 1;

                const groupCode = 
                    (endPrice > startPrice ? 'Bull ' : 'Bear ') +
                    (startCell.hasClass('call') ? 'Call Spread ' : 'Put Spread ') +
                    groupId;

                if ((e.button === 0 && e.type === 'mouseup') || (e.type === 'touchend')) {
                    if (startPrice !== endPrice) {
                        addItem(startType, startPrice, groupCode, null, 1);
                        addItem(endType, endPrice, groupCode, null, 1);
                    } else {
                        addItem(startType, startPrice, '', null, 1);
                    }
                } else if (startPrice == endPrice) {
                    addItem(endType, endPrice, '', null, 1);
                }
            }
            updateOptionTable();
            finishBuild();
        }
        // 隱藏tooltip
        chart.dispatchAction({
            type: 'hideTip'
        });
    });

    $('#overlay').off('click').on('click', function () {
        finishBuild();
    });

    $("#mobileAddPosition").off('click').on('click', function () {
        $('#overlay').show();
        //遮罩
        $('#overlay').css({
            position: 'fixed',
            top: '0',
            left: '0',
            width:'100vw',
            height:'100vh',
            zIndex:99999999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
        $('.trade-builder').show().css({
            border: '2px #ccc solid',
            borderRadius: '7px',
            display: 'block',
            position: 'fixed',
            top: '25vh',
            left: '10vw',
            height: '50vh',
            width: '80vw',
            zIndex: 100000000,
            overflowY: 'scroll',
            backgroundColor: '#151515' 
        });
        // 固定表格的 thead 樣式
        $('#optionTable>thead').css({
            position: 'sticky',
            top: '-1px',
            zIndex: 100000001,
            backgroundColor: '#151515' 
        });
        // 禁止 body 滾動
        $('body').css({
            overflow: 'hidden' // 禁用滾動
        });
        // 滾動到畫面中間（內容的 50%）
        const tradeBuilder = $('.trade-builder');
        const scrollHeight = tradeBuilder[0].scrollHeight; // 獲取內容高度
        const targetScroll = scrollHeight / 2 - (window.innerHeight * 0.25); // 計算目標位置

        tradeBuilder.animate({
            scrollTop: targetScroll
        }, 300); // 500 毫秒的動畫時間
    });


    // 滾動事件監聽
    $(window).off('scroll').on('scroll', updatefloatingChart);

    // 匯出
    $('#exportButton').off('click').on('click', function(e){
        exportJSONToCSV(positions, "positions.csv");
    });
    // 匯入
    $("#importButton").off('click').on("click", async function () {
        const $input = $("#csvFileInput"); 
        if (!$input[0].files || $input[0].files.length === 0) {
            alert("請選擇檔案");
            return;
        }
        const file = $input[0].files[0]; // 取得檔案
        try {
            const json = await importCSVFile(file);
            //$("#output").text(JSON.stringify(json, null, 4)); // 更新輸出內容
            console.log(json);
            processImportedJSON(json);

        } catch (error) {
            console.error(error);
            alert("匯入失敗");
        }
    });

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

    // 清空艙位
    $('#clearPosition').off('click').on('click', function(){
        $('.remove-btn').trigger('click');
    });

    getUrlPosi();
    initChart();
    updateOptionTable();
    updateChart();

});

window.finishBuild = function() {
    if(window.matchMedia("(orientation: portrait)").matches){   
        $('.trade-builder').hide();
    }
    $('.close-pnl').hide();
    $('#overlay').hide();
    $('body').css({
        overflow: ''
    });
};

window.setShareInfo = function() {
    try {
        $('.sharethis-inline-share-buttons')
            .attr('data-url', getShareUrl())
            .attr('data-title', `我的持倉規劃： 一共 ${positions.length} 個部位。`)
            .attr('data-description', '快來看看！');
    } catch (error) {
        console.log('設定分享資訊時發生錯誤');
        $('.sharethis-inline-share-buttons')
            .attr('data-url', window.location.origin + window.location.pathname)
            .attr('data-title', `我的持倉規劃： 一共 ${positions.length} 個部位。`)
            .attr('data-description', '快來看看！');
    }
};

window.getShareUrl = function() {
    const processedPositions = positions.map(position => {
        const base36Data = getBase36FromData(position); // 將所有數字進行二進位編制
        const gid = position.groupId
            .replace(/\bBull Put Spread\b/g, 'bup')
            .replace(/\bBear Put Spread\b/g, 'bep')
            .replace(/\bBull Call Spread\b/g, 'buc')
            .replace(/\bBear Call Spread\b/g, 'bec');
        return {
            b: base36Data,
            t: gid
        };
    });

    const jsonString = JSON.stringify(processedPositions).replace(/\s+/g, '');
    const compressed = pako.gzip(jsonString);
    const base64Compressed = btoa(String.fromCharCode.apply(null, new Uint8Array(compressed)));
    
    const preUrl = window.location.origin + window.location.pathname;
    return `${preUrl}?data=${encodeURIComponent(base64Compressed)}`;
};


// 檢查網址有無持倉資料
window.getUrlPosi = function() {

    const urlParams = new URLSearchParams(window.location.search);
    const encodedJson = urlParams.get('data');
    if (encodedJson) {
        // 解碼 Base64 字串
        let byteArray = Uint8Array.from(atob(decodeURIComponent(encodedJson)), c => c.charCodeAt(0));
        
        // 使用 Pako 解壓縮
        let decompressed = pako.ungzip(byteArray, { to: 'string' });
        let positionJson = JSON.parse(decompressed).map(p => {
            return getDataFromBase36(p);
        });

        processImportedJSON(positionJson);
        // 網址清除資料
        history.replaceState(null, "", window.location.origin + window.location.pathname);
    }
};

window.getDataFromBase36 = function (p) {

    const typeMap = ["long_mini", "short_mini", "buy_call", "sell_call", "buy_put", "sell_put", "long_micro", "short_micro"];
    const d = convertBase36to10(p.b);

    let shift = 0;
    // 解析數據
    function extractBits(data, length) {
        const mask = (1 << length) - 1;
        const value = (data >> BigInt(shift)) & BigInt(mask);
        shift += length;
        return Number(value);
    }
    let position = {};
    // 嚴格要求反向執行
    position.closeAmount = extractBits(d, jsonDataLength.closeAmount) / 10; // 還原小數
    position.cost = extractBits(d, jsonDataLength.cost) / 10; // 還原小數
    position.quantity = extractBits(d, jsonDataLength.quantity);
    position.strikePrice = extractBits(d, jsonDataLength.strikePrice);
    position.isclosed = extractBits(d, jsonDataLength.isclosed) === 1;
    position.isactive = extractBits(d, jsonDataLength.isactive) === 1;
    position.istest = extractBits(d, jsonDataLength.istest) === 1;
    position.type = typeMap[extractBits(d, jsonDataLength.type)];
    position.groupId = p.t
            .replace(/\bbup\b/g, 'Bull Put Spread')
            .replace(/\bbep\b/g, 'Bear Put Spread')
            .replace(/\bbuc\b/g, 'Bull Call Spread')
            .replace(/\bbec\b/g, 'Bear Call Spread');
    return position;
};

window.getBase36FromData = function (position) {

    const typeMap = {
        "long_mini": 0,
        "short_mini": 1,
        "buy_call": 2,
        "sell_call": 3,
        "buy_put": 4,
        "sell_put": 5,
        "long_micro": 6,
        "short_micro": 7
    };

    let combined = 0n;

    // 將數據壓縮為二進位
    function appendBits(value, length) {
        combined = (combined << BigInt(length)) | BigInt(value);
    }
    // 嚴格要求此處執行順序 解碼時嚴格要求反向執行
    appendBits(typeMap[position.type], jsonDataLength.type);
    appendBits(position.istest ? 1 : 0, jsonDataLength.istest);
    appendBits(position.isactive ? 1 : 0, jsonDataLength.isactive);
    appendBits(position.isclosed ? 1 : 0, jsonDataLength.isclosed);
    appendBits(position.strikePrice, jsonDataLength.strikePrice);
    appendBits(position.quantity, jsonDataLength.quantity);
    appendBits(Math.floor(position.cost * 10), jsonDataLength.cost); // 放大小數
    appendBits(Math.floor(position.closeAmount * 10), jsonDataLength.closeAmount); // 放大小數 
    return combined.toString(36);

};

window.convertBase36to10 = function (data) {
  const charSet = '0123456789abcdefghijklmnopqrstuvwxyz'; // 36進制字符集

  let decimalValue = BigInt(0); // 初始為 0，並使用 BigInt 處理大數
  for (let i = 0; i < data.length; i++) {
    let charValue = charSet.indexOf(data[i].toLowerCase());
    decimalValue = decimalValue * BigInt(36) + BigInt(charValue);
  }
  return decimalValue;
}


window.updatefloatingChart = function () {
    const chartRect = chartDom.getBoundingClientRect();

    if (chartRect.top < 0) {
        btt.css('visibility', 'visible');
        btt.stop().animate({ opacity: 0.5 },300);
    } else {
        btt.stop().animate({ opacity: 0 },300,
            function() {
                btt.css('visibility', 'hidden');
            }
        );
    }
    
    if(!isshowfloatchart) return;
    if (chartRect.bottom < 0) {
        // 計算小圖的寬高
        const ratio = 2.4;
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
        floatingChart.stop().animate({ opacity: 0.95 },300);
        chartRectChanged = false;
    } else {
        floatingChart.stop().animate({ opacity: 0 },300,
            function() {
                floatingChart.css('visibility', 'hidden');
            }
        );
    }
};

window.groupPositionsByGroupId = function (totalPositions) {
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
};

window.updateOptionTable = function () {
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
};

window.updatePositions = function (row) {
    const $cost = row.find('.cost');

    const positionId = Number(row.data('id'));
    const type = row.find('.position-select').val();
    const strikePrice = parseFloat(row.find('.strike-price').val()) || 0;
    const cost = parseFloat($cost.val()) || 0;
    const quantity = parseFloat(row.find('.quantity').val()) || 0;
    const istest = row.find('.istest').is(':checked');
    const isactive = row.find('.isactive').is(':checked');
    const isclosed = row.find('.isclosed').is(':checked');
    const closeAmount = parseFloat(row.find('.close-amount').val()) || 0;
    const groupId = row.find('.groupId').val() || '';
    const pos = positions.find((p) => p.positionId === positionId);

    // 期貨填寫格式限制
    if (type && (type.split('_')[1] === 'mini' || type.split('_')[1] === 'micro')) {
        $cost.prop('readonly', true); 
    } else {
        $cost.prop('readonly', false);
    }

    if(pos){
        Object.assign(pos, {type,strikePrice,cost,quantity,istest,isactive,isclosed,closeAmount,groupId});
    }else{
        positions.push({type,strikePrice,cost,quantity,istest,isactive,isclosed,closeAmount,positionId,groupId});
    }
};

window.calculateOptionMargin = function (strikePrice, optionType, positionType, premium, price, isOriginal) {
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
};

window.addItem = function (itemType, itemPrice, itemGroupId, itemCost, itemQuantity, istest=1, isactive=1, isclosed=0, closeCost=0) {
    const positionId = Math.max(
        ...$('tr[data-id]').map(function () {
            return Number($(this).data('id'));
        }).get(), 
        -1 // 當沒有任何 row 時，返回 -1
    ) + 1;
    const row = $(`
        <tr data-id="${positionId}" class="position-row">
            <td><button class="remove-btn">移除</button></td>
            <td>
                <select class="position-select">
                    <option value="" disabled selected>選擇類型</option>
                </select>
            </td>
            <td><input type="number" inputmode="numeric" class="strike-price" placeholder="持倉點位" style="width: 70px;"/></td>
            <td><input type="number" inputmode="decimal" class="cost" placeholder="建倉成本" style="width: 70px;"/></td>
            <td>
                <div class="quantity-wrapper">
                    <input type="number" inputmode="numeric" class="quantity" placeholder="持倉數量" value="1" style="width: 50px;"/>
                    <button type="button" class="quantity-btn increase-btn" style="width: 30px;">+</button>
                    <button type="button" class="quantity-btn decrease-btn" style="width: 30px;">-</button>
                </div>
            </td>
            <td><input type="checkbox" class="istest" checked/></td>
            <td><input type="checkbox" class="isactive" ${isdrawtest?'checked':''}/></td>
            <td><input type="checkbox" class="isclosed"/></td>
            <td>
                <div class="partial-close">
                    <input type="number" inputmode="decimal" class="close-amount" placeholder="平倉點數" style="width: 70px;"/>
                    <button type="button" class="partial-close-btn" style="width: 90px;">部分平倉</button>
                </div>
            </td>
            <td><input type="text" class="groupId" placeholder="分組標籤" style="width: 150px;"/></td>
        </tr>
    `); 

    // 綁定按鈕事件
    row.find('.increase-btn').off('click').on('click', function () {
        const quantityInput = row.find('.quantity');
        const currentValue = parseInt(quantityInput.val()) || 0;
        quantityInput.val(currentValue + 1);
        row.find('.position-select').trigger('change');
    });

    row.find('.decrease-btn').off('click').on('click', function () {
        const quantityInput = row.find('.quantity');
        const currentValue = parseInt(quantityInput.val()) || 0;
        if (currentValue > 1) {
            quantityInput.val(currentValue - 1);
        }
        row.find('.position-select').trigger('change');
    });

    row.find('.partial-close-btn').off('click').on('click', function () {
        if(!row.find('.isclosed').prop('checked')){
            // 禁止 body 滾動
            $('body').css({
                overflow: 'hidden' // 禁用滾動
            });
            const dialog = $('#partialCloseDialog')[0];
            const positionInfoDiv = $('#partialCloseDialog').find('#partialPositionInfo');
            const positionTypeText = row.find('.position-select').find(':selected').text();

            positionInfoDiv.html(
                `本倉位資訊 : ${
                    positionTypeText || '未選擇'
                } @ ${
                    row.find('.strike-price').val() || 0
                } / ${
                    row.find('.cost').val() || 0
                } * ${
                    row.find('.quantity').val() || 0
                }`);

            dialog.showModal(); // 顯示對話框
            $('#dialogCancelBtn').off('click').on('click', function () {
                dialog.close(); // 關閉對話框
                finishBuild();
            });
            $('#dialogConfirmBtn').off('click').on('click', function () {
                const closePoint = Number($('#dialogClosePoint').val());
                const closeQuantity = Number($('#dialogCloseQuantity').val());
                if (isNaN(closePoint) || isNaN(closeQuantity) || closeQuantity <= 0) {
                    alert('請輸入有效的平倉點數與平倉口數');
                    finishBuild();
                    return;
                }else{
                    partialClose(positionId, closePoint, closeQuantity);
                }
                dialog.close();
                finishBuild();
            });
        }else{
            alert('該倉位已完全平倉。');
        }
    });

    // 動態加入選項
    positionOptions.forEach(option => {
        row.find('.position-select').append(new Option(option.text, option.id));
    });
    $('#positions tbody').prepend(row);

    // 填入資料
    if (itemType) {
        row.find('.position-select').val(itemType);
    }
    if (itemPrice) {
        row.find('.strike-price').val(itemPrice);
    }
    if (itemGroupId) {
        row.find('.groupId').val(itemGroupId);
    }
    if (itemCost) {
        row.find('.cost').val(itemCost);
    }
    if (itemQuantity) {
        row.find('.quantity').val(itemQuantity); 
    }
    if (closeCost) {
        row.find('.close-amount').val(closeCost); 
    }

    // 以是否測試為主，是否關閉要配合是否測試，這樣衝突時在畫面上才看的出來
    row.find('.isactive').prop('checked', isactive);
    row.find('.istest').prop('checked', istest);
    row.find('.isclosed').prop('checked', istest ? false : isclosed);

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
    // 觸發更新
    row.find('.position-select').trigger('change');
};

window.partialClose = function (positionId, closePoint, closeQuantity) {
    //找到對應的row
    const row = $(`tr[data-id=${positionId}]`);

    const closeAmountInput = row.find('.close-amount');
    const quantityInput = row.find('.quantity');
    const isclosedInput = row.find('.isclosed');

    const currentValue = parseInt(quantityInput.val()) || 0;
    const isclosed = isclosedInput.prop('checked');
    const itemType = row.find('.position-select').val();
    const itemPrice = row.find('.strike-price').val();
    const itemCost = row.find('.cost').val();

    if((currentValue > closeQuantity) && (!isclosed)){
        //將該row的持倉口數減去closeQuantity
        quantityInput.val(currentValue - closeQuantity);
        row.find('.position-select').trigger('change');
        //新增一筆已在closePoint平倉closeQuantity口之資料
        addItem(itemType, itemPrice, '', itemCost, closeQuantity, 0, 1, 1, closePoint);
    }else if((currentValue == closeQuantity) && (!isclosed)){
        //口數與剩餘相同 直接修改為已平倉
        closeAmountInput.val(closePoint);
        isclosedInput.prop('checked', true);
        row.find('.istest').prop('checked', false);
        row.find('.position-select').trigger('change');
    }else{
        alert('剩餘口數不足。');
    }

};


window.exportJSONToCSV = function (jsonArray, filename) {
    // 如果是空的 JSON 陣列，則退出
    if (!jsonArray || jsonArray.length === 0) {
        alert("沒有持倉資料，請先建立再匯出。");
        return;
    }

    // 提取 JSON 中的所有鍵，作為 CSV 標題列
    const headers = Object.keys(jsonArray[0]);
    const csvRows = [];

    // 加入標題列
    csvRows.push(headers.join(","));

    // 轉換每個物件為 CSV 格式
    jsonArray.forEach(obj => {
        const row = headers.map(header => {
            // 避免值中有逗號和換行，需加引號處理
            const value = obj[header] !== null ? obj[header] : '';
            return `"${value}"`;
        });
        csvRows.push(row.join(","));
    });

    // 將所有行組合成 CSV 字串
    const csvContent = csvRows.join("\n");

    // 建立 Blob，並生成下載 URL
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    if (confirm("是否匯出當前持倉？")) {
        link.click();
    } else {
        console.log("使用者選擇了取消");
    }
    document.body.removeChild(link);
};


window.importCSVFile = function (file) {
    function parseCSVValue(value) {
        if (value === "true") return true; // 字串轉布林值 true
        if (value === "false") return false; // 字串轉布林值 false
        if (!isNaN(value) && value.trim() !== "") return parseFloat(value); // 字串轉數值
        return value !== undefined && value !== null ? value : null; // 預設值為 null
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // 當讀取完成
        reader.onload = function (event) {
            const csvContent = event.target.result;
            const lines = csvContent.split("\n").map(line => line.trim()).filter(line => line); // 過濾空行

            // 確保有資料
            if (lines.length < 2) {
                reject("CSV 檔案內容無效或無資料");
                return;
            }

            // 提取標題列
            const headers = lines[0].split(",").map(header => header.replace(/"/g, "").trim());
            
            // 解析每一行成 JSON
            const jsonArray = lines.slice(1).map(line => {
                const values = line.split(",").map(value => value.replace(/"/g, "").trim());
                const json = {};
                headers.forEach((header, index) => {
                    json[header] = parseCSVValue(values[index]); // 若無值則為 null
                });
                return json;
            });

            resolve(jsonArray); // 回傳 JSON 陣列
        };

        // 當讀取出現錯誤
        reader.onerror = function () {
            reject("無法讀取檔案");
        };

        // 開始讀取檔案
        reader.readAsText(file, "utf-8");
    });
};


window.processImportedJSON = function (jsonArray) {
    if (!Array.isArray(jsonArray)) {
        console.error("匯入的資料不是有效的 JSON 陣列");
        return;
    }

    jsonArray.forEach(item => {
        // 確保每個物件都有所需屬性
        if (
            item.type !== undefined &&
            item.strikePrice !== undefined &&
            item.quantity !== undefined
        ) {
            const groupId = item.groupId || ''; 
            const cost = item.cost || 0;
            // 建立持倉
            window.addItem(item.type, item.strikePrice, item.groupId, item.cost, item.quantity, item.istest, item.isactive, item.isclosed, item.closeAmount);
        } else {
            console.warn("缺少必要屬性的項目", item);
        }
    });

};



window.calculateComboMarginAndPremium = function (positionIds, price, isOriginal) {
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
};

window.initChart = function () {
    chart.setOption({
        title: { text: '最終結算損益線圖' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value' },
        yAxis: { type: 'value', name: '損益' },
        series: [{ type: 'line', data: [] }]
    });
};

window.updateChart = function () {
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
            try {
                // 計算每個 position 組合的保證金和權利金
                const od_marginData = calculateComboMarginAndPremium(ps, closingPrice, true);
                const mm_marginData = calculateComboMarginAndPremium(ps, closingPrice, false);
                od_totalMargin[i] += od_marginData.margin;
                mm_totalMargin[i] += mm_marginData.margin;
            } catch (error) {
                //console.error(`Error calculating margin for position group at closing price ${closingPrice}:`, error);
                continue;
            }
        }
    }

    setShareInfo();
    
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
        const isMicro = pos.type.split('_')[1] === 'micro';
        const isClosed = pos.isclosed;
        const isTest = pos.istest;

        // 稅額計算
        if(!isTest || iscalctest){
            if (isMini) {
                // 手續費
                tradeMiniCount += (isClosed ? quantity * 2 : quantity);
                // 期交稅計算
                totalMiniTax += 
                    (Math.round((strikePrice * contractMultiplier) * miniTaxRate,0) + 
                    Math.round((( isClosed ? closeAmount : 0 ) * contractMultiplier) * miniTaxRate,0)) * quantity;
            } else if (isMicro) {
                // 手續費
                tradeMiniCount += (isClosed ? quantity * 2 : quantity);
                // 期交稅計算
                totalMiniTax += 
                    (Math.round((strikePrice * contractMultiplier / 5) * miniTaxRate,0) + 
                    Math.round((( isClosed ? closeAmount : 0 ) * contractMultiplier / 5) * miniTaxRate,0)) * quantity;
            } else {
                // 手續費
                tradeOpCount += (isClosed ? quantity * 2 : quantity);
                // 期交稅計算
                totalOpTax += 
                    (Math.round((cost * contractMultiplier) * opTaxRate,0) + 
                    Math.round((( isClosed ? closeAmount : 0 ) * contractMultiplier) * opTaxRate,0)) * quantity;
            }
        }

        // 遍歷收盤價格範圍
        for (let i = 0; i <= part; i++) {
            let closingPrice = Math.round(priceRange.min + (priceRange.max - priceRange.min) / part * i,0);
            let profit = 0;
            if(!pos.isclosed){
                switch (pos.type) {
                    case 'long_mini':
                        profit = (closingPrice - strikePrice ) * quantity;
                        break;
                    case 'short_mini':
                        profit = (strikePrice - closingPrice ) * quantity;
                        break;
                    case 'long_micro':
                        profit = (closingPrice - strikePrice ) * quantity / 5;
                        break;
                    case 'short_micro':
                        profit = (strikePrice - closingPrice ) * quantity / 5;
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
                    case 'long_micro':
                        profit = (closeAmount - strikePrice) * quantity / 5;
                        break;
                    case 'short_micro':
                        profit = (strikePrice - closeAmount) * quantity / 5;
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

        // 獲利率
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
        axisLineColor: '#dcdcdc',      // 軸線顏色
        gridColor: '#555',          // 網格線顏色
        legendTextColor: '#dcdcdc', // 圖例文字顏色
        titleTextColor: '#dcdcdc',  // 標題文字顏色
        seriesColors: {
            position: 'cyan',       // 持倉線顏色
            applied: '#FFCC22',      // 套用後線顏色
            test: ' #FF3333',            // 測試倉線顏色
            od: '#E93EFF',          // 原始線顏色
            mm: '#E93EFF',          // 維持線顏色
        },
        tooltipBackgroundColor: 'rgba(0, 0, 0, 0.8)', // 提示框背景色 (深色，70%透明度)
        tooltipTextColor: '#dcdcdc'                   // 提示框文字顏色
    };

    const axisTextFormatter = (value) => {
         if (value >= 1e6) {
             return (value / 1e6) + 'M'; // 百萬
         } else if (value >= 1e3) {
             return (value / 1e3) + 'k'; // 千
         } else if (value <= -1e6) {
             return (value / 1e6) + 'M'; // 負數百萬
         } else if (value <= -1e3) {
             return (value / 1e3) + 'k'; // 負數千
         }
         return value; // 小於千的數值不變          
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
                        <div style="display: flex; justify-content: space-between; width: 150px;">
                            <span style="text-align: left;">${item.marker}${item.seriesName}</span>
                            <span style="text-align: right;">${value.toFixed(2)}</span>
                        </div>
                    `;
                    if (['持倉','套用後','測試倉'].includes(item.seriesName)) {
                        positionContent += content;
                    } else if (['原始','維持'].includes(item.seriesName)) {
                        marginContent += content;
                    } else if (['獲利率'].includes(item.seriesName)) {
                        marginContent += `
                        <div style="display: flex; justify-content: space-between; width: 150px;">
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
            show: !window.matchMedia("(max-aspect-ratio: 1/1)").matches, // 開啟圖例
            textStyle: {
                color: nightModeColors.legendTextColor, // 圖例文字顏色
            }
        },
        xAxis: [
            {

                gridIndex: 0, 
                type: 'value',
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
                },
                axisLabel: {
                    formatter: function (value) {
                        return axisTextFormatter(value);
                    }
                },
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
                axisLabel: {
                    formatter: function (value) {
                        return axisTextFormatter(value);
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
                name: '套用後',
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
                    width: 2
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
                    width: 2
                }
            },
            // 下方圖表數據
            {
                name: '原始',
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
                name: '維持',
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
                name: '獲利率',
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
};
