const W = (() => {
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
        const section = document.getElementById('w-jupiter-buy-alert')?.closest('.token-section');
        if (section) {
            section.appendChild(btnContainer);
        }
    }

    // Play alert sound
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

    // Fetch Jupiter price
    async function fetchJupPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintw = '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ';
    
        try {
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintw}&amount=698000000`),
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${outputMintw}&outputMint=${inputMintUSDC}&amount=9998000000`)
            ]);
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData?.outAmount ? 698 / (buyData.outAmount / 1e6) : null,
                sellPrice: sellData?.outAmount ? (sellData.outAmount / 1e6) / 9998 : null
            };
        } catch (error) {
            console.error('Jupiter Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch MEXC contract price
    async function fetchMexcContractPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/W_USDT';
        
        try {
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
            
            // Calculate weighted average for 5998 W
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
                bid: calculatePrice(data.data.bids, 5998),
                ask: calculatePrice(data.data.asks, 5998)
            };
        } catch (error) {
            console.error('MEXC Contract Error:', error);
            return null;
        }
    }

    // Fetch MEXC spot price
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=WUSDT&limit=5';
        
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

    // Update alerts
    async function updateAlerts() {
        const elements = {
            jupBuy: document.getElementById('w-jupiter-buy-alert'),
            jupSell: document.getElementById('w-jupiter-sell-alert'),
            mexcBuy: document.getElementById('w-mexc-buy-alert'),
            mexcSell: document.getElementById('w-mexc-sell-alert')
        };

        try {
            const [jupData, contractData, spotData] = await Promise.all([
                fetchJupPrice(),
                fetchMexcContractPrice(),
                fetchMexcSpotPrice()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(4);
            };
            
            // Jupiter vs MEXC Contract
            if (jupData && contractData) {
                const buyDiff = contractData.bid - jupData.buyPrice;
                const sellDiff = jupData.sellPrice - contractData.ask;
                
                elements.jupBuy.innerHTML = 
                    `J: $${format(jupData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(buyDiff)}</span>`;
                    
                elements.jupSell.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(sellDiff)}</span>`;
                
                applyAlertStyles(elements.jupBuy.querySelector('.difference'), buyDiff, true);
                applyAlertStyles(elements.jupSell.querySelector('.difference'), sellDiff, false);
            }
            
            // MEXC Contract vs Spot
            if (contractData && spotData) {
                const contractBuyDiff = contractData.bid - spotData.ask;
                const contractSellDiff = spotData.bid - contractData.ask;
                
                elements.mexcBuy.innerHTML = 
                    `C: $${format(contractData.bid)} | S: $${format(spotData.ask)} ` +
                    `<span class="difference">$${format(contractBuyDiff)}</span>`;
                    
                elements.mexcSell.innerHTML = 
                    `C: $${format(contractData.ask)} | S: $${format(spotData.bid)} ` +
                    `<span class="difference">$${format(contractSellDiff)}</span>`;
                
                applyAlertStyles(elements.mexcBuy.querySelector('.difference'), contractBuyDiff, true);
                applyAlertStyles(elements.mexcSell.querySelector('.difference'), contractSellDiff, false);
            }
            
        } catch (error) {
            console.error('Update Error:', error);
            Object.values(elements).forEach(el => {
                if (el) el.textContent = 'Error';
            });
        }
    }

    function applyAlertStyles(element, value, isBuy) {
        if (!element) return;
        
        element.className = 'difference';
        const existingIcon = element.querySelector('.direction-icon');
        if (existingIcon) existingIcon.remove();
        
        let shouldPlaySound = false;
        let volume = 0.2;
        
        const direction = document.createElement('span');
        direction.className = 'direction-icon';
        direction.textContent = isBuy ? ' ↑' : ' ↓';
        element.appendChild(direction);
    
        // Alert thresholds
        if (value > 0.003) {
            element.classList.add('alert-high-positive');
            shouldPlaySound = true;
        } else if (value > 0.002) {
            element.classList.add('alert-medium-positive');
            shouldPlaySound = true;
            volume = 0.1;
        } else if (value > 0.001) {
            element.classList.add('alert-large-green');
        } else if (value > 0) {
            element.classList.add('alert-positive');
        } else if (value < 0) {
            element.classList.add('alert-negative');
        }

        if (shouldPlaySound && audioEnabled) {
            playSystemAlert(volume);
        }
    }

    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 3800);
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('w-jupiter-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton();
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();