const RDAC = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
  
    // Create and manage audio enable button
    function handleAudioInitialization() {
        // Create floating enable button
        enableButton = document.createElement('button');
        enableButton.id = 'audio-enable-btn';
        enableButton.innerHTML = '🔇 Click to Enable Alert Sounds';
        enableButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 10000;
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
  
        document.body.appendChild(enableButton);
    }
  
  // Modified playSystemAlert function
  function playSystemAlert() {
    if (!audioEnabled || !audioContext) return;
  
    try {
        // Create two oscillators for a pleasant chime
        const primaryOsc = audioContext.createOscillator();
        const secondaryOsc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
  
        // Connect nodes
        primaryOsc.connect(gainNode);
        secondaryOsc.connect(gainNode);
        gainNode.connect(audioContext.destination);
  
        // Configure chime sound
        primaryOsc.type = 'triangle';
        secondaryOsc.type = 'sine';
        primaryOsc.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5 note
        secondaryOsc.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5 note
  
        // Create volume envelope
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
  
        // Start/stop oscillators
        primaryOsc.start();
        secondaryOsc.start();
        primaryOsc.stop(audioContext.currentTime + 0.8);
        secondaryOsc.stop(audioContext.currentTime + 0.8);
  
    } catch (error) {
        console.log('Sound playback error:', error);
    }
  }
  
  // Keep the rest of the code the same as previous version
  
    // Fetch MEXC prices
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const response = await fetch(proxyUrl + 'https://contract.mexc.com/api/v1/contract/depth/RDAC_USDT');
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
  
    // Calculate Kyber prices
    async function fetchKyberPrice() {
        const addresses = {
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            RDAC: '0xD3F68c6e8AeE820569D58AdF8d85d94489315192'
        };

        try {
            const [buyAmount, sellAmount] = await Promise.all([
                // Correct USDC decimals (6 instead of 18)
                fetchKyberSwapPrice(addresses.USDC, addresses.RDAC, 529 * 1e6), // Changed 1e18 → 1e6
                fetchKyberSwapPrice(addresses.RDAC, addresses.USDC, 11998 * 1e18)
            ]);
        
            return {
                buyPrice: buyAmount ? 529 / (buyAmount / 1e18) : null,
                sellPrice: sellAmount ? (sellAmount / 1e6) / 11998 : null // Changed 1e18 → 1e6 (USDC decimals)
            };
        } catch (error) {
            console.error('Price Calculation Error:', error);
            return null;
        }
    }
  
    // Update alert displays
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('rdac-buy-alert'),
            sell: document.getElementById('rdac-sell-alert')
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
        
            const differences = {
                buy: (mexcData.bid - kyberData.buyPrice).toFixed(5),
                sell: (kyberData.sellPrice - mexcData.ask).toFixed(5)
            };
        
            elements.buy.textContent = differences.buy;
            elements.sell.textContent = differences.sell;
            
            applyAlertStyles(elements.buy, parseFloat(differences.buy));
            applyAlertStyles(elements.sell, parseFloat(differences.sell));
            
        } catch (error) {
            console.error('Update Error:', error);
            elements.buy.textContent = elements.sell.textContent = 'Error';
        }
    }
  
    // Apply visual and audio alerts
    function applyAlertStyles(element, value) {
      element.className = '';
      let shouldPlaySound = false;
  
      // Visual styling logic
      if (value > 0.04) {
          element.classList.add('alert-flashing-2');
          shouldPlaySound = true;
      } else if (value > 0.02) {
          element.classList.add('alert-flashing-1');
          shouldPlaySound = true;
      } else if (value > 0.01) {
          element.classList.add('alert-large-green');
      } else if (value > 0) {
          element.classList.add('alert-positive');
      } else {
          element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
      }
  
      // Trigger sound only for positive flashing alerts
      if (shouldPlaySound && audioEnabled) {
          playSystemAlert();
      }
  }
  
  // Modified playSystemAlert function (pleasant chime version)
  function playSystemAlert() {
      if (!audioContext || audioContext.state !== 'running') return;
  
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