// 0g.js - Hyperliquid vs MEXC comparison and funding rates
const ZEROG = (() => {
    let audioEnabled = false;
    let fundingRateInterval = null;
    let nextFundingTime = null;
    let hyperliquidFundingRate = null;
    let mexcFundingRate = null;

    // Fetch MEXC Funding Rate for 0G
    async function fetchMexcFundingRate() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/funding_rate/0G_USDT';
        
        try {
            const response = await fetch(proxyUrl + url);
            const data = await response.json();
            
            if (!data?.data?.fundingRate) {
                throw new Error('Invalid MEXC funding rate response');
            }
            
            return {
                rate: parseFloat(data.data.fundingRate),
                nextTime: data.data.nextSettleTime
            };
        } catch (error) {
            console.error('MEXC Funding Rate Error:', error);
            return null;
        }
    }

    // Fetch Hyperliquid Funding Rate for 0G
    async function fetchHyperliquidFundingRate() {
        try {
            // Hyperliquid funding rate API (based on documentation)
            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'fundingHistory',
                    coin: '0G',
                    startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
                    endTime: Date.now()
                })
            });
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('Invalid Hyperliquid funding rate response');
            }
            
            // Get the most recent funding rate
            const latestRate = data[data.length - 1];
            return {
                rate: parseFloat(latestRate.fundingRate),
                time: latestRate.time
            };
        } catch (error) {
            console.error('Hyperliquid Funding Rate Error:', error);
            return null;
        }
    }

    // Update funding rate displays
    async function updateFundingRates() {
        try {
            // Fetch both funding rates
            const [mexcData, hyperData] = await Promise.all([
                fetchMexcFundingRate(),
                fetchHyperliquidFundingRate()
            ]);
            
            // Update MEXC funding rate display
            if (mexcData) {
                mexcFundingRate = mexcData.rate;
                const ratePercent = (mexcData.rate * 100).toFixed(4);
                const rateElement = document.getElementById('zerog-mexc-funding-rate');
                
                if (rateElement) {
                    rateElement.querySelector('.funding-rate-value').textContent = `${ratePercent}%`;
                    
                    // Set appropriate styling
                    if (mexcData.rate > 0.0005) {
                        rateElement.className = 'funding-rate positive';
                    } else if (mexcData.rate < -0.0005) {
                        rateElement.className = 'funding-rate negative';
                    } else {
                        rateElement.className = 'funding-rate neutral';
                    }
                    
                    // Update next funding time if available
                    if (mexcData.nextTime) {
                        nextFundingTime = parseInt(mexcData.nextTime);
                        if (!fundingRateInterval) {
                            fundingRateInterval = setInterval(updateFundingCountdown, 1000);
                        }
                    }
                }
            }
            
            // Update Hyperliquid funding rate display
            if (hyperData) {
                hyperliquidFundingRate = hyperData.rate;
                const ratePercent = (hyperData.rate * 100).toFixed(4);
                const rateElement = document.getElementById('zerog-hyper-funding-rate');
                
                if (rateElement) {
                    rateElement.querySelector('.funding-rate-value').textContent = `${ratePercent}%`;
                    
                    // Set appropriate styling
                    if (hyperData.rate > 0.0005) {
                        rateElement.className = 'funding-rate positive';
                    } else if (hyperData.rate < -0.0005) {
                        rateElement.className = 'funding-rate negative';
                    } else {
                        rateElement.className = 'funding-rate neutral';
                    }
                }
            }
        } catch (error) {
            console.error('Funding Rate Update Error:', error);
        }
    }

    // Update funding countdown timer
    function updateFundingCountdown() {
        if (!nextFundingTime) return;
        
        const now = new Date().getTime();
        const diff = nextFundingTime - now;
        
        if (diff <= 0) {
            // Time's up, refresh funding rate
            updateFundingRates();
            return;
        }
        
        // Format the time difference
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('zerog-mexc-next-funding').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Fetch MEXC Futures prices for 0G
    async function fetchMexcFuturePrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/0G_USDT';
        
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
            console.error('MEXC Futures 0G Error:', error);
            return null;
        }
    }

    // Fetch MEXC Spot prices for 0G
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=0GUSDT&limit=5';
        
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
            const data = await response.json();
            
            if (!data.bids || !data.asks || data.bids.length === 0 || data.asks.length === 0) {
                throw new Error('Invalid spot order book');
            }
            
            // Get best bid and ask
            const bestBid = parseFloat(data.bids[0][0]);
            const bestAsk = parseFloat(data.asks[0][0]);
            
            return {
                bid: bestBid,
                ask: bestAsk
            };
        } catch (error) {
            console.error('MEXC Spot 0G Error:', error);
            return null;
        }
    }

    // Fetch Hyperliquid Futures prices for 0G
    function fetchHyperliquidFuturePrice() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
            let timeout;
            let receivedData = false;
            
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    method: "subscribe",
                    subscription: { type: "l2Book", coin: "0G" }
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

    // Update alerts with all comparisons
    async function updateAlerts() {
        const elements = {
            hyperMexcBuy: document.getElementById('zerog-hyper-mexc-buy-alert'),
            hyperMexcSell: document.getElementById('zerog-hyper-mexc-sell-alert'),
            mexcSpotFutureBuy: document.getElementById('zerog-mexc-spot-future-buy-alert'),
            mexcSpotFutureSell: document.getElementById('zerog-mexc-spot-future-sell-alert')
        };

        try {
            // Fetch data from all exchanges
            const [hyperData, mexcFutureData, mexcSpotData] = await Promise.all([
                fetchHyperliquidFuturePrice().catch(error => {
                    console.error('Hyperliquid 0G Error:', error);
                    return null;
                }),
                fetchMexcFuturePrice().catch(error => {
                    console.error('MEXC Future 0G Error:', error);
                    return null;
                }),
                fetchMexcSpotPrice().catch(error => {
                    console.error('MEXC Spot 0G Error:', error);
                    return null;
                })
            ]);
            
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

            // MEXC Spot vs MEXC Future
            if (mexcSpotData && mexcFutureData) {
                const buyOpportunity = mexcFutureData.bid - mexcSpotData.ask;
                const sellOpportunity = mexcSpotData.bid - mexcFutureData.ask;
                
                elements.mexcSpotFutureBuy.innerHTML = 
                    `Spot: $${format(mexcSpotData.ask)} | Future: $${format(mexcFutureData.bid)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.mexcSpotFutureSell.innerHTML = 
                    `Spot: $${format(mexcSpotData.bid)} | Future: $${format(mexcFutureData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.mexcSpotFutureBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'mexc_spot_future_buy'
                );
                applyAlertStyles(
                    elements.mexcSpotFutureSell.querySelector('.difference'), 
                    sellOpportunity,
                    'mexc_spot_future_sell'
                );
            } else {
                if (!mexcSpotData) {
                    elements.mexcSpotFutureBuy.textContent = 'MEXC Spot data error';
                    elements.mexcSpotFutureSell.textContent = 'MEXC Spot data error';
                }
                if (!mexcFutureData) {
                    elements.mexcSpotFutureBuy.textContent = 'MEXC Future data error';
                    elements.mexcSpotFutureSell.textContent = 'MEXC Future data error';
                }
            }
            
        } catch (error) {
            console.error('0G Update Error:', error);
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
                } else if (value > 0.089) {
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
                } else if (value > -0.005) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;

            case 'mexc_spot_future_buy':
                // Buy opportunity: MEXC Future bid > MEXC Spot ask
                if (value > 0.9) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.01) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'mexc_spot_future_sell':
                // Sell opportunity: MEXC Spot bid > MEXC Future ask
                if (value > 0.9) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.05) {
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
    updateFundingRates(); // Initial funding rate fetch
    setInterval(updateAlerts, 2000);
    setInterval(updateFundingRates, 60000); // Update funding rates every minute
    
    return { updateAlerts, enableAudio };
})();