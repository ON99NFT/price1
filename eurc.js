const EURC = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
    let retryDelay = 3000; // Initial retry delay in ms
    let consecutiveErrors = 0; // Track consecutive errors
  
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
        const url = 'https://contract.mexc.com/api/v1/contract/depth/EUR_USDT';
        
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

    // Fetch Forex EUR/USD rates using Finnhub API
    async function fetchForexPrice() {
        const API_KEY = 'd1pep6hr01qu436eb0agd1pep6hr01qu436eb0b0';
        const url = `https://finnhub.io/api/v1/forex/rates?base=USD&token=${API_KEY}`;
        
        try {
            const response = await fetch(url);
            
            // Handle 403 specifically with detailed error message
            if (response.status === 403) {
                const errorData = await response.json();
                throw new Error(`API key error: ${errorData.error || 'Invalid API key'}`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data?.quote?.EUR) {
                throw new Error('Invalid Forex response structure');
            }
            
            // Convert EUR/USD rate to USD/EUR (1 EUR = ? USD)
            const eurUsdRate = 1 / data.quote.EUR;
            
            // Apply a small spread (0.0002) to simulate bid/ask
            return {
                bid: eurUsdRate - 0.0001,
                ask: eurUsdRate + 0.0001
            };
        } catch (error) {
            console.error('Forex Error:', error);
            throw error; // Rethrow to handle in caller
        }
    }

    // Fetch KyberSwap prices
    async function fetchKyberPrice() {
        const addresses = {
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            EURC: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
        };

        try {
            // Format amounts properly without scientific notation
            const buyAmount = "20333000000"; // 20333 USDC with 18 decimals
            const sellAmount = "17500000000"; // 17500 EURC with 18 decimals
            
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.EURC}&amountIn=${buyAmount}`),
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.EURC}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}`)
            ]);

            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData.data?.routeSummary?.amountOut ? 
                    20333 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e6) : null,
                sellPrice: sellData.data?.routeSummary?.amountOut ? 
                    (parseFloat(sellData.data.routeSummary.amountOut) / 1e6) / 17500 : null
            };
        } catch (error) {
            console.error('Kyber Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Update token alerts
    async function updateAlerts() {
        const elements = {
            kyberBuy: document.getElementById('eurc-kyber-buy-alert'),
            kyberSell: document.getElementById('eurc-kyber-sell-alert'),
            mexcBuy: document.getElementById('eurc-mexc-buy-alert'),
            mexcSell: document.getElementById('eurc-mexc-sell-alert')
        };

        try {
            const [kyberData, contractData, forexData] = await Promise.all([
                fetchKyberPrice(),
                fetchMexcContractPrice(),
                fetchForexPrice().catch(error => {
                    // Handle forex errors specifically
                    console.error('Forex fetch failed:', error);
                    return { error: error.message };
                })
            ]);
            
            // Reset retry delay on successful fetch
            consecutiveErrors = 0;
            retryDelay = 3000;
            
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
            } else {
                if (!kyberData) {
                    elements.kyberBuy.textContent = 'Kyber data error';
                    elements.kyberSell.textContent = 'Kyber data error';
                }
                if (!contractData) {
                    elements.kyberBuy.textContent = 'MEXC contract error';
                    elements.kyberSell.textContent = 'MEXC contract error';
                }
            }
            
            // Update Contract vs Forex
            if (contractData && forexData) {
                const contractBuyDiff = contractData.bid - forexData.ask;
                const contractSellDiff = forexData.bid - contractData.ask;
                
                elements.mexcBuy.innerHTML = 
                    `C: $${format(contractData.bid)} | FX: $${format(forexData.ask)} ` +
                    `<span class="difference">$${format(contractBuyDiff)}</span>`;
                    
                elements.mexcSell.innerHTML = 
                    `C: $${format(contractData.ask)} | FX: $${format(forexData.bid)} ` +
                    `<span class="difference">$${format(contractSellDiff)}</span>`;
                
                applyAlertStyles(elements.mexcBuy.querySelector('.difference'), contractBuyDiff, true);
                applyAlertStyles(elements.mexcSell.querySelector('.difference'), contractSellDiff, false);
            } else {
                if (forexData?.error) {
                    elements.mexcBuy.innerHTML = `<span class="error">API Key Error</span>`;
                    elements.mexcSell.innerHTML = `<span class="error">${forexData.error}</span>`;
                } else if (!forexData) {
                    elements.mexcBuy.innerHTML = `<span class="error">Forex API Error</span>`;
                    elements.mexcSell.innerHTML = `<span class="error">Data unavailable</span>`;
                }
                if (!contractData) {
                    elements.mexcBuy.textContent = 'MEXC contract error';
                    elements.mexcSell.textContent = 'MEXC contract error';
                }
            }
            
        } catch (error) {
            console.error('Update Error:', error);
            
            // Implement exponential backoff
            consecutiveErrors++;
            retryDelay = Math.min(30000, 3000 * Math.pow(2, consecutiveErrors));
            
            Object.values(elements).forEach(el => {
                if (el) el.textContent = `Error - retrying in ${Math.round(retryDelay/1000)}s`;
            });
        } finally {
            // Schedule next update with dynamic delay
            setTimeout(updateAlerts, retryDelay);
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
        if (value > 0.0015) {
            element.classList.add('alert-high-positive');
            shouldPlaySound = true;
        } else if (value > 0.0011) {
            element.classList.add('alert-medium-positive');
            shouldPlaySound = true;
            volume = 0.1;
        } else if (value > 0.0006) {
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
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('eurc-kyber-buy-alert')?.closest('.token-section') || 
                                document.getElementById('eurc-buy-alert')?.closest('.token-section');
                
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton('eurc');
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();