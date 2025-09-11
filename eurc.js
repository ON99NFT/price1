const EURC = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
    let fundingRateInterval = null;
    let nextFundingTime = null;

    // Fetch MEXC Funding Rate for EURC (EUR_USDT)
    async function fetchMexcFundingRate() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/funding_rate/EUR_USDT';
        
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

    // Update funding rate countdown timer
    function updateFundingCountdown() {
        if (!nextFundingTime) return;
        
        const now = new Date().getTime();
        const diff = nextFundingTime - now;
        
        if (diff <= 0) {
            // Time's up, refresh funding rate
            updateFundingRate();
            return;
        }
        
        // Format the time difference
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('eurc-next-funding').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update funding rate display
    async function updateFundingRate() {
        const fundingElement = document.getElementById('eurc-funding-rate');
        const rateValueElement = fundingElement.querySelector('.funding-rate-value');
        
        try {
            const fundingData = await fetchMexcFundingRate();
            
            if (!fundingData) {
                rateValueElement.textContent = 'Error';
                fundingElement.className = 'funding-rate';
                return;
            }
            
            const rate = fundingData.rate;
            const ratePercent = (rate * 100).toFixed(4);
            
            rateValueElement.textContent = `${ratePercent}%`;
            
            // Set appropriate styling based on rate value
            if (rate > 0.0005) {
                fundingElement.className = 'funding-rate positive';
            } else if (rate < -0.0005) {
                fundingElement.className = 'funding-rate negative';
            } else {
                fundingElement.className = 'funding-rate neutral';
            }
            
            // Set next funding time
            nextFundingTime = parseInt(fundingData.nextTime);
            
            // Start countdown if not already running
            if (!fundingRateInterval) {
                fundingRateInterval = setInterval(updateFundingCountdown, 1000);
            }
            
        } catch (error) {
            console.error('Funding Rate Update Error:', error);
            rateValueElement.textContent = 'Error';
            fundingElement.className = 'funding-rate';
        }
    }

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
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.EURC}&amountIn=${buyAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`),
                fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.EURC}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`)
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
            jupMexcBuy: document.getElementById('eurc-jup-mexc-buy-alert'),
            jupMexcSell: document.getElementById('eurc-jup-mexc-sell-alert')
        };

        try {
            const [kyberData, contractData, jupData] = await Promise.all([
                fetchKyberPrice(),
                fetchMexcContractPrice(),
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
            
            // Jupiter vs MEXC
            if (jupData && contractData) {
                const buyDiff = contractData.bid - jupData.buyPrice;
                const sellDiff = jupData.sellPrice - contractData.ask;

                elements.jupMexcBuy.innerHTML = 
                    `J: $${format(jupData.buyPrice)} | M: $${format(contractData.bid)} ` +
                    `<span class="difference">$${format(buyDiff)}</span>`;
                
                elements.jupMexcSell.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | M: $${format(contractData.ask)} ` +
                    `<span class="difference">$${format(sellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.jupMexcBuy.querySelector('.difference'), 
                    buyDiff,
                    'jup_mexc_buy'
                );
                applyAlertStyles(
                    elements.jupMexcSell.querySelector('.difference'), 
                    sellDiff,
                    'jup_mexc_sell'
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
                if (value > 0.0015) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.0005) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 523; // A5
                }
                break;
                
            // Kyber vs MEXC Contract - Sell
            case 'kyber_sell':
                if (value > 0.0015) {
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
                
            // Jupiter vs MEXC - Buy
            case 'jup_mexc_buy':
                if (value > 0.0015) {
                    element.classList.add('alert-high-positive');
                    shouldPlaySound = true;
                    frequency = 1046; // C6
                } else if (value > 0.0005) {
                    element.classList.add('alert-medium-positive');
                    shouldPlaySound = true;
                    volume = 0.1;
                    frequency = 880; // A5
                }
                break;
                
            // Jupiter vs MEXC - Sell
            case 'jup_mexc_sell':
                if (value > 0.0015) {
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
        updateFundingRate(); // Initial funding rate fetch
        // Set refresh rate to match pumpfun
        setInterval(updateAlerts, 4700);
        setInterval(updateFundingRate, 300000); // Update funding rate every 5 minutes
        
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