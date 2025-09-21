// aster.js - Updated with Hyperliquid vs MEXC comparison and funding rates
const ASTER = (() => {
    let audioEnabled = false;
    let fundingRateInterval = null;
    let nextFundingTime = null;
    let hyperliquidFundingRate = null;
    let mexcFundingRate = null;

    // Fetch MEXC Funding Rate for ASTER
    async function fetchMexcFundingRate() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/funding_rate/ASTER_USDT';
        
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

    // Fetch Hyperliquid Funding Rate for ASTER
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
                    coin: 'ASTER',
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
                const rateElement = document.getElementById('aster-mexc-funding-rate');
                
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
                const rateElement = document.getElementById('aster-hyper-funding-rate');
                
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
        
        document.getElementById('aster-mexc-next-funding').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Fetch KyberSwap prices for ASTER on BNB chain
    async function fetchKyberPrice() {
        const addresses = {
            USDT: '0x55d398326f99059ff775485246999027b3197955', // USDT on BNB
            ASTER: '0x000Ae314E2A2172a039B26378814C252734f556A' // ASTER on BNB
        };

        try {
            // Format amounts properly without scientific notation
            const buyAmount = "10000000000000000000"; // 10 USDT (18 decimals)
            const sellAmount = "10000000000000000000"; // 10 ASTER (18 decimals)
            
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${addresses.USDT}&tokenOut=${addresses.ASTER}&amountIn=${buyAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`),
                fetch(`https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${addresses.ASTER}&tokenOut=${addresses.USDT}&amountIn=${sellAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`)
            ]);

            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData.data?.routeSummary?.amountOut ? 
                    10 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e18) : null,
                sellPrice: sellData.data?.routeSummary?.amountOut ? 
                    (parseFloat(sellData.data.routeSummary.amountOut) / 1e18) / 10 : null
            };
        } catch (error) {
            console.error('Kyber ASTER Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch MEXC Futures prices for ASTER
    async function fetchMexcFuturePrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/ASTER_USDT';
        
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
            console.error('MEXC Futures ASTER Error:', error);
            return null;
        }
    }

    // Fetch MEXC Spot prices for ASTER
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=ASTERUSDT&limit=5';
        
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
            console.error('MEXC Spot ASTER Error:', error);
            return null;
        }
    }

    // Fetch Hyperliquid Futures prices for ASTER
    function fetchHyperliquidFuturePrice() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
            let timeout;
            let receivedData = false;
            
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    method: "subscribe",
                    subscription: { type: "l2Book", coin: "ASTER" }
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
            kyberHyperBuy: document.getElementById('aster-kyber-hyper-buy-alert'),
            kyberHyperSell: document.getElementById('aster-kyber-hyper-sell-alert'),
            kyberMexcBuy: document.getElementById('aster-kyber-mexc-buy-alert'),
            kyberMexcSell: document.getElementById('aster-kyber-mexc-sell-alert'),
            hyperMexcBuy: document.getElementById('aster-hyper-mexc-buy-alert'),
            hyperMexcSell: document.getElementById('aster-hyper-mexc-sell-alert'),
            mexcSpotFutureBuy: document.getElementById('aster-mexc-spot-future-buy-alert'),
            mexcSpotFutureSell: document.getElementById('aster-mexc-spot-future-sell-alert')
        };

        try {
            // Fetch data from all exchanges
            const [kyberData, hyperData, mexcFutureData, mexcSpotData] = await Promise.all([
                fetchKyberPrice(),
                fetchHyperliquidFuturePrice().catch(error => {
                    console.error('Hyperliquid ASTER Error:', error);
                    return null;
                }),
                fetchMexcFuturePrice().catch(error => {
                    console.error('MEXC Future ASTER Error:', error);
                    return null;
                }),
                fetchMexcSpotPrice().catch(error => {
                    console.error('MEXC Spot ASTER Error:', error);
                    return null;
                })
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(4);
            };
            
            // Kyber Spot vs Hyperliquid Future
            if (kyberData && hyperData) {
                const buyOpportunity = hyperData.bid - kyberData.buyPrice;
                const sellOpportunity = kyberData.sellPrice - hyperData.ask;
                
                elements.kyberHyperBuy.innerHTML = 
                    `K: $${format(kyberData.buyPrice)} | H: $${format(hyperData.bid)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.kyberHyperSell.innerHTML = 
                    `K: $${format(kyberData.sellPrice)} | H: $${format(hyperData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.kyberHyperBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'kyber_hyper_buy'
                );
                applyAlertStyles(
                    elements.kyberHyperSell.querySelector('.difference'), 
                    sellOpportunity,
                    'kyber_hyper_sell'
                );
            } else {
                if (!kyberData) {
                    elements.kyberHyperBuy.textContent = 'Kyber data error';
                    elements.kyberHyperSell.textContent = 'Kyber data error';
                }
                if (!hyperData) {
                    elements.kyberHyperBuy.textContent = 'Hyperliquid data error';
                    elements.kyberHyperSell.textContent = 'Hyperliquid data error';
                }
            }
            
            // Kyber Spot vs MEXC Future
            if (kyberData && mexcFutureData) {
                const buyOpportunity = mexcFutureData.bid - kyberData.buyPrice;
                const sellOpportunity = kyberData.sellPrice - mexcFutureData.ask;
                
                elements.kyberMexcBuy.innerHTML = 
                    `K: $${format(kyberData.buyPrice)} | M: $${format(mexcFutureData.bid)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.kyberMexcSell.innerHTML = 
                    `K: $${format(kyberData.sellPrice)} | M: $${format(mexcFutureData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.kyberMexcBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'kyber_mexc_buy'
                );
                applyAlertStyles(
                    elements.kyberMexcSell.querySelector('.difference'), 
                    sellOpportunity,
                    'kyber_mexc_sell'
                );
            } else {
                if (!kyberData) {
                    elements.kyberMexcBuy.textContent = 'Kyber data error';
                    elements.kyberMexcSell.textContent = 'Kyber data error';
                }
                if (!mexcFutureData) {
                    elements.kyberMexcBuy.textContent = 'MEXC Future data error';
                    elements.kyberMexcSell.textContent = 'MEXC Future data error';
                }
            }
            
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
            console.error('ASTER Update Error:', error);
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
            case 'kyber_hyper_buy':
                // Buy opportunity: Hyperliquid bid > Kyber sell price
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.008) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'kyber_hyper_sell':
                // Sell opportunity: Kyber buy price > Hyperliquid ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.001) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            case 'kyber_mexc_buy':
                // Buy opportunity: MEXC bid > Kyber sell price
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.008) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'kyber_mexc_sell':
                // Sell opportunity: Kyber buy price > MEXC ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.001) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            case 'hyper_mexc_buy':
                // Buy opportunity: MEXC bid > Hyperliquid ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.001) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'hyper_mexc_sell':
                // Sell opportunity: Hyperliquid bid > MEXC ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.004) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;

            case 'mexc_spot_future_buy':
                // Buy opportunity: MEXC Future bid > MEXC Spot ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.008) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'mexc_spot_future_sell':
                // Sell opportunity: MEXC Spot bid > MEXC Future ask
                if (value > 0.05) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.001) {
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