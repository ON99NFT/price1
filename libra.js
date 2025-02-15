const libra = (() => {
    // Function to fetch MEXC bid-ask prices for libra
    async function fetchMexcPrice() {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/LIBRA_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
    
        if (!data || !data.data || !data.data.bids || !data.data.asks) {
          throw new Error('Invalid MEXC API response');
        }
    
        // Extract the best bid and ask prices
        const bestBid = parseFloat(data.data.bids[0][0]);
        const bestAsk = parseFloat(data.data.asks[0][0]);
    
        return { bid: bestBid, ask: bestAsk };
      } catch (error) {
        console.error('Error fetching MEXC bid-ask prices:', error);
        return null;
      }
    }
  
    // Function to fetch JUP price for a given swap
    async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
      try {
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
        const response = await fetch(url);
    
        if (!response.ok) {
          throw new Error(`JUP API error: ${response.status} ${response.statusText}`);
        }
    
        const data = await response.json();
        return data.outAmount / 10 ** decimals;
      } catch (error) {
        console.error('Error fetching JUP swap price:', error);
        return null;
      }
    }
  
    // Function to fetch JUP prices for libra
    async function fetchJupPrice() {
      const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const outputMintlibra = 'Bo9jh3wsmcC2AjakLWzNmKJ3SgtZmXEcSaW7L2FAvUsU';
  
      const [libraAmountFor1200USDC, usdcAmountFor6000libra] = await Promise.all([
        fetchJupSwapPrice(inputMintUSDC, outputMintlibra, 1200 * 1e6, 6),
        fetchJupSwapPrice(outputMintlibra, inputMintUSDC, 6000 * 1e6, 6),
      ]);
    
      if (libraAmountFor1200USDC === null || usdcAmountFor6000libra === null) {
        return null;
      }
    
      // Calculate rates
      const jupRateFor1200USDC = 1200 / libraAmountFor1200USDC;
      const jupRateFor6000libra = usdcAmountFor6000libra / 6000;
    
      return {
        rateFor1200USDC: jupRateFor1200USDC,
        rateFor6000libra: jupRateFor6000libra,
      };
    }
  
    // Function to update alerts
    async function updateAlerts() {
      const buyAlertElement = document.getElementById('libra-buy-alert');
      const sellAlertElement = document.getElementById('libra-sell-alert');
    
      const mexcPrices = await fetchMexcPrice();
      const jupPrices = await fetchJupPrice();
    
      if (mexcPrices !== null && jupPrices !== null) {
        const buyDifference = mexcPrices.bid - jupPrices.rateFor1200USDC;
        buyAlertElement.textContent = buyDifference.toFixed(5);
        applyAlertStyles(buyAlertElement, buyDifference);
    
        const sellDifference = jupPrices.rateFor6000libra - mexcPrices.ask;
        sellAlertElement.textContent = sellDifference.toFixed(5);
        applyAlertStyles(sellAlertElement, sellDifference);
      } else {
        buyAlertElement.textContent = 'Error';
        sellAlertElement.textContent = 'Error';
      }
    }
  
    // Style application function
    function applyAlertStyles(element, difference) {
      element.classList.remove(
        'alert-positive', 'alert-negative',
        'alert-flashing-1', 'alert-flashing-2',
        'alert-flashing-negative-1', 'alert-flashing-negative-2',
        'alert-large', 'alert-large-green', 'alert-large-red'
      );
      element.style.fontSize = '';
      element.style.backgroundColor = '';
      element.style.color = '';
  
      if (difference > 0.03) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-2');
      } else if (difference > 0.02) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-1');
      } else if (difference > 0.01) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-large', 'alert-large-green');
      } else if (difference > 0) {
        element.classList.add('alert-positive');
      } else if (difference < -0.03) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-negative-2');
      } else if (difference < -0.02) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-negative-1');
      } else if (difference < -0.01) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-large', 'alert-large-red');
      } else if (difference < 0) {
        element.classList.add('alert-negative');
      }
    }
  
    // Initialize
    (function init() {
      updateAlerts();
      setInterval(updateAlerts, 4700);
    })();
  
    return { updateAlerts };
  })();