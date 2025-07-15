const PUMPFUN = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;

    // Create audio enable button
    function createAudioEnableButton() {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'audio-btn-container';
        
        enableButton = document.createElement('button');
        enableButton.className = 'token-audio-btn';
        enableButton.innerHTML = '<span class="audio-icon">🔇</span> Enable';
        
        enableButton.addEventListener('click', async () => {
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                audioEnabled = true;
                enableButton.innerHTML = '<span class="audio-icon">🔊</span> On!';
                enableButton.style.background = '#2E7D32';
                
                setTimeout(() => {
                    btnContainer.style.opacity = '0';
                    setTimeout(() => {
                        if (btnContainer.parentNode) {
                            btnContainer.parentNode.removeChild(btnContainer);
                        }
                    }, 300);
                }, 2000);
            } catch (error) {
                console.error('Audio initialization failed:', error);
                enableButton.innerHTML = '<span class="audio-icon">❌</span> Error';
                enableButton.style.background = '#c62828';
            }
        });

        btnContainer.appendChild(enableButton);
        const section = document.getElementById('pumpfun-jupiter-buy-alert')?.closest('.token-section');
        if (section) {
            section.appendChild(btnContainer);
        }
    }

    // Play alert sound with custom frequency
    async function playSystemAlert(volume = 0.2, frequency = 784) {
        if (!audioEnabled || !audioContext) return;
        
        try {
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.error('Sound playback failed:', error);
        }
    }

    // Fetch Jupiter price
    async function fetchJupPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintpumpfun = 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn';
    
        try {
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintpumpfun}&amount=1498000000`),
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${outputMintpumpfun}&outputMint=${inputMintUSDC}&amount=399998000000`)
            ]);
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData?.outAmount ? 1498 / (buyData.outAmount / 1e6) : null,
                sellPrice: sellData?.outAmount ? (sellData.outAmount / 1e6) / 399998 : null
            };
        } catch (error) {
            console.error('Jupiter Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch MEXC contract price
    async function fetchMexcContractPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/PUMPFUN_USDT';
        
        try {
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
            
            // Calculate weighted average for 399998 PUMPFUN
            const calculatePrice = (levels, targetAmount) => {
                let totalAmount = 0;
                let totalValue = 0;
                
                for (const [priceStr, sizeStr] of levels) {
                    const price = parseFloat(priceStr);
                    const size = parseFloat(sizeStr);
                    const available = size / price;
                    const remaining = targetAmount - totalAmount;
                    
                    if (available >= remaining) {
                        totalValue += remaining * price;
                        totalAmount += remaining;
                        break;
                    } else {
                        totalValue += available * price;
                        totalAmount += available;
                    }
                }
                
                if (totalAmount < targetAmount) return null;
                return totalValue / targetAmount;
            };

            return {
                bid: calculatePrice(data.data.bids, 399998),
                ask: calculatePrice(data.data.asks, 399998)
            };
        } catch (error) {
            console.error('MEXC Contract Error:', error);
            return null;
        }
    }

    // Fetch MEXC spot price
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=PUMPUSDT&limit=5';
        
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
            console.error('MEXC Spot Error:', error);
            return null;
        }
    }

    // Fetch MEXC Futures prices
    async function fetchMexcFuturePrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/PUMPFUN_USDT';
        
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
            console.error('MEXC Futures Error:', error);
            return null;
        }
    }

    // Fetch Hyperliquid Futures prices
    function fetchHyperliquidFuturePrice() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
            let timeout;
            let receivedData = false;
            
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    method: "subscribe",
                    subscription: { type: "l2Book", coin: "PUMP" }
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
            jupHyperBuy: document.getElementById('pumpfun-jupiter-hyper-buy-alert'),
            jupHyperSell: document.getElementById('pumpfun-jupiter-hyper-sell-alert'),
            jupBuy: document.getElementById('pumpfun-jupiter-buy-alert'),
            jupSell: document.getElementById('pumpfun-jupiter-sell-alert'),
            mexcBuy: document.getElementById('pumpfun-mexc-buy-alert'),
            mexcSell: document.getElementById('pumpfun-mexc-sell-alert'),
            mexcHyperBuy: document.getElementById('pumpfun-mexc-hyper-buy-alert'),
            mexcHyperSell: document.getElementById('pumpfun-mexc-hyper-sell-alert')
        };

        try {
            // Fetch all data in parallel
            const [jupData, contractData, spotData, futureData, hyperData] = await Promise.all([
                fetchJupPrice(),
                fetchMexcContractPrice(),
                fetchMexcSpotPrice(),
                fetchMexcFuturePrice(),
                fetchHyperliquidFuturePrice().catch(error => {
                    console.error('Hyperliquid Error:', error);
                    return null;
                })
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(6);
            };
            
            // 1. Jupiter vs Hyperliquid Future
            if (jupData && hyperData) {
                const buyOpportunity = hyperData.bid - jupData.buyPrice;
                const sellOpportunity = jupData.sellPrice - hyperData.ask;
                
                elements.jupHyperBuy.innerHTML = 
                    `J: $${format(jupData.buyPrice)} | H: $${format(hyperData.bid)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.jupHyperSell.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | H: $${format(hyperData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.jupHyperBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'jup_hyper_buy'
                );
                applyAlertStyles(
                    elements.jupHyperSell.querySelector('.difference'), 
                    sellOpportunity,
                    'jup_hyper_sell'
                );
            }
            
            // 2. Jupiter vs MEXC Contract
            if (jupData && contractData) {
                const buyDiff = contractData.bid - jupData.buyPrice;
                const sellDiff = jupData.sellPrice - contractData.ask;
                
                elements.jupBuy.innerHTML = 
                    `J: $${format(jupData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(buyDiff)}</span>`;
                    
                elements.jupSell.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(sellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.jupBuy.querySelector('.difference'), 
                    buyDiff,
                    'jup_contract_buy'
                );
                applyAlertStyles(
                    elements.jupSell.querySelector('.difference'), 
                    sellDiff,
                    'jup_contract_sell'
                );
            }
            
            // 3. MEXC Contract vs Spot
            if (contractData && spotData) {
                const contractBuyDiff = contractData.bid - spotData.ask;
                const contractSellDiff = spotData.bid - contractData.ask;
                
                elements.mexcBuy.innerHTML = 
                    `C: $${format(contractData.bid)} | S: $${format(spotData.ask)} ` +
                    `<span class="difference">$${format(contractBuyDiff)}</span>`;
                    
                elements.mexcSell.innerHTML = 
                    `C: $${format(contractData.ask)} | S: $${format(spotData.bid)} ` +
                    `<span class="difference">$${format(contractSellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.mexcBuy.querySelector('.difference'), 
                    contractBuyDiff,
                    'contract_spot_buy'
                );
                applyAlertStyles(
                    elements.mexcSell.querySelector('.difference'), 
                    contractSellDiff,
                    'contract_spot_sell'
                );
            }
            
            // 4. MEXC Future vs Hyperliquid Future
            if (futureData && hyperData) {
                const buyOpportunity = futureData.bid - hyperData.ask;
                const sellOpportunity = hyperData.bid - futureData.ask;
                
                elements.mexcHyperBuy.innerHTML = 
                    `M: $${format(futureData.bid)} | H: $${format(hyperData.ask)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                
                elements.mexcHyperSell.innerHTML = 
                    `H: $${format(hyperData.bid)} | M: $${format(futureData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.mexcHyperBuy.querySelector('.difference'), 
                    buyOpportunity,
                    'mexc_hyper_buy'
                );
                applyAlertStyles(
                    elements.mexcHyperSell.querySelector('.difference'), 
                    sellOpportunity,
                    'mexc_hyper_sell'
                );
            }
            
        } catch (error) {
            console.error('Update Error:', error);
            Object.values(elements).forEach(el => {
                if (el) el.textContent = 'Error';
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
            // Jupiter vs Hyperliquid
            case 'jup_hyper_buy':
                if (value > 0.00008) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.00004) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'jup_hyper_sell':
                if (value > 0.00001) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.0000) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            // Jupiter vs MEXC Contract
            case 'jup_contract_buy':
                if (value > 0.00008) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.00003) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'jup_contract_sell':
                if (value > 0.00005) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.00001) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            // MEXC Contract vs Spot
            case 'contract_spot_buy':
                if (value > 0.00005) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.00003) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'contract_spot_sell':
                if (value > 0.00001) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > -0.00000) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            // MEXC Future vs Hyperliquid Future
            case 'mexc_hyper_buy':
                if (value > 0) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > -0.000009) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            case 'mexc_hyper_sell':
                if (value > 0.000084) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.000042) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
        }

        if (shouldPlaySound && audioEnabled) {
            playSystemAlert(volume, frequency);
        }
    }

    (function init() {
        updateAlerts();
        // Set faster refresh rate (3800ms) for Jupiter API
        setInterval(updateAlerts, 3800);
        
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('pumpfun-jupiter-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton();
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();