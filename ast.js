const KYBER_PROXY = 'https://api.allorigins.win/raw?url=';
// 
// // Audio context handling
let audioContext = null;
let audioEnabled = false;

const audioPrompt = document.createElement('div');
audioPrompt.style.position = 'fixed';
audioPrompt.style.top = '10px';
audioPrompt.style.right = '10px';
audioPrompt.style.background = '#ffcc00';
audioPrompt.style.color = 'black';
audioPrompt.style.padding = '10px';
audioPrompt.style.borderRadius = '5px';
audioPrompt.style.cursor = 'pointer';
audioPrompt.textContent = 'Click here to enable sound alerts!';
document.body.appendChild(audioPrompt);

audioPrompt.addEventListener('click', function initAudio() {
  if (audioContext) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    audioEnabled = true;
    console.log('Audio system ready');
    audioPrompt.style.display = 'none';
  } catch (error) {
    console.error('Audio initialization failed:', error);
    audioPrompt.textContent = 'Sound initialization failed';
  }
}, { once: true });

// Token configurations
const tokens = {
  tst: {
    type: 'kyber',
    mexcApiUrl: 'https://contract.mexc.com/api/v1/contract/depth/TST_USDT',
    kyberConfig: {
      buySwap: {
        tokenIn: '0x55d398326f99059fF775485246999027B3197955', // USDT
        tokenOut: '0x86Bb94DdD16Efc8bc58e6b056e8df71D9e666429', // TST
        amount: 2000 * 1e18
      },
      sellSwap: {
        tokenIn: '0x86Bb94DdD16Efc8bc58e6b056e8df71D9e666429', // TST
        tokenOut: '0x55d398326f99059fF775485246999027B3197955', // USDT
        amount: 13000 * 1e18
      }
    },
    elements: {
      buy: document.getElementById('tst-buy-alert'),
      sell: document.getElementById('tst-sell-alert')
    },
    thresholds: {
      positive: [0.03, 0.06, 0.09],
      negative: [-0.03, -0.06, -0.09]
    }
  },
  alpha: {
    type: 'jup',
    mexcApiUrl: 'https://contract.mexc.com/api/v1/contract/depth/ALPHAOFSOL_USDT',
    jupConfig: {
      inputMintUSDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      outputMint: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
      buySwap: { amount: 120, decimals: 6 },
      sellSwap: { amount: 12000, decimals: 6 }
    },
    elements: {
      buy: document.getElementById('alpha-buy-alert'),
      sell: document.getElementById('alpha-sell-alert')
    },
    thresholds: {
      positive: [0.0004, 0.0008, 0.0012],
      negative: [-0.0004, -0.0008, -0.0012]
    }
  },
  stonks: {
    type: 'jup',
    mexcApiUrl: 'https://contract.mexc.com/api/v1/contract/depth/STONKS_USDT',
    jupConfig: {
      inputMintUSDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      outputMint: '6NcdiK8B5KK2DzKvzvCfqi8EHaEqu48fyEzC8Mm9pump',
      buySwap: { amount: 400, decimals: 6 },
      sellSwap: { amount: 8500, decimals: 6 }
    },
    elements: {
      buy: document.getElementById('stonks-buy-alert'),
      sell: document.getElementById('stonks-sell-alert')
    },
    thresholds: {
      positive: [0.0005, 0.001, 0.0015],
      negative: [-0.0005, -0.001, -0.0015]
    }
  }
};

// Unified fetch functions
async function fetchMexcPrice(apiUrl) {
  try {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const response = await fetch(proxyUrl + apiUrl);
    const data = await response.json();
    
    if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
      throw new Error('Invalid MEXC response');
    }
    
    return {
      bid: parseFloat(data.data.bids[0][0]),
      ask: parseFloat(data.data.asks[0][0])
    };
  } catch (error) {
    console.error(`MEXC Error (${apiUrl}):`, error);
    return null;
  }
}

async function fetchKyberSwapPrice(tokenIn, tokenOut, amountIn) {
    try {
      const amount = amountIn.toLocaleString('fullwide', { useGrouping: false });
      const apiUrl = `https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amount}`;
      const response = await fetch(KYBER_PROXY + encodeURIComponent(apiUrl));
      
      if (!response.ok) throw new Error(`Kyber API Error: ${response.status}`);
      
      const data = await response.json();
      return data.data?.routeSummary?.amountOut || data.data?.outAmount;
    } catch (error) {
      console.error('KyberSwap Error:', error);
      return null;
    }
  }

async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`JUP API Error: ${response.status}`);
    
    const data = await response.json();
    return data.outAmount / 10 ** decimals;
  } catch (error) {
    console.error('JUP Swap Error:', error);
    return null;
  }
}

// Unified price fetcher
async function fetchTokenPrices(tokenConfig) {
    try {
      const mexcPrices = await fetchMexcPrice(tokenConfig.mexcApiUrl);
      if (!mexcPrices) return null;
  
      if (tokenConfig.type === 'kyber') {
        const [buyAmount, sellAmount] = await Promise.all([
          fetchKyberSwapPrice(
            tokenConfig.kyberConfig.buySwap.tokenIn,
            tokenConfig.kyberConfig.buySwap.tokenOut,
            tokenConfig.kyberConfig.buySwap.amount
          ),
          fetchKyberSwapPrice(
            tokenConfig.kyberConfig.sellSwap.tokenIn,
            tokenConfig.kyberConfig.sellSwap.tokenOut,
            tokenConfig.kyberConfig.sellSwap.amount
          )
        ]);
  
        if (!buyAmount || !sellAmount) return null;
  
        // Corrected calculations
        return {
            buyRate: 2000 / (buyAmount / 1e18), // USDT per TST
            sellRate: (sellAmount / 1e18) / 13000, // USDT per TST
            mexcBid: mexcPrices.bid,
            mexcAsk: mexcPrices.ask
          };
        }

    if (tokenConfig.type === 'jup') {
      const [jupBuy, jupSell] = await Promise.all([
        fetchJupSwapPrice(
          tokenConfig.jupConfig.inputMintUSDC,
          tokenConfig.jupConfig.outputMint,
          tokenConfig.jupConfig.buySwap.amount * 10 ** 6,
          tokenConfig.jupConfig.buySwap.decimals
        ),
        fetchJupSwapPrice(
          tokenConfig.jupConfig.outputMint,
          tokenConfig.jupConfig.inputMintUSDC,
          tokenConfig.jupConfig.sellSwap.amount * 10 ** tokenConfig.jupConfig.sellSwap.decimals,
          6
        )
      ]);

      if (!jupBuy || !jupSell) return null;

      return {
        buyRate: tokenConfig.jupConfig.buySwap.amount / jupBuy,
        sellRate: jupSell / tokenConfig.jupConfig.sellSwap.amount,
        mexcBid: mexcPrices.bid,
        mexcAsk: mexcPrices.ask
      };
    }
  } catch (error) {
    console.error(`Price fetch error (${tokenConfig.type}):`, error);
    return null;
  }
}

// Style and sound handling
function playSound() {
  // ... (keep the same playSound function from as.html) ...
}

function handleSoundTrigger(element) {
  // ... (keep the same handleSoundTrigger function from as.html) ...
}

function applyAlertStyles(element, value, tokenKey) {
  element.className = '';
  const config = tokens[tokenKey];
  const isPositive = value > 0;
  const absValue = Math.abs(value);

  const positiveThresholds = config.thresholds.positive;
  const negativeThresholds = config.thresholds.negative.map(t => Math.abs(t));

  if (isPositive) {
    if (absValue >= positiveThresholds[2]) {
      element.classList.add('alert-flashing-2');
    } else if (absValue >= positiveThresholds[1]) {
      element.classList.add('alert-flashing-1');
    } else if (absValue >= positiveThresholds[0]) {
      element.classList.add('alert-large-green');
    } else {
      element.classList.add('alert-positive');
    }
  } else {
    if (absValue >= negativeThresholds[2]) {
      element.classList.add('alert-flashing-negative-2');
    } else if (absValue >= negativeThresholds[1]) {
      element.classList.add('alert-flashing-negative-1');
    } else if (absValue >= negativeThresholds[0]) {
      element.classList.add('alert-large-red');
    } else {
      element.classList.add('alert-negative');
    }
  }

  handleSoundTrigger(element);
}

// Update functions
async function updateTokenAlerts(tokenKey) {
  const config = tokens[tokenKey];
  try {
    const prices = await fetchTokenPrices(config);
    
    if (!prices) {
      config.elements.buy.textContent = 'Error';
      config.elements.sell.textContent = 'Error';
      return;
    }

    const buyDiff = (prices.mexcBid - prices.buyRate).toFixed(5);
    const sellDiff = (prices.sellRate - prices.mexcAsk).toFixed(5);

    config.elements.buy.textContent = buyDiff;
    config.elements.sell.textContent = sellDiff;

    applyAlertStyles(config.elements.buy, parseFloat(buyDiff), tokenKey);
    applyAlertStyles(config.elements.sell, parseFloat(sellDiff), tokenKey);
  } catch (error) {
    console.error(`Update error (${tokenKey}):`, error);
    config.elements.buy.textContent = 'Error';
    config.elements.sell.textContent = 'Error';
  }
}

function updateAllAlerts() {
  updateTokenAlerts('tst');
  updateTokenAlerts('alpha');
  updateTokenAlerts('stonks');
}

// Initialize
updateAllAlerts();
setInterval(updateAllAlerts, 5000);