const fullsend = (() => {
  let audioContext = null;
  let audioEnabled = false;
  let enableButton = null;

  // Audio initialization
  function handleAudioInitialization() {
      enableButton = document.createElement('button');
      enableButton.id = 'fullsend-audio-enable-btn';
      enableButton.innerHTML = '🔇 Enable Alert Sounds';
      enableButton.style.cssText = `
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 8px 15px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          z-index: 100;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
      `;

      enableButton.addEventListener('mouseover', () => {
          enableButton.style.transform = 'scale(1.03)';
          enableButton.style.background = '#45a049';
      });
      
      enableButton.addEventListener('mouseout', () => {
          enableButton.style.transform = 'scale(1)';
          enableButton.style.background = '#4CAF50';
      });

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
              }, 1500);
          } catch (error) {
              console.error('Audio initialization failed:', error);
              enableButton.innerHTML = '❌ Error';
              enableButton.style.background = '#f44336';
          }
      });

      const section = document.getElementById('fullsend-buy-alert').closest('.token-section');
      section.appendChild(enableButton);
  }

  // Sound alert function
  function playAlertSound() {
      if (!audioEnabled || !audioContext) return;

      try {
          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioContext.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5 note
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

          osc.start();
          osc.stop(audioContext.currentTime + 0.4);
      } catch (error) {
          console.log('Sound playback error:', error);
      }
  }

  // Updated JUP swap function with ExactOut support
  async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals, exactOut = false) {
    try {
        let url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
        if (exactOut) url += '&swapMode=ExactOut';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`JUP API error: ${response.status}`);
        
        const data = await response.json();
        return exactOut 
            ? data.inAmount / 10 ** decimals  // USDC needed for ExactOut
            : data.outAmount / 10 ** decimals; // FULLSEND received for ExactIn
    } catch (error) {
        console.error('JUP Error:', error);
        return null;
    }
}

async function fetchMexcPrice() {
    try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/FULLSEND_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
        
        const calculateBidPrice = (bids, targetFULLSEND) => {
            let totalFULLSEND = 0;
            let totalUSDT = 0;
            
            for (const [priceStr, usdtAvailableStr] of bids) {
                const price = parseFloat(priceStr);
                const usdtAvailable = parseFloat(usdtAvailableStr);
                const fullsendAvailable = usdtAvailable / price;
                const remaining = targetFULLSEND - totalFULLSEND;
                const fillAmount = Math.min(remaining, fullsendAvailable);
                
                totalUSDT += fillAmount * price;
                totalFULLSEND += fillAmount;
                
                if (totalFULLSEND >= targetFULLSEND) break;
            }
            return totalUSDT / targetFULLSEND;
        };

        const calculateAskPrice = (asks, targetFULLSEND) => {
            let totalFULLSEND = 0;
            let totalUSDT = 0;
            
            for (const [priceStr, usdtAvailableStr] of asks) {
                const price = parseFloat(priceStr);
                const usdtAvailable = parseFloat(usdtAvailableStr);
                const fullsendAvailable = usdtAvailable / price;
                const remaining = targetFULLSEND - totalFULLSEND;
                const fillAmount = Math.min(remaining, fullsendAvailable);
                
                totalUSDT += fillAmount * price;
                totalFULLSEND += fillAmount;
                
                if (totalFULLSEND >= targetFULLSEND) break;
            }
            return totalUSDT / targetFULLSEND;
        };

        const targetFullsend = 49999;
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

// Updated JUP price calculation
async function fetchJupPrice() {
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const FULLSEND_MINT = 'AshG5mHt4y4etsjhKFb2wA2rq1XZxKks1EPzcuXwpump';
    const FULLSEND_DECIMALS = 6;

    // Get USDC needed to buy 49999 FULLSEND
    const usdcNeeded = await fetchJupSwapPrice(
        USDC_MINT,
        FULLSEND_MINT,
        49999 * 10 ** FULLSEND_DECIMALS,
        6,
        true
    );

    // Get USDC received for selling 49999 FULLSEND
    const usdcReceived = await fetchJupSwapPrice(
        FULLSEND_MINT,
        USDC_MINT,
        49999 * 10 ** FULLSEND_DECIMALS,
        6
    );

    if (!usdcNeeded || !usdcReceived) return null;

    return {
        buyPrice: usdcNeeded / 49999,  // USDC per FULLSEND (buy)
        sellPrice: usdcReceived / 49999 // USDC per FULLSEND (sell)
    };
}

// Updated alert display
async function updateAlerts() {
    const buyElement = document.getElementById('fullsend-buy-alert');
    const sellElement = document.getElementById('fullsend-sell-alert');

    try {
        const [mexcData, jupData] = await Promise.all([
            fetchMexcPrice(),
            fetchJupPrice()
        ]);

        if (!mexcData || !jupData) {
            buyElement.textContent = sellElement.textContent = 'Error';
            return;
        }

        // Format prices
        const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);
        const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);

        const jupBuy = formatPrice(jupData.buyPrice);
        const jupSell = formatPrice(jupData.sellPrice);
        const mexcBid = formatPrice(mexcData.bid);
        const mexcAsk = formatPrice(mexcData.ask);

        // Calculate differences
        const buyDiff = formatDiff(mexcData.bid - jupData.buyPrice);
        const sellDiff = formatDiff(jupData.sellPrice - mexcData.ask);

        // Update display
        buyElement.innerHTML = `$${jupBuy} - `
            + `$${mexcBid}`
            + `<span class="difference">$${buyDiff}</span>`;

        sellElement.innerHTML = `$${jupSell} - `
            + `$${mexcAsk}`
            + `<span class="difference">$${sellDiff}</span>`;

        // Apply styles to difference elements
        applyAlertStyles(buyElement.querySelector('.difference'), parseFloat(buyDiff));
        applyAlertStyles(sellElement.querySelector('.difference'), parseFloat(sellDiff));

    } catch (error) {
        console.error('Update error:', error);
        buyElement.textContent = sellElement.textContent = 'Error';
    }
}

// Updated alert styling
function applyAlertStyles(element, difference) {
    element.classList.remove(
        'alert-positive', 'alert-negative',
        'alert-flashing-1', 'alert-flashing-2',
        'alert-flashing-negative-1', 'alert-flashing-negative-2',
        'alert-large-green'
    );
    
    let playSound = false;
    if (difference > 0.0008) {
        element.classList.add('alert-flashing-2');
        playSound = true;
    } else if (difference > 0.0004) {
        element.classList.add('alert-flashing-1');
        playSound = true;
    } else if (difference > 0.0002) {
        element.classList.add('alert-large-green');
    } else if (difference > 0) {
        element.classList.add('alert-positive');
    } else {
        element.classList.add('alert-negative');
        if (difference < -0.0008) {
            element.classList.add('alert-flashing-negative-2');
            playSound = false;
        }
    }

    if (playSound && audioEnabled) {
        playAlertSound();
    }
}

  // Initialize
  (function init() {
      updateAlerts();
      setInterval(updateAlerts, 7000);
      setTimeout(() => {
          if (!audioEnabled && !enableButton) handleAudioInitialization();
      }, 5000);
  })();

  return { updateAlerts };
})();