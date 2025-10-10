// met.js - Hyperliquid vs MEXC Future comparison for MET
const MET = (() => {
    let audioEnabled = false;
    let hyperliquidPrice = null;
    let mexcPrice = null;

    // Fetch MEXC Futures prices for MET
    async function fetchMexcFuturePrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/MET_USDT';
        
        try {
            const response = await fetch(proxyUrl + url);
            const data = await response.json();
            
            if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
                throw new Error('Invalid MEXC response');
            }
            
            return {
                bid: parseFloat(data.data.bids[0][0]),
                ask: parseFloat(data.data.asks[0][0])
            };
        } catch (error) {
            console.error('MEXC Futures MET Error:', error);
            return null;
        }
    }

    // Fetch Hyperliquid Futures prices for MET
    function fetchHyperliquidFuturePrice() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
            let timeout;
            let receivedData = false;
            
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    method: "subscribe",
                    subscription: { type: "l2Book", coin: "MET" }
                }));
                
                timeout = setTimeout(() => {
                    if (!receivedData) {
                        ws.close();
                        reject(new Error('Hyperliquid connection timed out'));
                    }
                }, 5000);
            };
            
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.channel === "l2Book" && message.data) {
                        receivedData = true;
                        clearTimeout(timeout);
                        ws.close();
                        
                        const orderbook = message.data;
                        
                        if (!orderbook.levels || orderbook.levels.length < 2) {
                            reject(new Error('Invalid Hyperliquid response structure'));
                            return;
                        }
                        
                        const bids = orderbook.levels[0];
                        const asks = orderbook.levels[1];
                        
                        if (!bids || bids.length === 0 || !asks || asks.length === 0) {
                            reject(new Error('Empty bids or asks array'));
                            return;
                        }
                        
                        const bestBid = bids[0]?.px;
                        const bestAsk = asks[0]?.px;
                        
                        if (bestBid === undefined || bestAsk === undefined) {
                            reject(new Error('Missing bid/ask prices in level data'));
                            return;
                        }
                        
                        resolve({
                            bid: parseFloat(bestBid),
                            ask: parseFloat(bestAsk)
                        });
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                ws.close();
                reject(error);
            };
            
            ws.onclose = () => {
                clearTimeout(timeout);
                if (!receivedData) {
                    reject(new Error('WebSocket closed before receiving data'));
                }
            };
        });
    }

    // Update alerts with Hyperliquid vs MEXC comparison
    async function updateAlerts() {
        const elements = {
            hyperMexcBuy: document.getElementById('met-hyper-mexc-buy-alert'),
            hyperMexcSell: document.getElementById('met-hyper-mexc-sell-alert')
        };

        try {
            // Fetch data from both exchanges
            const [hyperData, mexcFutureData] = await Promise.all([
                fetchHyperliquidFuturePrice().catch(error => {
                    console.error('Hyperliquid MET Error:', error);
                    return null;
                }),
                fetchMexcFuturePrice().catch(error => {
                    console.error('MEXC Future MET Error:', error);
                    return null;
                })
            ]);
            
            // Store prices for external access
            hyperliquidPrice = hyperData;
            mexcPrice = mexcFutureData;
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(3);
            };
            
            // Hyperliquid Future vs MEXC Future
            if (hyperData && mexcFutureData) {
                const buyOpportunity = mexcFutureData.bid - hyperData.ask;
                const sellOpportunity = hyperData.bid - mexcFutureData.ask;
                
                elements.hyperMexcBuy.innerHTML = 
                    `H: $${format(hyperData.ask)} | M: $${format(mexcFutureData.bid)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.hyperMexcSell.innerHTML = 
                    `H: $${format(hyperData.bid)} | M: $${format(mexcFutureData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.hyperMexcBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'hyper_mexc_buy'
                );
                applyAlertStyles(
                    elements.hyperMexcSell.querySelector('.difference'), 
                    sellOpportunity,
                    'hyper_mexc_sell'
                );
            } else {
                if (!hyperData) {
                    elements.hyperMexcBuy.textContent = 'Hyperliquid data error';
                    elements.hyperMexcSell.textContent = 'Hyperliquid data error';
                }
                if (!mexcFutureData) {
                    elements.hyperMexcBuy.textContent = 'MEXC Future data error';
                    elements.hyperMexcSell.textContent = 'MEXC Future data error';
                }
            }
            
        } catch (error) {
            console.error('MET Update Error:', error);
            Object.values(elements).forEach(el => {
                if (el) el.textContent = 'Update Error';
            });
        }
    }

    function applyAlertStyles(element, value, type) {
        if (!element) return;
        
        element.className = 'difference';
        const existingIcon = element.querySelector('.direction-icon');
        if (existingIcon) existingIcon.remove();
        
        let shouldPlaySound = false;
        let volume = 0.2;
        let frequency = 784; // Default frequency (G5)
        
        // Add direction icon
        const direction = document.createElement('span');
        direction.className = 'direction-icon';
        direction.textContent = value > 0 ? ' ↑' : ' ↓';
        element.appendChild(direction);
        
        // Different thresholds and sounds for each comparison type
        switch(type) {
            case 'hyper_mexc_buy':
                // Buy opportunity: MEXC bid > Hyperliquid ask
                if (value > 0.5) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > -0.02) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'hyper_mexc_sell':
                // Sell opportunity: Hyperliquid bid > MEXC ask
                if (value > 0.5) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.09) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
        }

        if (shouldPlaySound && audioEnabled) {
            window.playSystemAlert(volume, frequency);
        }
    }

    function enableAudio() {
        audioEnabled = true;
    }

    // Initialize
    updateAlerts();
    setInterval(updateAlerts, 2000);
    
    return { 
        updateAlerts, 
        enableAudio,
        getHyperliquidPrice: () => hyperliquidPrice,
        getMexcPrice: () => mexcPrice
    };
})();