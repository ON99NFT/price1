const GOOGLX = (() => {
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
        const section = document.getElementById('googlx-jupiter-buy-alert')?.closest('.token-section');
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
        const outputMintgooglx = 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN';
    
        try {
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintgooglx}&amount=198000000`),
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${outputMintgooglx}&outputMint=${inputMintUSDC}&amount=98000000`)
            ]);
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData?.outAmount ? 198 / (buyData.outAmount / 1e8) : null,
                sellPrice: sellData?.outAmount ? (sellData.outAmount / 1e6) / 0.98 : null
            };
        } catch (error) {
            console.error('Jupiter Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch MEXC contract price
    async function fetchMexcContractPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/GOOGLX_USDT';
        
        try {
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
            
            // Calculate weighted average for 0.98 GOOGLX
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
                bid: calculatePrice(data.data.bids, 0.98),
                ask: calculatePrice(data.data.asks, 0.98)
            };
        } catch (error) {
            console.error('MEXC Contract Error:', error);
            return null;
        }
    }

    // Fetch MEXC spot price
    async function fetchMexcSpotPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=GOOGLXUSDT&limit=5';
        
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
            jupBuy: document.getElementById('googlx-jupiter-buy-alert'),
            jupSell: document.getElementById('googlx-jupiter-sell-alert'),
        };

        try {
            // CORRECTED: Only two items in array, only two variables to destructure
            const [jupData, spotData] = await Promise.all([
                fetchJupPrice(),
                fetchMexcSpotPrice()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(2);
            };
            
    // Jupiter vs MEXC Spot
    if (jupData && spotData) {
        const buyDiff = spotData.ask - jupData.buyPrice;
        const sellDiff = jupData.sellPrice - spotData.bid;
        
        elements.jupBuy.innerHTML = 
          `J: $${format(jupData.buyPrice)} | S: $${format(spotData.ask)} ` +
          `<span class="difference">$${format(buyDiff)}</span>`;
          
        elements.jupSell.innerHTML = 
          `J: $${format(jupData.sellPrice)} | S: $${format(spotData.bid)} ` +
          `<span class="difference">$${format(sellDiff)}</span>`;
        
        applyAlertStyles(elements.jupBuy.querySelector('.difference'), buyDiff, true);
        applyAlertStyles(elements.jupSell.querySelector('.difference'), sellDiff, false);
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
        if (value > 5) {
            element.classList.add('alert-high-positive');
            shouldPlaySound = true;
        } else if (value > 3.5) {
            element.classList.add('alert-medium-positive');
            shouldPlaySound = true;
            volume = 0.1;
        } else if (value > 2) {
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
                const section = document.getElementById('googlx-jupiter-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton();
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();