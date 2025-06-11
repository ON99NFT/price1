const PUMPBTC = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'pumpbtc-audio-enable-btn';
        enableButton.innerHTML = '🔇 Click to Enable Alert Sounds';
        enableButton.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 5000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
  
        // Add hover effects
        enableButton.addEventListener('mouseover', () => {
            enableButton.style.transform = 'scale(1.05)';
            enableButton.style.background = '#45a049';
        });
        
        enableButton.addEventListener('mouseout', () => {
            enableButton.style.transform = 'scale(1)';
            enableButton.style.background = '#4CAF50';
        });
  
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
                enableButton.innerHTML = '🔊 Sounds Enabled!';
                setTimeout(() => {
                    enableButton.style.opacity = '0';
                    setTimeout(() => enableButton.remove(), 300);
                }, 2000);
            } catch (error) {
                console.error('Audio initialization failed:', error);
                enableButton.innerHTML = '❌ Error Enabling Sounds';
                enableButton.style.background = '#f44336';
            }
        });
  
        const section = document.getElementById('pumpbtc-buy-alert').closest('.token-section');
        section.appendChild(enableButton);
    }
  
    // Modified playSystemAlert function
    function playSystemAlert() {
        if (!audioEnabled || !audioContext) return;
    
        try {
            const primaryOsc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            primaryOsc.connect(gainNode);
            gainNode.connect(audioContext.destination);
    
            // Pleasant chime configuration
            primaryOsc.type = 'sine';
            primaryOsc.frequency.setValueAtTime(784.0, audioContext.currentTime); // G5 note
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            
            // Create volume envelope
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            primaryOsc.start();
            primaryOsc.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Sound playback error:', error);
        }
    }
  
    // Fetch MEXC prices
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const response = await fetch(proxyUrl + 'https://contract.mexc.com/api/v1/contract/depth/PUMPBTC_USDT');
            const data = await response.json();
        
            if (!data?.data?.bids?.[0]?.[0]) throw new Error('Invalid MEXC response');
            
            return {
                bid: parseFloat(data.data.bids[0][0]),
                ask: parseFloat(data.data.asks[0][0])
            };
        } catch (error) {
            console.error('MEXC Error:', error);
            return null;
        }
    }
  
    // Fetch KyberSwap prices
    async function fetchKyberSwapPrice(inputToken, outputToken, amount) {
        try {
            const amountIn = amount.toLocaleString('fullwide', { useGrouping: false });
            const response = await fetch(
                `https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${inputToken}&tokenOut=${outputToken}&amountIn=${amountIn}`
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            return data.data?.routeSummary?.amountOut || data.data?.outAmount;
        } catch (error) {
            console.error('KyberSwap Error:', error);
            return null;
        }
    }

    // Corrected price calculation
    async function fetchKyberPrice() {
        const addresses = {
            USDT: '0x55d398326f99059fF775485246999027B3197955',
            PUMPBTC: '0xb7c0007ab75350c582d5eab1862b872b5cf53f0c'
        };

        try {
            const [buyAmount, sellAmount] = await Promise.all([
                fetchKyberSwapPrice(addresses.USDT, addresses.PUMPBTC, 598 * 1e18),
                fetchKyberSwapPrice(addresses.PUMPBTC, addresses.USDT, 8498 * 1e18)
            ]);

            return {
                buyPrice: buyAmount ? 598 / (buyAmount / 1e18) : null,
                sellPrice: sellAmount ? (sellAmount / 1e18) / 8498 : null
            };
        } catch (error) {
            console.error('Price Calculation Error:', error);
            return null;
        }
    }

    // Updated alert calculation and display
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('pumpbtc-buy-alert'),
            sell: document.getElementById('pumpbtc-sell-alert')
        };

        try {
            const [mexcData, kyberData] = await Promise.all([
                fetchMexcPrice(),
                fetchKyberPrice()
            ]);

            if (!mexcData || !kyberData) {
                elements.buy.textContent = elements.sell.textContent = 'Error';
                return;
            }

            // Formatting functions
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(5);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(5);

            // Format prices
            const kyberBuy = formatPrice(kyberData.buyPrice);
            const kyberSell = formatPrice(kyberData.sellPrice);
            const mexcBid = formatPrice(mexcData.bid);
            const mexcAsk = formatPrice(mexcData.ask);

            // Calculate differences
            const buyDiff = mexcData.bid - kyberData.buyPrice;
            const sellDiff = kyberData.sellPrice - mexcData.ask;

            // Update display with price comparison
            elements.buy.innerHTML = `$${kyberBuy} - $${mexcBid} `
                + `<span class="difference">$${formatDiff(buyDiff)}</span>`;
            
            elements.sell.innerHTML = `$${kyberSell} - $${mexcAsk} `
                + `<span class="difference">$${formatDiff(sellDiff)}</span>`;

            // Apply styles to difference spans
            applyAlertStyles(elements.buy.querySelector('.difference'), buyDiff);
            applyAlertStyles(elements.sell.querySelector('.difference'), sellDiff);
            
        } catch (error) {
            console.error('Update Error:', error);
            elements.buy.innerHTML = elements.sell.innerHTML = 'Error';
        }
    }

// Updated alert styling function for PUMPBTC
function applyAlertStyles(element, value) {
    element.className = '';
    let shouldPlaySound = false;
    const isBuyAlert = element.parentElement.id === 'pumpbtc-buy-alert';

    if (isBuyAlert) {
        // Buy alert conditions
        if (value > 0.00035) {
            element.classList.add('alert-flashing-2');
            shouldPlaySound = true;
        } else if (value > 0.00025) {
            element.classList.add('alert-flashing-1');
            shouldPlaySound = true;
        } else if (value > 0.00015) {
            element.classList.add('alert-large-green');
        } else if (value > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add('alert-negative');
        }
    } else {
        // Sell alert conditions
        if (value > 0.00035) {
            element.classList.add('alert-flashing-2');
            shouldPlaySound = true;
        } else if (value > 0.00025) {
            element.classList.add('alert-flashing-1');
        } else if (value > 0.00015) {
            element.classList.add('alert-large-green');
        } else if (value > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add('alert-negative');
        }
    }

    if (shouldPlaySound && audioEnabled) {
        playAlertSound();
    }
}

    // Initialize application
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 4400);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();
  
    return { updateAlerts };
})();