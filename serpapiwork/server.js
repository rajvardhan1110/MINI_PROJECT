require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

app.use(cors());

// Approved e-commerce sites (Prioritizing Indian sites, with some global ones)
const APPROVED_SITES = {
    amazon: 'Amazon',
    flipkart: 'Flipkart',
    meesho: 'Meesho',
    snapdeal: 'Snapdeal',
    walmart: 'Walmart',
    reliancedigital: 'Reliance Digital',
    ajio: 'AJIO',
    tatacliq: 'Tata Cliq',
    myntra: 'Myntra',
    shopclues: 'ShopClues',
    croma: 'Croma',
    nykaa: 'Nykaa',
    firstcry: 'FirstCry',
    paytmmall: 'Paytm Mall',    
    pepperfry: 'Pepperfry',
    bigbasket: 'BigBasket',
    jiomart: 'JioMart',
    blinkit: 'Blinkit',
    purplle: 'Purplle',
    lifestylestores: 'Lifestyle Stores',
    decathlon: 'Decathlon',
    indiamart: 'IndiaMART',
    ebay: 'eBay',
    aliexpress: 'AliExpress',
    bestbuy: 'BestBuy',
    homeshop18: 'HomeShop18',
    reliancetrends: 'Reliance Trends',
    fabindia: 'FabIndia',
    maxfashion: 'Max Fashion',
    healthkart: 'HealthKart',
    lenskart: 'Lenskart',
    bewakoof: 'Bewakoof',
    chumbak: 'Chumbak',
    tata1mg: 'Tata 1MG',
    pharmeasy: 'PharmEasy',
    apple: 'Apple Store'
};

app.get('/search', async (req, res) => {
    const { q: query } = req.query;
    
    if (!query) {
        return res.status(400).json({
            error: "Please provide a search query",
            example: "/search?q=laptop"
        });
    }
    
    try {
        const serpApiResponse = await fetchSerpApiResults(query);
        const filteredResults = filterApprovedProducts(serpApiResponse);
        res.json({ results: filteredResults });
    } catch (error) {
        console.error("Search Error:", error.message);
        res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
});

/**
 * Fetch search results from SerpAPI.
 */
async function fetchSerpApiResults(query) {
    const response = await axios.get('https://serpapi.com/search', {
        params: {
            engine: 'google_shopping',
            q: query,
            api_key: SERPAPI_KEY,
            gl: 'IN',
            hl: 'en'
        }
    });
    return (response.data && response.data.shopping_results) ? response.data.shopping_results : [];
}

/**
 * Filters products from approved e-commerce sites.
 */
function filterApprovedProducts(products) {
    return products
        .filter(product => product.title && product.source)
        .map(product => {
            const merchant = getApprovedMerchant(product.source);
            return merchant ? {
                product_name: product.title,
                price: product.price || "Price not available",
                website_link: product.link,
                image: product.thumbnail || "No image available",
                rating: product.rating || "No rating available", // Added rating
                description: product.description || "No description available", // Added description
                source: merchant
            } : null;
        })
        .filter(product => product);
}

/**
 * Checks if a product source is from an approved site.
 */
function getApprovedMerchant(source) {
    const src = source.toLowerCase();
    return Object.keys(APPROVED_SITES).find(key => src.includes(key)) ? APPROVED_SITES[src] : null;
}

app.listen(PORT, () => {
    console.log(`🔍 Product Search API running on http://localhost:${PORT}`);
});