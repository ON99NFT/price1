const KILO = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'kilo-audio-enable-btn';
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
                if (audioContext.skiloe === 'suspended') {
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
  
        const section = document.getElementById('kilo-buy-alert').closest('.token-section');
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
  
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/KILO_USDT';
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
            
            const calculateBidPrice = (bids, targetKILO) => {
                let totalKILO = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of bids) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const pweaseAvailable = usdtAvailable / price;
                    const remaining = targetKILO - totalKILO;
                    const fillAmount = Math.min(remaining, pweaseAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalKILO += fillAmount;
                    
                    if (totalKILO >= targetKILO) break;
                }
                return totalUSDT / targetKILO;
            };
    
            const calculateAskPrice = (asks, targetKILO) => {
                let totalKILO = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of asks) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const pweaseAvailable = usdtAvailable / price;
                    const remaining = targetKILO - totalKILO;
                    const fillAmount = Math.min(remaining, pweaseAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalKILO += fillAmount;
                    
                    if (totalKILO >= targetKILO) break;
                }
                return totalUSDT / targetKILO;
            };
    
            const targetFullsend = 8999;
            const bidPrice = calculateBidPrice(data.data.bids, targetFullsend);
            const askPrice = calculateAskPrice(data.data.asks, targetFullsend);
    
            if (!bidPrice || !askPrice) throw new Error('Insufficient liquidity');
            
            return {
                bid: bidPrice,
                ask: askPrice
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
            
            if (!response.ok) throw new Error(`HTTP ${response.skilous}`);
            const data = await response.json();
            
            return data.data?.routeSummary?.amountOut || data.data?.outAmount;
        } catch (error) {
            console.error('KyberSwap Error:', error);
            return null;
        }
    }

    // Corrected price calculation
// In fetchKyberPrice function, change to:
async function fetchKyberPrice() {
    const addresses = {
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        KILO: '0x503Fa24B7972677F00C4618e5FBe237780C1df53'
    };

    // Always use full amounts regardless of liquidity
    const sellAmountKILO = 8999;
    const buyAmountUSDT = 1099;

    try {
        const [buyAmount, sellAmount] = await Promise.all([
            fetchKyberSwapPrice(addresses.USDT, addresses.KILO, buyAmountUSDT * 1e18),
            fetchKyberSwapPrice(addresses.KILO, addresses.USDT, sellAmountKILO * 1e18)
        ]);

        return {
            buyPrice: buyAmount ? buyAmountUSDT / (buyAmount / 1e18) : null,
            sellPrice: sellAmount ? (sellAmount / 1e18) / sellAmountKILO : null
        };
    } catch (error) {
        console.error('Price Calculation Error:', error);
        return null;
    }
}

    // Updated alert calculation and display
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('kilo-buy-alert'),
            sell: document.getElementById('kilo-sell-alert')
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
// Calculate differences
const buyDiff = mexcData.bid - kyberData.buyPrice; // MEXC Bid vs Kyber Buy Price
const sellDiff = kyberData.sellPrice - mexcData.ask; // Kyber Sell vs MEXC Ask

            // Update display with price comparison
            elements.buy.innerHTML = `$${mexcBid} - $${kyberBuy} ` + 
            `<span class="difference">$${formatDiff(buyDiff)}</span>`;
        
        elements.sell.innerHTML = `$${kyberSell} - $${mexcAsk} ` + 
            `<span class="difference">$${formatDiff(sellDiff)}</span>`;

            // Apply styles to difference spans
            applyAlertStyles(elements.buy.querySelector('.difference'), buyDiff);
            applyAlertStyles(elements.sell.querySelector('.difference'), sellDiff);
            
        } catch (error) {
            console.error('Update Error:', error);
            elements.buy.innerHTML = elements.sell.innerHTML = 'Error';
        }
    }

// Modified alert styling function with separate sell alert thresholds
function applyAlertStyles(element, value) {
    element.className = '';
    let shouldPlaySound = false;
    const isSellAlert = element.parentElement.id === 'kilo-sell-alert';

    if (isSellAlert) {
        // New sell alert thresholds
        if (value >= 0.01) {
            element.classList.add('alert-flashing-2');
        } else if (value >= 0.005) {
            element.classList.add('alert-flashing-1');
        } else if (value >= 0.001) {
            element.classList.add('alert-large-green');
        } else {
            element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
        }
    } else {
        // Original buy alert thresholds
        if (value > 0.005) {
            element.classList.add('alert-flashing-2');
            shouldPlaySound = true;
        } else if (value > 0.002) {
            element.classList.add('alert-flashing-1');
            shouldPlaySound = true;
        } else if (value > 0.001) {
            element.classList.add('alert-large-green');
        } else if (value > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
        }
    }

    // Trigger sound only for positive buy alerts
    if (shouldPlaySound && audioEnabled && !isSellAlert) {
        playSystemAlert();
    }
}

    // Initialize application
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 2500);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();
  
    return { updateAlerts };
})();