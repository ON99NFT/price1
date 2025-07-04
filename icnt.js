const ICNT = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
// Create audio enable button
function createAudioEnableButton(tokenId) {
    // Create container for the button
    const btnContainer = document.createElement('div');
    btnContainer.className = 'audio-btn-container';
    
    // Create the button
    const enableButton = document.createElement('button');
    enableButton.className = 'token-audio-btn';
    enableButton.innerHTML = '<span class="audio-icon">🔇</span> Enable';
    
    // Audio enable handler
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
            
            // Change icon and add success styling
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

    // Add button to container
    btnContainer.appendChild(enableButton);
    
    // Add container to token section
    const section = document.getElementById(`${tokenId}-kyber-buy-alert`)?.closest('.token-section') || 
                    document.getElementById(`${tokenId}-buy-alert`)?.closest('.token-section');
    
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
        const url = 'https://contract.mexc.com/api/v1/contract/depth/ICNT_USDT';
        
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
        const url = 'https://api.mexc.com/api/v3/depth?symbol=ICNTUSDT&limit=5';
        
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

    // Fetch KyberSwap prices
    async function fetchKyberPrice() {
        const addresses = {
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            ICNT: '0xe0cd4cacddcbf4f36e845407ce53e87717b6601d'
        };

        try {
            // Format amounts properly without scientific notation
            const buyAmount = "1098000000"; // 1098 USDC with 6 decimals
            const sellAmount = "2998000000000000000000"; // 2998 ICNT with 18 decimals
            
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.ICNT}&amountIn=${buyAmount}`),
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.ICNT}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}`)
            ]);

            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData.data?.routeSummary?.amountOut ? 
                    1098 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e18) : null,
                sellPrice: sellData.data?.routeSummary?.amountOut ? 
                    (parseFloat(sellData.data.routeSummary.amountOut) / 1e6) / 2998 : null
            };
        } catch (error) {
            console.error('Kyber Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Update token alerts
    async function updateAlerts() {
        const elements = {
            kyberBuy: document.getElementById('icnt-kyber-buy-alert'),
            kyberSell: document.getElementById('icnt-kyber-sell-alert'),
            mexcBuy: document.getElementById('icnt-mexc-buy-alert'),
            mexcSell: document.getElementById('icnt-mexc-sell-alert')
        };

        try {
            const [kyberData, contractData, spotData] = await Promise.all([
                fetchKyberPrice(),
                fetchMexcContractPrice(),
                fetchMexcSpotPrice()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(4);
            };
            
            // Update Kyber vs Contract
            if (kyberData && contractData) {
                const kyberBuyDiff = contractData.bid - kyberData.buyPrice;
                const kyberSellDiff = kyberData.sellPrice - contractData.ask;
                
                elements.kyberBuy.innerHTML = 
                    `K: $${format(kyberData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(kyberBuyDiff)}</span>`;
                    
                elements.kyberSell.innerHTML = 
                    `K: $${format(kyberData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(kyberSellDiff)}</span>`;
                
                applyAlertStyles(elements.kyberBuy.querySelector('.difference'), kyberBuyDiff, true);
                applyAlertStyles(elements.kyberSell.querySelector('.difference'), kyberSellDiff, false);
            }
            
            // Update Contract vs Spot
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
        
        // Clear classes and previous icons
        element.className = 'difference';
        const existingIcon = element.querySelector('.direction-icon');
        if (existingIcon) existingIcon.remove();
        
        let shouldPlaySound = false;
        let volume = 0.2;
        
        // Add direction indicator
        const direction = document.createElement('span');
        direction.className = 'direction-icon';
        direction.textContent = isBuy ? ' ↑' : ' ↓';
        element.appendChild(direction);
    
        // Determine alert level - new eye-friendly version
        if (value > 0.03) {
            element.classList.add('alert-high-positive');
            shouldPlaySound = true;
        } else if (value > 0.02) {
            element.classList.add('alert-medium-positive');
            shouldPlaySound = true;
            volume = 0.1;
        } else if (value > 0.01) {
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
        setInterval(updateAlerts, 3000);
        setTimeout(() => {
            if (!audioEnabled) {
                // NEW: Check only within ICNT's token section
                const section = document.getElementById('icnt-kyber-buy-alert')?.closest('.token-section') || 
                                document.getElementById('icnt-buy-alert')?.closest('.token-section');
                
                // Create button only if section exists and has no audio button
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton('icnt');
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();