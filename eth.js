// eth.js
const ETH = (() => {
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
        const section = document.querySelector('.token-section:nth-child(2)');
        if (section) {
            section.appendChild(btnContainer);
        }
    }

    // Play alert sound
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

    // Fetch MEXC ETH Futures prices
    async function fetchMexcETHPrice() {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const url = 'https://contract.mexc.com/api/v1/contract/depth/ETH_USDT';
        
        try {
            const response = await fetch(proxyUrl + url);
            const data = await response.json();
            
            if (!data?.data?.bids?.[0]?.[0]) throw new Error('Invalid MEXC response');
            
            return {
                bid: parseFloat(data.data.bids[0][0]),
                ask: parseFloat(data.data.asks[0][0])
            };
        } catch (error) {
            console.error('MEXC ETH Error:', error);
            return null;
        }
    }

    // Fetch KyberSwap ETH price on Base
    async function fetchKyberETHPrice() {
        const addresses = {
            USDC: '0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913', // Base USDC
            ETH: '0x4200000000000000000000000000000000000006'  // Base WETH
        };

        try {
            // Buy ETH with 6000 USDC
            const buyAmount = "6000000000"; // 6000 USDC (6 decimals)
            const buyResponse = await fetch(
                `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.ETH}&amountIn=${buyAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`
            );
            
            // Sell 1 ETH
            const sellAmount = "1000000000000000000"; // 1 ETH (18 decimals)
            const sellResponse = await fetch(
                `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.ETH}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`
            );

            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData.data?.routeSummary?.amountOut ? 
                    6000 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e18) : null,
                sellPrice: sellData.data?.routeSummary?.amountOut ? 
                    parseFloat(sellData.data.routeSummary.amountOut) / 1e6 : null
            };
        } catch (error) {
            console.error('Kyber ETH Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Fetch Jupiter ETH price on Solana
    async function fetchJupETHPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Solana USDC
        const outputMintETH = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'; // Solana WETH
        
        try {
            // Buy ETH with 6000 USDC
            const buyResponse = await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${inputMintUSDC}&outputMint=${outputMintETH}&amount=6000000000`
            );
            
            // Sell 1 ETH (1e8 tokens since Solana ETH has 8 decimals)
            const sellResponse = await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${outputMintETH}&outputMint=${inputMintUSDC}&amount=100000000`
            );
            
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            return {
                buyPrice: buyData?.outAmount ? 6000 / (parseInt(buyData.outAmount) / 1e8) : null,
                sellPrice: sellData?.outAmount ? parseInt(sellData.outAmount) / 1e6 : null
            };
        } catch (error) {
            console.error('Jupiter ETH Error:', error);
            return { buyPrice: null, sellPrice: null };
        }
    }

    // Update alerts
    async function updateAlerts() {
        const elements = {
            kyberMexcBuy: document.getElementById('eth-kyber-mexc-buy-alert'),
            kyberMexcSell: document.getElementById('eth-kyber-mexc-sell-alert'),
            jupMexcBuy: document.getElementById('eth-jup-mexc-buy-alert'),
            jupMexcSell: document.getElementById('eth-jup-mexc-sell-alert')
        };

        try {
            const [kyberData, mexcData, jupData] = await Promise.all([
                fetchKyberETHPrice(),
                fetchMexcETHPrice(),
                fetchJupETHPrice()
            ]);
            
            // Formatting helper
            const format = (val) => {
                if (val === null || isNaN(val)) return 'N/A';
                return val.toFixed(1);
            };
            
            // Kyber vs MEXC
            if (kyberData && mexcData) {
                const buyDiff = mexcData.bid - kyberData.buyPrice;
                const sellDiff = kyberData.sellPrice - mexcData.ask;
                
                elements.kyberMexcBuy.innerHTML = 
                    `K: $${format(kyberData.buyPrice)} | M: $${format(mexcData.bid)} ` +
                    `<span class="difference">$${format(buyDiff)}</span>`;
                    
                elements.kyberMexcSell.innerHTML = 
                    `K: $${format(kyberData.sellPrice)} | M: $${format(mexcData.ask)} ` +
                    `<span class="difference">$${format(sellDiff)}</span>`;
                
                applyAlertStyles(
                    elements.kyberMexcBuy.querySelector('.difference'), 
                    buyDiff,
                    'kyber_mexc_buy'
                );
                applyAlertStyles(
                    elements.kyberMexcSell.querySelector('.difference'), 
                    sellDiff,
                    'kyber_mexc_sell'
                );
            }
            
            // Jupiter vs MEXC
            if (jupData && mexcData) {
                const buyDiff = mexcData.bid - jupData.buyPrice;
                const sellDiff = jupData.sellPrice - mexcData.ask;
                
                elements.jupMexcBuy.innerHTML = 
                    `J: $${format(jupData.buyPrice)} | M: $${format(mexcData.bid)} ` +
                    `<span class="difference">$${format(buyDiff)}</span>`;
                    
                elements.jupMexcSell.innerHTML = 
                    `J: $${format(jupData.sellPrice)} | M: $${format(mexcData.ask)} ` +
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
            console.error('ETH Update Error:', error);
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
            if (value > 10) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 1046; // C6
            } else if (value > 5) {
                element.classList.add('alert-medium-positive');
                shouldPlaySound = true;
                volume = 0.1;
                frequency = 880; // A5
            }
            break;
            
        // Kyber vs MEXC Contract - Sell
        case 'kyber_sell':
            if (value > 10) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 523; // C5
            } else if (value > 5) {
                element.classList.add('alert-medium-positive');
                shouldPlaySound = true;
                volume = 0.1;
                frequency = 587; // D5
            }
            break;
            
        // Kyber vs Jupiter - Buy
        case 'kyber_jup_buy':
            if (value > 10) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 1046; // C6
            } else if (value > 5) {
                element.classList.add('alert-medium-positive');
                shouldPlaySound = true;
                volume = 0.1;
                frequency = 880; // A5
            }
            break;
            
        // Kyber vs Jupiter - Sell
        case 'kyber_jup_sell':
            if (value > 10) {
                element.classList.add('alert-high-positive');
                shouldPlaySound = true;
                frequency = 523; // C5
            } else if (value > 5) {
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
        setInterval(updateAlerts, 5700);
        
        setTimeout(() => {
            if (!audioEnabled) {
                const section = document.querySelector('.token-section:nth-child(2)');
                if (section && !section.querySelector('.audio-btn-container')) {
                    createAudioEnableButton();
                }
            }
        }, 5000);
    })();
  
    return { updateAlerts };
})();