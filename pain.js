const pain = (() => {
  let audioContext = null;
  let audioEnabled = false;
  let enableButton = null;

  // Audio initialization
  function handleAudioInitialization() {
      enableButton = document.createElement('button');
      enableButton.id = 'pain-audio-enable-btn';
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
              }, 1900);
          } catch (error) {
              console.error('Audio initialization failed:', error);
              enableButton.innerHTML = '❌ Error';
              enableButton.style.background = '#f44336';
          }
      });

      const section = document.getElementById('pain-buy-alert').closest('.token-section');
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

          osc.type = 'square';
          osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

          osc.start();
          osc.stop(audioContext.currentTime + 0.3);
      } catch (error) {
          console.log('Sound playback error:', error);
      }
  }

  // JUP swap function
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
          console.error('Error fetching JUP swap price:', error);
          return null;
      }
  }

  // MEXC price fetch
  async function fetchMexcPrice() {
      try {
          const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
          const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/PAIN_USDT';
          const response = await fetch(proxyUrl + apiUrl);
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

  // JUP price calculation
  async function fetchJupPrice() {
      const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const outputMintpain = '1Qf8gESP4i6CFNWerUSDdLKJ9U1LpqTYvjJ2MM4pain';
  
      const [painAmount, usdcAmount] = await Promise.all([
          fetchJupSwapPrice(inputMintUSDC, outputMintpain, 900 * 1e6, 6),
          fetchJupSwapPrice(outputMintpain, inputMintUSDC, 100 * 1e6, 6)
      ]);
  
      if (!painAmount || !usdcAmount) return null;
  
      return {
          rateFor900USDC: 900 / painAmount,
          rateFor100pain: usdcAmount / 100
      };
  }

  // Alert update
  async function updateAlerts() {
      const buyElement = document.getElementById('pain-buy-alert');
      const sellElement = document.getElementById('pain-sell-alert');
  
      try {
          const [mexcData, jupData] = await Promise.all([
              fetchMexcPrice(),
              fetchJupPrice()
          ]);
  
          if (!mexcData || !jupData) {
              buyElement.textContent = sellElement.textContent = 'Error';
              return;
          }
  
          const buyDiff = (mexcData.bid - jupData.rateFor900USDC).toFixed(5);
          const sellDiff = (jupData.rateFor100pain - mexcData.ask).toFixed(5);
  
          buyElement.textContent = buyDiff;
          sellElement.textContent = sellDiff;
  
          applyAlertStyles(buyElement, parseFloat(buyDiff));
          applyAlertStyles(sellElement, parseFloat(sellDiff));
      } catch (error) {
          console.error('Update error:', error);
          buyElement.textContent = sellElement.textContent = 'Error';
      }
  }

  // Alert styling
  function applyAlertStyles(element, difference) {
      element.classList.remove(
          'alert-positive', 'alert-negative',
          'alert-flashing-1', 'alert-flashing-2',
          'alert-large-green'
      );
      element.style.fontSize = '';
      
      let playSound = false;
      if (difference > 0.4) {
          element.classList.add('alert-flashing-2');
          playSound = true;
      } else if (difference > 0.2) {
          element.classList.add('alert-flashing-1');
          playSound = true;
      } else if (difference > 0.1) {
          element.classList.add('alert-large-green');
      } else if (difference > 0) {
          element.classList.add('alert-positive');
      } else {
          element.classList.add('alert-negative');
      }

      if (playSound && audioEnabled && element.id === 'pain-buy-alert') {
          playAlertSound();
      }
  }

  // Initialization
  (function init() {
      updateAlerts();
      setInterval(updateAlerts, 4700);
      setTimeout(() => {
          if (!audioEnabled && !enableButton) handleAudioInitialization();
      }, 9000);
  })();

  return { updateAlerts };
})();