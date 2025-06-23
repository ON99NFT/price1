const BOMB = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'bomb-audio-enable-btn';
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
            pointer-events: auto !important;
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
  
        const section = document.getElementById('bomb-buy-alert').closest('.token-section');
        section.appendChild(enableButton);
    }
  
    // Audio playback function with volume control
    async function playSystemAlert(volume = 0.2) {
        if (!audioEnabled || !audioContext) return;
        
        try {
            // Check context state
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            const primaryOsc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            primaryOsc.connect(gainNode);
            gainNode.connect(audioContext.destination);
    
            // Pleasant chime configuration
            primaryOsc.type = 'sine';
            primaryOsc.frequency.setValueAtTime(784.0, audioContext.currentTime); // G5 note
            
            // Apply volume parameter - SIMPLIFIED APPROACH
            gainNode.gain.value = volume;
            
            primaryOsc.start();
            primaryOsc.stop(audioContext.currentTime + 0.2); // Short beep
            
        } catch (error) {
            console.error('Sound playback failed:', error);
            // Show error on button if exists
            if (enableButton) {
                enableButton.innerHTML = '❌ Sound Error';
                enableButton.style.background = '#f44336';
            }
        }
    }
  
    // Fetch MEXC prices
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const response = await fetch(proxyUrl + 'https://contract.mexc.com/api/v1/contract/depth/BOMB_USDT');
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

    // Price calculation
    async function fetchKyberPrice() {
        const addresses = {
            USDT: '0x55d398326f99059fF775485246999027B3197955',
            BOMB: '0x7e975D85714B11d862C7cFFEe3C88d565a139Eb7'
        };

        try {
            const [buyAmount, sellAmount] = await Promise.all([
                fetchKyberSwapPrice(addresses.USDT, addresses.BOMB, 598 * 1e18),
                fetchKyberSwapPrice(addresses.BOMB, addresses.USDT, 599998 * 1e18)
            ]);

            return {
                buyPrice: buyAmount ? 598 / (buyAmount / 1e18) : null,
                sellPrice: sellAmount ? (sellAmount / 1e18) / 599998 : null
            };
        } catch (error) {
            console.error('Price Calculation Error:', error);
            return null;
        }
    }

    // Alert calculation and display
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('bomb-buy-alert'),
            sell: document.getElementById('bomb-sell-alert')
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
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(6);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(6);

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

    // Alert styling function
    function applyAlertStyles(element, value) {
        element.className = '';
        let shouldPlaySound = false;
        let volume = 0.2; // Default volume
        const isBuyAlert = element.parentElement.id === 'bomb-buy-alert';

        if (isBuyAlert) {
            // Buy alert conditions
            if (value > 0.00002) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.2; // Normal volume
            } else if (value > 0.0000) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > -0.00001) {
                element.classList.add('alert-large-green');
            } else {
                element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
            }
        } else {
            // Sell alert conditions
            if (value > 0.00015) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.2; // Normal volume
            } else if (value > 0.0001) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > 0.00005) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else {
                element.classList.add('alert-negative');
            }
        }

        if (shouldPlaySound && audioEnabled) {
            playSystemAlert(volume);
        }
    }

    // Initialize application
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 3800);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();
  
    return { updateAlerts };
})();