/* jshint esversion: 6 */



$(document).ready(function () {

    let value=22500; // 價平
    let analysisWidth = 0.03; // 價位寬度
    let part = 100; // 切成幾分
    let priceRange = { min: value*(1-analysisWidth), max: value*(1+analysisWidth) }; // 收盤價格範圍（可調整）

    let item=10; // 價平上下檔數
    let point=50; // 每檔間隔
    let pointPrice=50; // 每點價值

    $('#market-price').val(value);
    $('#analysis-width').val(analysisWidth);
    $('#precision').val(part);

    $('.main_config').on('change',function () {
        value = Number($('#market-price').val()||value);
        analysisWidth = Number($('#analysis-width').val()||analysisWidth);
        part = Number($('#precision').val()||part);
        priceRange = { min: value*(1-analysisWidth), max: value*(1+analysisWidth) };
        updateChart();
    });


    const positions = []; // 存放所有持倉數據
    const positionOptions = [
        { id: 'long_mini', text: '小台多單' },
        { id: 'short_mini', text: '小台空單' },
        { id: 'buy_call', text: 'Buy Call' },
        { id: 'sell_call', text: 'Sell Call' },
        { id: 'buy_put', text: 'Buy Put' },
        { id: 'sell_put', text: 'Sell Put' }
    ];
    
    const chart = echarts.init(document.getElementById('chart'));

    $('.trade-builder').on('contextmenu', function(e) {
        e.preventDefault(); // 禁用右鍵菜單
    });

    $('#positions tbody').off('click').on('change', 'select, input', function () {
        updatePositions($(this).closest('tr'));
        updateChart();
    });

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
            totalData.push([profitPrice[i], totalProfit[i]*pointPrice]);
            totalTestData.push([profitPrice[i], testTotalProfit[i]*pointPrice]);
            onlyTestData.push([profitPrice[i], onlyTestProfit[i]*pointPrice]);
        }

        // 更新圖表
        chart.setOption({
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
                show: true,  // 開啟圖例
                data: ['持倉', '套用後', '測試倉'],  // 顯示的圖例名稱
                textStyle: {
                    color: '#333',  // 設置圖例文字顏色
                }
            },
            xAxis: {
                type: 'value',
                name: '最終收盤價格',
                min: priceRange.min,
                max: priceRange.max,
            },
            yAxis: {
                type: 'value',
                name: '損益',
            },
            series: [{
                name: '持倉',
                type: 'line',
                data: totalData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: 'blue',  // 設定黃色
                lineStyle: {
                    type: 'solid',    // 設定實線
                    width: 2          // 設定線寬，視需要可調整
                }
            },{
                name: '套用後',
                type: 'line',
                data: totalTestData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: 'blue',  // 設定黃色
                lineStyle: {
                    type: 'dashed',    // 設定實線
                    width: 1          // 設定線寬，視需要可調整
                }
            },{
                name: '測試倉',
                type: 'line',
                data: onlyTestData,
                symbol: 'none',
                emphasis: {
                    focus: 'series',
                },
                color: 'red',  // 設定紅色
                lineStyle: {
                    type: 'dashed', // 設定虛線
                    width: 2  // 設定線寬，視需要可調整
                }
            }],
        });

        $('#optionTable tbody').html('');
        for(let i = 0; i<=item*2; i++){
            let row = $(`
                <tr ><tr>
                    <td class="call">C</td>
                    <td class="strike">${value-(item-i)*point}</td>
                    <td class="put">P</td>
                </tr></tr>
            `);
            if(item==i){
                row.css({'background-color': '#b1fafa'});
            }
            $('#optionTable tbody').append(row);
        }
    }



    // 新增倉位
    $('#addPosition').off('click').on('click', function(){
        addItem(0, 0);
    });
    // 測試倉轉持倉
    $('#comfirmPosition').off('click').on('click', function(){
        $('.istest:checked').each(function(){
            $(this).prop('checked', false);
            updatePositions($(this).closest('tr'));
        });
        updateChart();
    });


    // 建倉工具表
    let linewidth=5;
    let isBuilding = false; // 是否處於建倉模式
    let startCell = null; // 開始的單元格
    let endCell = null; // 結束的單元格
    const tradeLine = $('<div class="trade-line"></div>').appendTo('body'); // 建倉視覺線

    $('#optionTable').off('mousedown').on('mousedown', 'td.call, td.put', function (e) {
        isBuilding = true;
        startCell = $(this);
        if(e.button === 0){
            tradeLine.show().css({ top: e.pageY, left: e.pageX,height:0 });
        }
    });

    $(document).off('mousemove').on('mousemove', function (e) {
        if (isBuilding) {
            const offset = startCell.offset();
            const startX = offset.left + startCell.outerWidth() * (startCell.hasClass('call')?0.25:0.75)-(startCell.hasClass('call')?linewidth:0);
            const startY = offset.top + startCell.outerHeight() * 0.5;
            const endX = e.pageX;
            const endY = e.pageY;

            $('td:hover').css({
                'background-color': e.button === 0 ? '#f0fff0' : '#fff0f0'
            });


            tradeLine.css({
                'width': linewidth,
                'height': Math.max(endY-startY,startY-endY),
                'top': Math.min(startY,endY),
                'left': startX,
                'background-color': (startCell.hasClass('call')&&endY>startY)||(!startCell.hasClass('call')&&endY<startY) ? '#f00': '#0f0'
            });
        }
    });

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
                    if(startPrice==endPrice){
                        addItem(starttype,startPrice);
                    }else{
                        addItem(starttype,startPrice);
                        addItem(endtype,endPrice);
                    }
                }else{
                    if(startPrice==endPrice){
                        addItem(endtype,endPrice);
                    }
                }
                updateChart();

                // 建倉邏輯
                //console.log(`${starttype} ${startPrice} + ${endtype} ${endPrice}`);
            }
        }
    });


    initChart();
    updateChart();
});



