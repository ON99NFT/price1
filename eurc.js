const EURC = (() => {
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
        const section = document.getElementById('eurc-kyber-buy-alert')?.closest('.token-section');
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
            return { error: error.message };
        }
    }

    // Fetch KyberSwap prices
    async function fetchKyberPrice() {
        const addresses = {
            USDC: '0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913',
            EURC: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
        };

        try {
            // Format amounts properly without scientific notation
            const buyAmount = "11500000000"; // 11500 USDC with 18 decimals
            const sellAmount = "10000000000"; // 10000 EURC with 18 decimals
            
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.EURC}&amountIn=${buyAmount}&excludedSources=lo1inch`),
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.EURC}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}&excludedSources=lo1inch`)
            ]);

            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData.data?.routeSummary?.amountOut ? 
                    11500 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e6) : null,
                sellPrice: sellData.data?.routeSummary?.amountOut ? 
                    (parseFloat(sellData.data.routeSummary.amountOut) / 1e6) / 10000 : null
            };
        } catch (error) {
            console.error('Kyber Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch Jupiter prices for EURC
    async function fetchJupPriceForEURC() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintEURC = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';
        
        try {
            const [buyResponse, sellResponse] = await Promise.all([
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintEURC}&amount=11500000000`), // 6000 USDC
                fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${outputMintEURC}&outputMint=${inputMintUSDC}&amount=10000000000`)  // 5000 EURC
            ]);
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData?.outAmount ? 11500 / (parseInt(buyData.outAmount) / 1e6) : null,
                sellPrice: sellData?.outAmount ? (parseInt(sellData.outAmount) / 1e6) / 10000 : null
            };
        } catch (error) {
            console.error('Jupiter EURC Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Update alerts with pumpfun-like system
    async function updateAlerts() {
        const elements = {
            kyberBuy: document.getElementById('eurc-kyber-buy-alert'),
            kyberSell: document.getElementById('eurc-kyber-sell-alert'),
            mexcBuy: document.getElementById('eurc-mexc-buy-alert'),
            mexcSell: document.getElementById('eurc-mexc-sell-alert'),
            kyberJupBuy: document.getElementById('eurc-kyber-jupiter-buy-alert'),
            kyberJupSell: document.getElementById('eurc-kyber-jupiter-sell-alert')
        };

        try {
            const [kyberData, contractData, forexData, jupData] = await Promise.all([
                fetchKyberPrice(),
                fetchMexcContractPrice(),
                fetchForexPrice(),
                fetchJupPriceForEURC()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(5);
            };
            
            // Kyber vs MEXC Contract
            if (kyberData && contractData) {
                const kyberBuyDiff = contractData.bid - kyberData.buyPrice;
                const kyberSellDiff = kyberData.sellPrice - contractData.ask;
                
                elements.kyberBuy.innerHTML = 
                    `K: $${format(kyberData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(kyberBuyDiff)}</span>`;
                    
                elements.kyberSell.innerHTML = 
                    `K: $${format(kyberData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(kyberSellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.kyberBuy.querySelector('.difference'), 
                    kyberBuyDiff,
                    'kyber_buy'
                );
                applyAlertStyles(
                    elements.kyberSell.querySelector('.difference'), 
                    kyberSellDiff,
                    'kyber_sell'
                );
            }
            
            // MEXC Contract vs Forex
            if (contractData && forexData && !forexData.error) {
                const contractBuyDiff = contractData.bid - forexData.ask;
                const contractSellDiff = forexData.bid - contractData.ask;
                
                elements.mexcBuy.innerHTML = 
                    `C: $${format(contractData.bid)} | FX: $${format(forexData.ask)} ` +
                    `<span class="difference">$${format(contractBuyDiff)}</span>`;
                    
                elements.mexcSell.innerHTML = 
                    `C: $${format(contractData.ask)} | FX: $${format(forexData.bid)} ` +
                    `<span class="difference">$${format(contractSellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.mexcBuy.querySelector('.difference'), 
                    contractBuyDiff,
                    'contract_forex_buy'
                );
                applyAlertStyles(
                    elements.mexcSell.querySelector('.difference'), 
                    contractSellDiff,
                    'contract_forex_sell'
                );
            } else {
                // Handle errors
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
            
            // Kyber vs Jupiter
 // Replace the Jupiter comparison section in updateAlerts()
if (kyberData && jupData) {
    // Corrected comparisons:
    const buyDiff = jupData.sellPrice - kyberData.buyPrice;  // Positive = opportunity
    const sellDiff = kyberData.sellPrice - jupData.buyPrice;   // Positive = opportunity

    elements.kyberJupBuy.innerHTML = 
        `K: $${format(kyberData.buyPrice)} | J: $${format(jupData.sellPrice)} ` +
        `<span class="difference">$${format(buyDiff)}</span>`;
        
    elements.kyberJupSell.innerHTML = 
        `K: $${format(kyberData.sellPrice)} | J: $${format(jupData.buyPrice)} ` +
        `<span class="difference">$${format(sellDiff)}</span>`;
    
    applyAlertStyles(
        elements.kyberJupBuy.querySelector('.difference'), 
        buyDiff,
        'kyber_jup_buy'
    );
    applyAlertStyles(
        elements.kyberJupSell.querySelector('.difference'), 
        sellDiff,
        'kyber_jup_sell'
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
            // Kyber vs MEXC Contract - Buy
            case 'kyber_buy':
                if (value > 0.0006) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.0003) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            // Kyber vs MEXC Contract - Sell
            case 'kyber_sell':
                if (value > 0.0014) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.0007) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            // Contract vs Forex - Buy
            case 'contract_forex_buy':
                if (value > 0.0006) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.0003) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            // Contract vs Forex - Sell
            case 'contract_forex_sell':
                if (value > 0.0012) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.0006) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 587; // D5
                }
                break;
                
            // Kyber vs Jupiter - Buy
            case 'kyber_jup_buy':
                if (value > 0.0012) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.0006) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            // Kyber vs Jupiter - Sell
            case 'kyber_jup_sell':
                if (value > 0.001) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 523; // C5
                } else if (value > 0.0005) {
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
        // Set refresh rate to match pumpfun
        setInterval(updateAlerts, 3300);
        
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.getElementById('eurc-kyber-buy-alert')?.closest('.token-section');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton();
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();