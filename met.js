// met.js - Hyperliquid vs MEXC Future comparison for MET
const MET = (() => {
    let audioEnabled = false;
    let hyperliquidPrice = null;
    let mexcPrice = null;
    let jupiterPrice = null;

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

    // Fetch Jupiter price for MET
    async function fetchJupiterPriceForMET() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintMET = 'METmFwWaCNPZwL47n8u75iV6nSsJNfzDzD2E2pbhH6dK'; // MET token mint address
        
        try {
            const [buyResponse, sellResponse] = await Promise.all([
                // Buy MET with USDC: 100 USDC
                fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintMET}&amount=100000000`),
                // Sell MET for USDC: 100 MET (assuming 8 decimals)
                fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${outputMintMET}&outputMint=${inputMintUSDC}&amount=100000000`)
            ]);
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            console.log('Jupiter MET Buy Response:', buyData);
            console.log('Jupiter MET Sell Response:', sellData);
            
            return {
                // Price per MET when buying: amountInUSDC / amountOutMET
                buyPrice: buyData?.outAmount ? 100 / (parseInt(buyData.outAmount) / 1e8) : null,
                // Price per MET when selling: amountOutUSDC / amountInMET
                sellPrice: sellData?.outAmount ? (parseInt(sellData.outAmount) / 1e6) / 100 : null
            };
        } catch (error) {
            console.error('Jupiter MET Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Update alerts with Hyperliquid vs MEXC and Jupiter comparisons
    async function updateAlerts() {
        const elements = {
            hyperMexcBuy: document.getElementById('met-hyper-mexc-buy-alert'),
            hyperMexcSell: document.getElementById('met-hyper-mexc-sell-alert'),
            jupHyperBuy: document.getElementById('met-jup-hyper-buy-alert'),
            jupHyperSell: document.getElementById('met-jup-hyper-sell-alert')
        };

        try {
            // Fetch data from all sources
            const [hyperData, mexcFutureData, jupData] = await Promise.all([
                fetchHyperliquidFuturePrice().catch(error => {
                    console.error('Hyperliquid MET Error:', error);
                    return null;
                }),
                fetchMexcFuturePrice().catch(error => {
                    console.error('MEXC Future MET Error:', error);
                    return null;
                }),
                fetchJupiterPriceForMET().catch(error => {
                    console.error('Jupiter MET Error:', error);
                    return null;
                })
            ]);
            
            // Store prices for external access
            hyperliquidPrice = hyperData;
            mexcPrice = mexcFutureData;
            jupiterPrice = jupData;
            
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
            
            // Jupiter vs Hyperliquid
            if (jupData && hyperData) {
                // Buy opportunity: Jupiter sell price vs Hyperliquid ask
                const jupHyperBuyOpportunity = jupData.sellPrice - hyperData.ask;
                
                // Sell opportunity: Hyperliquid bid vs Jupiter buy price
                const jupHyperSellOpportunity = hyperData.bid - jupData.buyPrice;

                elements.jupHyperBuy.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | H: $${format(hyperData.ask)} ` +
                    `<span class="difference">$${format(jupHyperBuyOpportunity)}</span>`;
                
                elements.jupHyperSell.innerHTML = 
                    `H: $${format(hyperData.bid)} | J: $${format(jupData.buyPrice)} ` +
                    `<span class="difference">$${format(jupHyperSellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.jupHyperBuy.querySelector('.difference'), 
                    jupHyperBuyOpportunity,
                    'jup_hyper_buy'
                );
                applyAlertStyles(
                    elements.jupHyperSell.querySelector('.difference'), 
                    jupHyperSellOpportunity,
                    'jup_hyper_sell'
                );
            } else {
                if (!jupData) {
                    elements.jupHyperBuy.textContent = 'Jupiter data error';
                    elements.jupHyperSell.textContent = 'Jupiter data error';
                }
                if (!hyperData) {
                    elements.jupHyperBuy.textContent = 'Hyperliquid data error';
                    elements.jupHyperSell.textContent = 'Hyperliquid data error';
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
                } else if (value > 0.01) {
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
                
            case 'jup_hyper_buy':
                // Buy opportunity: Jupiter sell price > Hyperliquid ask
                if (value > 0.5) {
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
                
            case 'jup_hyper_sell':
                // Sell opportunity: Hyperliquid bid > Jupiter buy price
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
    setInterval(updateAlerts, 5000);
    
    return { 
        updateAlerts, 
        enableAudio,
        getHyperliquidPrice: () => hyperliquidPrice,
        getMexcPrice: () => mexcPrice,
        getJupiterPrice: () => jupiterPrice
    };
})();