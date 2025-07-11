const PUMP = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create audio enable button
    function createAudioEnableButton(tokenId) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'audio-btn-container';
        
        const enableButton = document.createElement('button');
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
        
        const section = document.getElementById(`${tokenId}-mexc-buy-alert`)?.closest('.token-section');
        if (section) {
            section.appendChild(btnContainer);
        }
    }

    async function playSystemAlert(volume = 0.2) {
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
            oscillator.frequency.value = 784; // G5
            gainNode.gain.value = volume;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.error('Sound playback failed:', error);
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

// Fetch Hyperliquid Futures prices using WebSocket - FIXED for object structure
function fetchHyperliquidFuturePrice() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
        let timeout;
        let receivedData = false;
        
        ws.onopen = () => {
            // Subscribe to order book updates
            ws.send(JSON.stringify({
                method: "subscribe",
                subscription: { type: "l2Book", coin: "PUMP" }
            }));
            
            // Set timeout to avoid hanging
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
                
                // Only process l2Book channel messages
                if (message.channel === "l2Book" && message.data) {
                    receivedData = true;
                    clearTimeout(timeout);
                    ws.close();
                    
                    const orderbook = message.data;
                    
                    // Validate response structure
                    if (!orderbook.levels || orderbook.levels.length < 2) {
                        reject(new Error('Invalid Hyperliquid response structure'));
                        return;
                    }
                    
                    const bids = orderbook.levels[0];
                    const asks = orderbook.levels[1];
                    
                    // Make sure we have at least one bid and ask
                    if (!bids || bids.length === 0 || !asks || asks.length === 0) {
                        reject(new Error('Empty bids or asks array'));
                        return;
                    }
                    
                    // Get best bid and ask prices from object structure
                    // Each item is an object with price, sz (size), and n (number of orders)
                    const bestBid = bids[0]?.px; // Price field
                    const bestAsk = asks[0]?.px; // Price field
                    
                    if (bestBid === undefined || bestAsk === undefined) {
                        // Log the problematic data for debugging
                        console.error('Invalid bid/ask data:', {
                            firstBid: bids[0],
                            firstAsk: asks[0]
                        });
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
                reject(new Error('Error parsing WebSocket message: ' + error.message));
            }
        };
        
        ws.onerror = (error) => {
            clearTimeout(timeout);
            ws.close();
            reject(new Error('WebSocket error: ' + error.message));
        };
        
        ws.onclose = () => {
            clearTimeout(timeout);
            if (!receivedData) {
                reject(new Error('WebSocket closed before receiving data'));
            }
        };
    });
}


    // Update token alerts with better error handling
    async function updateAlerts() {
        const elements = {
            buyAlert: document.getElementById('pump-mexc-buy-alert'),
            sellAlert: document.getElementById('pump-mexc-sell-alert')
        };

        try {
            // Fetch MEXC price first
            const mexcData = await fetchMexcFuturePrice();
            let hyperData = null;
            let hyperError = null;
            
            try {
                hyperData = await fetchHyperliquidFuturePrice();
            } catch (error) {
                console.error('Hyperliquid Error:', error);
                hyperError = error.message;
            }
            
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(6);
            };
            
            if (mexcData && hyperData) {
                const buyOpportunity = hyperData.bid - mexcData.ask;
                const sellOpportunity = mexcData.bid - hyperData.ask;
                
                elements.buyAlert.innerHTML = 
                    `H: $${format(hyperData.bid)} | M: $${format(mexcData.ask)} ` +
                    `<span class="difference">$${format(buyOpportunity)}</span>`;
                    
                elements.sellAlert.innerHTML = 
                    `M: $${format(mexcData.bid)} | H: $${format(hyperData.ask)} ` +
                    `<span class="difference">$${format(sellOpportunity)}</span>`;
                
                applyAlertStyles(
                    elements.buyAlert.querySelector('.difference'), 
                    buyOpportunity,
                    'buy'
                );
                applyAlertStyles(
                    elements.sellAlert.querySelector('.difference'), 
                    sellOpportunity,
                    'sell'
                );
            } else {
                if (elements.buyAlert) {
                    elements.buyAlert.innerHTML = 
                        `H: ${hyperData ? '$' + format(hyperData.bid) : 'N/A'} | M: ${mexcData ? '$' + format(mexcData.ask) : 'N/A'}` +
                        (hyperError ? `<div class="error">${hyperError}</div>` : '');
                }
                if (elements.sellAlert) {
                    elements.sellAlert.innerHTML = 
                        `M: ${mexcData ? '$' + format(mexcData.bid) : 'N/A'} | H: ${hyperData ? '$' + format(hyperData.ask) : 'N/A'}` +
                        (hyperError ? `<div class="error">${hyperError}</div>` : '');
                }
            }
            
        } catch (error) {
            console.error('Update Error:', error);
            if (elements.buyAlert) elements.buyAlert.textContent = 'Update Error';
            if (elements.sellAlert) elements.sellAlert.textContent = 'Update Error';
        }
    }

    function applyAlertStyles(element, value, type) {
        if (!element) return;
        
        element.className = 'difference';
        
        let shouldPlaySound = false;
        let volume = 0.2;
        let frequency = 784; // Default frequency (G5)
        
        // Different thresholds for buy and sell opportunities
        if (type === 'buy') {
            if (value > 0.00024) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 1046; // Higher pitch for buy (C6)
            } else if (value > 0.00019) {
                element.classList.add('alert-medium-positive');
                shouldPlaySound = true;
                volume = 0.1;
                frequency = 880; // A5
            } else if (value > 0.00014) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else if (value < 0) {
                element.classList.add('alert-negative');
            }
        } else if (type === 'sell') {
            if (value > -0.00006) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 523; // Lower pitch for sell (C5)
            } else if (value > -0.000011) {
                element.classList.add('alert-medium-positive');
                shouldPlaySound = true;
                volume = 0.1;
                frequency = 587; // D5
            } else if (value > -0.000016) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else if (value < 0) {
                element.classList.add('alert-negative');
            }
        }

        if (shouldPlaySound && audioEnabled) {
            playSystemAlert(volume, frequency);
        }
    }

    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 2500);
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('pump-mexc-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton('pump');
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();