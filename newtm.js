const NEWTM = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'newtm-audio-enable-btn';
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
  
        const section = document.getElementById('newtm-buy-alert').closest('.token-section');
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
  
    // Fetch MEXC contract prices (futures)
    async function fetchMexcContractPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const response = await fetch(proxyUrl + 'https://contract.mexc.com/api/v1/contract/depth/NEWT_USDT');
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

// Updated spot price function using order book
async function fetchMexcSpotPrice() {
    try {
        // Direct API call for spot order book
        const response = await fetch('https://api.mexc.com/api/v3/depth?symbol=NEWTUSDT&limit=5', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Extract best bid and ask from order book
        const bestBid = data.bids?.[0]?.[0]; // Highest bid price
        const bestAsk = data.asks?.[0]?.[0]; // Lowest ask price
        
        if (!bestBid || !bestAsk) throw new Error('Invalid MEXC Spot order book');
        
        return {
            bid: parseFloat(bestBid),
            ask: parseFloat(bestAsk),
            mid: (parseFloat(bestBid) + parseFloat(bestAsk)) / 2 // Mid price for reference
        };
    } catch (error) {
        console.error('MEXC Spot Error:', error);
        // Fallback to proxy if needed
        try {
            const proxyResponse = await fetch('https://api.codetabs.com/v1/proxy/?quest=https://api.mexc.com/api/v3/depth?symbol=NEWTUSDT&limit=5');
            const proxyData = await proxyResponse.json();
            const bestBid = proxyData.bids?.[0]?.[0];
            const bestAsk = proxyData.asks?.[0]?.[0];
            if (!bestBid || !bestAsk) throw new Error('Fallback proxy spot order book invalid');
            return {
                bid: parseFloat(bestBid),
                ask: parseFloat(bestAsk),
                mid: (parseFloat(bestBid) + parseFloat(bestAsk)) / 2
            };
        } catch (fallbackError) {
            console.error('Fallback proxy failed:', fallbackError);
            return null;
        }
    }
}

async function updateAlerts() {
    const elements = {
        buy: document.getElementById('newtm-buy-alert'),
        sell: document.getElementById('newtm-sell-alert')
    };

    try {
        const [contractData, spotData] = await Promise.all([
            fetchMexcContractPrice(),
            fetchMexcSpotPrice()
        ]);

        if (!contractData || !spotData) {
            elements.buy.textContent = elements.sell.textContent = 'Error';
            return;
        }

        // Formatting functions
        const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);
        const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);

        // Calculate differences - now using actual bid/ask prices
        const buyDiff = contractData.bid - spotData.ask; // Can buy on spot at ask, sell on contract at bid
        const sellDiff = spotData.bid - contractData.ask; // Can buy on contract at ask, sell on spot at bid

        // Update display with accurate price comparison
        elements.buy.innerHTML = `Spot Ask: $${formatPrice(spotData.ask)} - Contract Bid: $${formatPrice(contractData.bid)} `
            + `<span class="difference">$${formatDiff(buyDiff)}</span>`;
        
        elements.sell.innerHTML = `Spot Bid: $${formatPrice(spotData.bid)} - Contract Ask: $${formatPrice(contractData.ask)} `
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
        const isBuyAlert = element.parentElement.id === 'newtm-buy-alert';

        if (isBuyAlert) {
            // Buy alert conditions
            if (value > 0.04) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.2; // Normal volume
            } else if (value > 0.03) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > 0.02) {
                element.classList.add('alert-large-green');
            } else {
                element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
            }
        } else {
            // Sell alert conditions
            if (value > 0.01) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.2; // Normal volume
            } else if (value > -0.01) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > -0.015) {
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
        setInterval(updateAlerts, 2500);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();
  
    return { updateAlerts };
})();