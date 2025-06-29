const XO = (() => {
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
        const section = document.getElementById(`${tokenId}-bluefin-buy-alert`)?.closest('.token-section');
        if (section) {
            section.appendChild(btnContainer);
        }
    }

    // Play system alert
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

    // Fetch MEXC contract prices
    async function fetchMexcContractPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/XO_USDT';
        
        try {
            const response = await fetch(proxyUrl + url);
            const data = await response.json();
            
            if (!data?.data?.bids?.[0]?.[0]) throw new Error('Invalid MEXC response');
            
            return {
                bid: parseFloat(data.data.bids[0][0]),
                ask: parseFloat(data.data.asks[0][0])
            };
        } catch (error) {
            console.error('MEXC Contract Error:', error);
            return null;
        }
    }

    // Fetch MEXC spot prices
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://api.mexc.com/api/v3/depth?symbol=XOUSDT&limit=5';
        
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            const data = await response.json();
            
            const bestBid = data.bids?.[0]?.[0];
            const bestAsk = data.asks?.[0]?.[0];
            
            if (!bestBid || !bestAsk) throw new Error('Invalid spot order book');
            
            return {
                bid: parseFloat(bestBid),
                ask: parseFloat(bestAsk)
            };
        } catch (error) {
            console.error('MEXC Spot Error:', error);
            return null;
        }
    }

    async function fetchXoPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const bluefinUrl = 'https://swap.api.sui-prod.bluefin.io/api/v1/tokens/price?tokens=0x90f9eb95f62d31fbe2179313547e360db86d88d2399103a94286291b63f469ba::xo::XO';
        
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(bluefinUrl));
            const data = await response.json();
            
            if (Array.isArray(data) && data.length > 0 && data[0].price) {
                const priceInUSD = parseFloat(data[0].price);
                return {
                    buyPrice: priceInUSD * 1.007,  // Add 0.8% for buy slippage
                    sellPrice: priceInUSD * 0.993   // Subtract 0.8% for sell slippage
                };
            }
            
            throw new Error('Bluefin returned invalid data');
        } catch (error) {
            console.error('Bluefin Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    async function updateAlerts() {
        const elements = {
            bluefinBuy: document.getElementById('xo-bluefin-buy-alert'),
            bluefinSell: document.getElementById('xo-bluefin-sell-alert'),
            mexcBuy: document.getElementById('xo-mexc-buy-alert'),
            mexcSell: document.getElementById('xo-mexc-sell-alert')
        };

        try {
            const [bluefinData, contractData, spotData] = await Promise.all([
                fetchXoPrice(),
                fetchMexcContractPrice(),
                fetchMexcSpotPrice()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(5);
            };
            
            // Update Bluefin vs Contract
            if (bluefinData && bluefinData.buyPrice !== null && bluefinData.sellPrice !== null && 
                contractData && contractData.bid !== null && contractData.ask !== null) {
                
                const bluefinBuyDiff = contractData.bid - bluefinData.buyPrice;
                const bluefinSellDiff = bluefinData.sellPrice - contractData.ask;
                
                elements.bluefinBuy.innerHTML = 
                    `B: $${format(bluefinData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(bluefinBuyDiff)}</span>`;
                    
                elements.bluefinSell.innerHTML = 
                    `B: $${format(bluefinData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(bluefinSellDiff)}</span>`;
                
                applyAlertStyles(elements.bluefinBuy.querySelector('.difference'), bluefinBuyDiff, true);
                applyAlertStyles(elements.bluefinSell.querySelector('.difference'), bluefinSellDiff, false);
            } else {
                // Handle missing price data
                if (!bluefinData || bluefinData.buyPrice === null || bluefinData.sellPrice === null) {
                    elements.bluefinBuy.textContent = 'Bluefin price data unavailable';
                    elements.bluefinSell.textContent = 'Bluefin price data unavailable';
                }
                
                if (!contractData || contractData.bid === null || contractData.ask === null) {
                    elements.bluefinBuy.textContent = elements.bluefinBuy.textContent || 'MEXC contract data unavailable';
                    elements.bluefinSell.textContent = elements.bluefinSell.textContent || 'MEXC contract data unavailable';
                }
            }
            
            // Update Contract vs Spot
            if (contractData && spotData && 
                contractData.bid !== null && contractData.ask !== null &&
                spotData.bid !== null && spotData.ask !== null) {
                
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
            } else {
                // Handle missing spot data
                if (!contractData || contractData.bid === null || contractData.ask === null) {
                    elements.mexcBuy.textContent = 'MEXC contract data unavailable';
                    elements.mexcSell.textContent = 'MEXC contract data unavailable';
                }
                
                if (!spotData || spotData.bid === null || spotData.ask === null) {
                    elements.mexcBuy.textContent = elements.mexcBuy.textContent || 'MEXC spot data unavailable';
                    elements.mexcSell.textContent = elements.mexcSell.textContent || 'MEXC spot data unavailable';
                }
            }
            
        } catch (error) {
            console.error('Update Error:', error);
            
            // Set all elements to error state
            elements.bluefinBuy.textContent = 'Update error';
            elements.bluefinSell.textContent = 'Update error';
            elements.mexcBuy.textContent = 'Update error';
            elements.mexcSell.textContent = 'Update error';
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
    
        if (value > 0.0001) {
            element.classList.add('alert-high-positive');
            shouldPlaySound = true;
        } else if (value > 0.00006) {
            element.classList.add('alert-medium-positive');
            shouldPlaySound = true;
            volume = 0.1;
        } else if (value > 0.00003) {
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
        setInterval(updateAlerts, 4000);
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('xo-bluefin-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton('xo');
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();