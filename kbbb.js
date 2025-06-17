const kbbb = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;

    // Audio initialization
    function handleAudioInitialization() {
        enableButton = document.createElement('button');
        enableButton.id = 'kbbb-audio-enable-btn';
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

        const section = document.getElementById('kbbb-buy-alert').closest('.token-section');
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

// MEXC price fetch with orderbook average
async function fetchMexcPrice() {
    try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/KBBB_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
        
        const calculateBidPrice = (bids, targetKBBB) => {
            let totalKBBB = 0;
            let totalUSDT = 0;
            
            for (const [priceStr, usdtAvailableStr] of bids) {
                const price = parseFloat(priceStr);
                const usdtAvailable = parseFloat(usdtAvailableStr);
                const kbbbAvailable = usdtAvailable / price;
                const remaining = targetKBBB - totalKBBB;
                const fillAmount = Math.min(remaining, kbbbAvailable);
                
                totalUSDT += fillAmount * price;
                totalKBBB += fillAmount;
                
                if (totalKBBB >= targetKBBB) break;
            }
            if (totalKBBB < targetKBBB) throw new Error('Insufficient bid liquidity');
            return totalUSDT / targetKBBB;
        };

        const calculateAskPrice = (asks, targetKBBB) => {
            let totalKBBB = 0;
            let totalUSDT = 0;
            
            for (const [priceStr, usdtAvailableStr] of asks) {
                const price = parseFloat(priceStr);
                const usdtAvailable = parseFloat(usdtAvailableStr);
                const kbbbAvailable = usdtAvailable / price;
                const remaining = targetKBBB - totalKBBB;
                const fillAmount = Math.min(remaining, kbbbAvailable);
                
                totalUSDT += fillAmount * price;
                totalKBBB += fillAmount;
                
                if (totalKBBB >= targetKBBB) break;
            }
            if (totalKBBB < targetKBBB) throw new Error('Insufficient ask liquidity');
            return totalUSDT / targetKBBB;
        };

        const targetKBBB = 676498; // Matches JUP's sell amount
        const bidPrice = calculateBidPrice(data.data.bids, targetKBBB);
        const askPrice = calculateAskPrice(data.data.asks, targetKBBB);

        return {
            bid: bidPrice,
            ask: askPrice
        };
    } catch (error) {
        console.error('MEXC Error:', error);
        return null;
    }
}

    // JUP price calculation
    async function fetchJupPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintkbbb = 'npB9cxTzwUiGt7jk2dXZa52xZve8SgVD6Et9Bpipump';
    
        const [kbbbAmount, usdcAmount] = await Promise.all([
            fetchJupSwapPrice(inputMintUSDC, outputMintkbbb, 298 * 1e6, 6),
            fetchJupSwapPrice(outputMintkbbb, inputMintUSDC, 676498 * 1e6, 6)
        ]);
    
        return {
            buyPrice: kbbbAmount ? 298 / kbbbAmount : null,
            sellPrice: usdcAmount ? usdcAmount / 676498 : null
        };
    }

    // Alert update
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('kbbb-buy-alert'),
            sell: document.getElementById('kbbb-sell-alert')
        };

        try {
            const [mexcData, jupData] = await Promise.all([
                fetchMexcPrice(),
                fetchJupPrice()
            ]);

            if (!mexcData || !jupData) {
                elements.buy.textContent = elements.sell.textContent = 'Error';
                return;
            }

            // Formatting functions
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(7);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(7);

            // Format prices
            const jupBuy = formatPrice(jupData.buyPrice);
            const jupSell = formatPrice(jupData.sellPrice);
            const mexcBid = formatPrice(mexcData.bid);
            const mexcAsk = formatPrice(mexcData.ask);

            // Calculate differences
            const buyDiff = mexcData.bid - jupData.buyPrice;
            const sellDiff = jupData.sellPrice - mexcData.ask;

            // Update kbbbplay with price comparison
            elements.buy.innerHTML = `$${jupBuy} - $${mexcBid} `
                + `<span class="difference">$${formatDiff(buyDiff)}</span>`;
            
            elements.sell.innerHTML = `$${jupSell} - $${mexcAsk} `
                + `<span class="difference">$${formatDiff(sellDiff)}</span>`;

            // Apply styles to difference spans
            applyAlertStyles(elements.buy.querySelector('.difference'), buyDiff);
            applyAlertStyles(elements.sell.querySelector('.difference'), sellDiff);
            
        } catch (error) {
            console.error('Update error:', error);
            elements.buy.innerHTML = elements.sell.innerHTML = 'Error';
        }
    }

    // Alert styling
    // Modified alert styling function
    function applyAlertStyles(element, value) {
        element.className = '';
        let shouldPlaySound = false;
    
        if (value > 0.00001) {
            element.classList.add('alert-flashing-2');
            shouldPlaySound = true;
        } else if (value > 0.000006) {
            element.classList.add('alert-flashing-1');
            shouldPlaySound = true;
        } else if (value > 0.000003) {
            element.classList.add('alert-large-green');
        } else if (value > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add('alert-negative');
        }
    
        // Trigger sound only for positive buy alerts
        if (shouldPlaySound && audioEnabled && element.parentElement.id === 'kbbb-buy-alert') {
            playAlertSound();
        }
    }


    // Initialization
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 3800);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();

    return { updateAlerts };
})();