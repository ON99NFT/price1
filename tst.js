// Function to fetch MEXC bid-ask prices for TST_USDT
async function fetchMexcPrice() {
    try {
      const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
      const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/TST_USDT';
      const response = await fetch(proxyUrl + apiUrl);
      const data = await response.json();
  
      if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
        throw new Error('Invalid MEXC API response');
      }
  
      return {
        bid: parseFloat(data.data.bids[0][0]),
        ask: parseFloat(data.data.asks[0][0])
      };
    } catch (error) {
      console.error('MEXC Error:', error);
      return null;
    }
  }
  
  // Function to fetch KyberSwap price
  async function fetchKyberSwapPrice(inputToken, outputToken, amount) {
    try {
      const amountIn = amount.toLocaleString('fullwide', { useGrouping: false });
      const url = `https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${inputToken}&tokenOut=${outputToken}&amountIn=${amountIn}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API ${response.status}: ${errorData?.message || 'Unknown error'}`);
      }
  
      const data = await response.json();
      // Updated response structure handling
      return data.data?.routeSummary?.amountOut || data.data?.outAmount;
    } catch (error) {
      console.error('KyberSwap Error:', error);
      return null;
    }
  }
  
  // Main price calculation function
  // Function to fetch KyberSwap prices for TST
async function fetchKyberPrice() {
    const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BNB USDT
    const TST_ADDRESS = '0x86Bb94DdD16Efc8bc58e6b056e8df71D9e666429'; // TST Contract
  
    try {
      const [tstAmount, usdtAmount] = await Promise.all([
        // Changed to 2000 USDT -> TST
        fetchKyberSwapPrice(USDT_ADDRESS, TST_ADDRESS, 2000 * 1e18), 
        // Changed to 13000 TST -> USDT
        fetchKyberSwapPrice(TST_ADDRESS, USDT_ADDRESS, 13000 * 1e18) 
      ]);
  
      if (!tstAmount || !usdtAmount) return null;
  
      return {
        // Updated calculation for 2000 USDT
        buyPrice: 2000 / (tstAmount / 1e18), // USDT per TST
        // Updated calculation for 13000 TST
        sellPrice: (usdtAmount / 1e18) / 13000 // USDT per TST
      };
    } catch (error) {
      console.error('Price Calculation Error:', error);
      return null;
    }
  }
  
  // Alert update function
  async function updateAlerts() {
    const buyAlert = document.getElementById('buy-alert');
    const sellAlert = document.getElementById('sell-alert');
  
    try {
      const [mexcData, kyberData] = await Promise.all([
        fetchMexcPrice(),
        fetchKyberPrice()
      ]);
  
      if (!mexcData || !kyberData) {
        buyAlert.textContent = sellAlert.textContent = 'Error';
        return;
      }
  
      // Calculate differences
      const buyDifference = (mexcData.bid - kyberData.buyPrice).toFixed(5);
      const sellDifference = (kyberData.sellPrice - mexcData.ask).toFixed(5);
  
      // Update displays
      buyAlert.textContent = buyDifference;
      sellAlert.textContent = sellDifference;
      
      // Apply styles
      applyAlertStyles(buyAlert, parseFloat(buyDifference));
      applyAlertStyles(sellAlert, parseFloat(sellDifference));
      
    } catch (error) {
      console.error('Update Error:', error);
      buyAlert.textContent = sellAlert.textContent = 'Error';
    }
  }
  
  // Style application function
  function applyAlertStyles(element, value) {
    element.className = ''; // Reset classes
    if (value > 0.09) {
      element.classList.add('alert-flashing-2');
    } else if (value > 0.06) {
      element.classList.add('alert-flashing-1');
    } else if (value > 0.03) {
      element.classList.add('alert-large-green');
    } else if (value > 0) {
      element.classList.add('alert-positive');
    } else if (value < -0.09) {
      element.classList.add('alert-flashing-negative-2');
    } else if (value < -0.06) {
      element.classList.add('alert-flashing-negative-1');
    } else if (value < -0.03) {
      element.classList.add('alert-large-red');
    } else {
      element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
    }
  }
  
  // Initialize and update every 5 seconds
  (function init() {
    updateAlerts();
    setInterval(updateAlerts, 2000);
  })();
