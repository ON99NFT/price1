const EUR = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;

    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'eur-audio-enable-btn';
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

        const section = document.getElementById('eur-buy-alert').closest('.token-section');
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

    // Fetch Forex.com EUR/USD price
    async function fetchForexPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const forexUrl = 'https://www.forex.com/uk/market-analysis/latest-news/eurusd/';
            
            const response = await fetch(proxyUrl + encodeURIComponent(forexUrl));
            const html = await response.text();
            
            // Parse HTML to find EUR/USD price
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // This selector might need adjustment if Forex.com changes their layout
            const priceElement = doc.querySelector('.chart-price');
            if (!priceElement) throw new Error('Price element not found');
            
            const priceText = priceElement.textContent.trim();
            const price = parseFloat(priceText);
            
            if (isNaN(price)) throw new Error('Invalid price format');
            
            // Return bid/ask as the same since we only get one price
            return {
                bid: price,
                ask: price
            };
        } catch (error) {
            console.error('Forex Error:', error);
            return null;
        }
    }

    // Fetch KyberSwap prices
    async function fetchKyberSwapPrice(inputToken, outputToken, amount) {
        try {
            const amountIn = amount.toLocaleString('fullwide', { useGrouping: false });
            const response = await fetch(
                `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${inputToken}&tokenOut=${outputToken}&amountIn=${amountIn}`
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
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            EUR: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42' // Use EUR token address
        };

        try {
            const [buyAmount, sellAmount] = await Promise.all([
                fetchKyberSwapPrice(addresses.USDC, addresses.EUR, 26998 * 1e6),
                fetchKyberSwapPrice(addresses.EUR, addresses.USDC, 30698 * 1e6)
            ]);

            return {
                buyPrice: buyAmount ? 26998 / (buyAmount / 1e6) : null,
                sellPrice: sellAmount ? (sellAmount / 1e6) / 30698 : null
            };
        } catch (error) {
            console.error('Price Calculation Error:', error);
            return null;
        }
    }

    // Updated alert calculation and display
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('eur-buy-alert'),
            sell: document.getElementById('eur-sell-alert')
        };

        try {
            const [forexData, kyberData] = await Promise.all([
                fetchForexPrice(),
                fetchKyberPrice()
            ]);

            if (!forexData || !kyberData) {
                elements.buy.textContent = elements.sell.textContent = 'Error';
                return;
            }

            // Formatting functions
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);

            // Format prices
            const kyberBuy = formatPrice(kyberData.buyPrice);
            const kyberSell = formatPrice(kyberData.sellPrice);
            const forexPrice = formatPrice(forexData.bid); // Using bid for display

            // Calculate differences
            const buyDiff = kyberData.buyPrice - forexData.bid;
            const sellDiff = kyberData.sellPrice - forexData.ask;

            // Update display with price comparison
            elements.buy.innerHTML = `$${kyberBuy} - $${forexPrice} `
                + `<span class="difference">$${formatDiff(buyDiff)}</span>`;
            
            elements.sell.innerHTML = `$${kyberSell} - $${forexPrice} `
                + `<span class="difference">$${formatDiff(sellDiff)}</span>`;

            // Apply styles to difference spans
            applyAlertStyles(elements.buy.querySelector('.difference'), buyDiff);
            applyAlertStyles(elements.sell.querySelector('.difference'), sellDiff);
            
        } catch (error) {
            console.error('Update Error:', error);
            elements.buy.innerHTML = elements.sell.innerHTML = 'Error';
        }
    }

    function applyAlertStyles(element, value) {
        element.className = '';
        let shouldPlaySound = false;
        const isBuyAlert = element.parentElement.id === 'eur-buy-alert';

        if (isBuyAlert) {
            // Buy alert conditions
            if (value >= 0.0005) {
                element.classList.add('alert-large-green');
            } else if (value >= 0.0001) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
            } else if (value >= -0.0003) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
            } else if (value >= -0.0005) {
                element.classList.add('alert-large-green');
            } else {
                element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
            }
        } else {
            // Sell alert conditions
            if (value > 0.0018) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
            } else if (value > 0.0014) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
            } else if (value > 0.001) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else if (value > -0.0004) {
                element.classList.add('alert-flashing-1');      
            } else if (value > -0.0008) {
                element.classList.add('alert-flashing-2'); 
            } else {
                element.classList.add('alert-negative');
            }
        }

        if (shouldPlaySound && audioEnabled) {
            playSystemAlert();
        }
    }

    // Initialize application
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 2550);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();

    return { updateAlerts };
})();