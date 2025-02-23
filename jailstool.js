const jailstool = (() => {
  let audioContext = null;
  let audioEnabled = false;
  let enableButton = null;

  // Audio initialization
  function handleAudioInitialization() {
      enableButton = document.createElement('button');
      enableButton.id = 'jailstool-audio-enable-btn';
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
              }, 1751);
          } catch (error) {
              console.error('Audio initialization failed:', error);
              enableButton.innerHTML = '❌ Error';
              enableButton.style.background = '#f44336';
          }
      });

      const section = document.getElementById('jailstool-buy-alert').closest('.token-section');
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

  // Function to fetch MEXC bid-ask prices
  async function fetchMexcPrice() {
      try {
          const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
          const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/JAILSTOOL_USDT';
          const response = await fetch(proxyUrl + apiUrl);
          const data = await response.json();
      
          if (!data || !data.data || !data.data.bids || !data.data.asks) {
              throw new Error('Invalid MEXC API response');
          }
      
          const bestBid = parseFloat(data.data.bids[0][0]);
          const bestAsk = parseFloat(data.data.asks[0][0]);
      
          return { bid: bestBid, ask: bestAsk };
      } catch (error) {
          console.error('Error fetching MEXC prices:', error);
          return null;
      }
  }

  // Function to fetch JUP swap price
  async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
      try {
          const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
          const response = await fetch(url);
      
          if (!response.ok) {
              throw new Error(`JUP API error: ${response.status}`);
          }
      
          const data = await response.json();
          return data.outAmount / 10 ** decimals;
      } catch (error) {
          console.error('JUP swap error:', error);
          return null;
      }
  }

  // Fetch JUP prices
  async function fetchJupPrice() {
      const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const outputMintjailstool = 'AxriehR6Xw3adzHopnvMn7GcpRFcD41ddpiTWMg6pump';
  
      const [jailstoolAmountFor751USDC, usdcAmountFor49999jailstool] = await Promise.all([
          fetchJupSwapPrice(inputMintUSDC, outputMintjailstool, 751 * 1e6, 6),
          fetchJupSwapPrice(outputMintjailstool, inputMintUSDC, 49999 * 1e6, 6),
      ]);
  
      if (!jailstoolAmountFor751USDC || !usdcAmountFor49999jailstool) return null;
  
      return {
          rateFor751USDC: 751 / jailstoolAmountFor751USDC,
          rateFor49999jailstool: usdcAmountFor49999jailstool / 49999
      };
  }

  // Update alerts
  async function updateAlerts() {
      const buyElement = document.getElementById('jailstool-buy-alert');
      const sellElement = document.getElementById('jailstool-sell-alert');
  
      try {
          const [mexcData, jupData] = await Promise.all([
              fetchMexcPrice(),
              fetchJupPrice()
          ]);
  
          if (!mexcData || !jupData) {
              buyElement.textContent = sellElement.textContent = 'Error';
              return;
          }
  
          const buyDiff = mexcData.bid - jupData.rateFor751USDC;
          const sellDiff = jupData.rateFor49999jailstool - mexcData.ask;
  
          buyElement.textContent = buyDiff.toFixed(5);
          sellElement.textContent = sellDiff.toFixed(5);
  
          applyAlertStyles(buyElement, buyDiff);
          applyAlertStyles(sellElement, sellDiff);
      } catch (error) {
          console.error('Update error:', error);
          buyElement.textContent = sellElement.textContent = 'Error';
      }
  }

  // In applyAlertStyles function - modified section
  function applyAlertStyles(element, difference) {
    element.classList.remove(
        'alert-positive', 'alert-negative',
        'alert-flashing-1', 'alert-flashing-2',
        'alert-flashing-negative-1', 'alert-flashing-negative-2',
        'alert-large-green'
    );
    element.style.fontSize = '';
    
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
        
        // New condition for negative buy alerts
        if (element.id === 'jailstool-buy-alert' && difference < -0.0003) {
            element.classList.add('alert-flashing-negative-2');
            playSound = true;
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
      }, 7510);
  })();

  return { updateAlerts };
})();