require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Add simple request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home route
app.get('/', (req, res) => {
  res.send(`
    <h1>Walmart Product Search API</h1>
    <p>Use the /search endpoint with a query parameter:</p>
    <a href="/search?q=laptop">Example: /search?q=laptop</a>
    <p>This uses the built-in Node.js APIs without requiring additional packages like Puppeteer</p>
  `);
});

async function scrapeWalmart(query) {
  console.log(`Searching for: ${query}`);
  
  try {
    // Using the free Walmart Search API (limited features, but no API key needed)
    const url = `https://www.walmart.com/search/api/preso?q=${encodeURIComponent(query)}&page=1&prg=desktop`;
    
    // Enhanced headers to appear more browser-like
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    console.log(`Requesting: ${url}`);
    const response = await axios.get(url, { 
      headers,
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024 // 10MB max
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (!response.data || !response.data.items) {
      console.error('Unexpected response format from Walmart API');
      return [];
    }
    
    console.log(`Found ${response.data.items.length} items in response`);
    
    // Transform the response to our desired format
    const products = response.data.items.map(item => {
      // Handle potential null or undefined values
      const product = item.productDataShaped || {};
      const price = product.priceInfo || {};
      const image = (product.imageInfo && product.imageInfo.thumbnailUrl) || '';
      
      return {
        product_name: product.productName || product.name || 'Unknown Product',
        price: price.currentPrice ? `$${price.currentPrice}` : 'Price not available',
        website_link: product.canonicalUrl ? 
          `https://www.walmart.com${product.canonicalUrl}` : 
          `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
        image: image,
        source: 'Walmart'
      };
    }).filter(product => 
      // Only include products with valid names and prices
      product.product_name !== 'Unknown Product' && 
      product.price !== 'Price not available'
    );
    
    console.log(`Returning ${products.length} formatted products`);
    return products;
  } catch (error) {
    console.error('Error fetching from Walmart API:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
    }
    
    // Alternative simple scraping approach with HTML response parsing as fallback
    try {
      console.log('Trying alternative HTML scraping method...');
      const htmlUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
      
      const htmlResponse = await axios.get(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 30000
      });
      
      // Very simple regex-based extraction as last resort
      const html = htmlResponse.data;
      
      // Extract product data using regex patterns
      const products = [];
      
      // Pattern for product data in JSON format (found in script tags)
      const scriptRegex = /<script[^>]*>\s*window\.__PRELOADED_STATE__\s*=\s*({.*?})\s*;<\/script>/s;
      const scriptMatch = html.match(scriptRegex);
      
      if (scriptMatch && scriptMatch[1]) {
        try {
          // Clean the JSON string (it might have invalid JS)
          const cleanJson = scriptMatch[1]
            .replace(/undefined/g, 'null')
            .replace(/\bNaN\b/g, 'null');
          
          const data = JSON.parse(cleanJson);
          
          // Navigate to product data if available
          if (data && data.search && data.search.searchResult && data.search.searchResult.itemStacks) {
            const items = [];
            
            // Collect items from all stacks
            data.search.searchResult.itemStacks.forEach(stack => {
              if (stack.items) {
                items.push(...stack.items);
              }
            });
            
            // Transform items to our format
            items.forEach(item => {
              if (item.name && item.price) {
                products.push({
                  product_name: item.name,
                  price: item.price.priceString || `$${item.price.currentPrice}`,
                  website_link: item.canonicalUrl ? 
                    `https://www.walmart.com${item.canonicalUrl}` : 
                    htmlUrl,
                  image: item.imageUrl || '',
                  source: 'Walmart'
                });
              }
            });
            
            console.log(`Extracted ${products.length} products from embedded JSON`);
          }
        } catch (e) {
          console.error('Error parsing embedded JSON:', e.message);
        }
      }
      
      // If we still have no products, try simple regex
      if (products.length === 0) {
        // Simple pattern matching for product titles and prices
        const productMatches = html.matchAll(/<div[^>]*data-item-id[^>]*>[\s\S]*?<\/div>/g);
        for (const match of productMatches) {
          const productHtml = match[0];
          const titleMatch = productHtml.match(/<span[^>]*>(.*?)<\/span>/);
          const priceMatch = productHtml.match(/\$(\d+\.\d{2})/);
          
          if (titleMatch && priceMatch) {
            products.push({
              product_name: titleMatch[1],
              price: `$${priceMatch[1]}`,
              website_link: htmlUrl,
              image: '',
              source: 'Walmart (Basic)'
            });
          }
        }
        
        console.log(`Extracted ${products.length} products using regex fallback`);
      }
      
      return products;
    } catch (fallbackError) {
      console.error('Fallback scraping also failed:', fallbackError.message);
      return [];
    }
  }
}

// Search endpoint
app.get('/search', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query) {
    return res.status(400).json({ 
      error: "Product name is required",
      example: "/search?q=laptop" 
    });
  }
  
  try {
    console.log(`Processing search for: ${query}`);
    const results = await scrapeWalmart(query);
    
    if (results.length === 0) {
      console.warn('No products found - Walmart may be blocking automated access');
      
      // Return mock data for demonstration (remove in production)
      const mockResults = [
        {
          product_name: "HP 15.6\" FHD Laptop, Intel Core i5-1135G7, 8GB RAM, 256GB SSD, Silver",
          price: "$379.00",
          website_link: "https://www.walmart.com/ip/HP-15-6-FHD-Laptop-Intel-Core-i5-1135G7-8GB-RAM-256GB-SSD-Silver/123456789",
          image: "https://i5.walmartimages.com/asr/sample.jpg",
          source: "Walmart (Demo Data)"
        },
        {
          product_name: "Lenovo IdeaPad 3i 15.6\" FHD Touch Screen Laptop, Intel Core i3-1115G4, 8GB RAM, 256GB SSD",
          price: "$329.00",
          website_link: "https://www.walmart.com/ip/Lenovo-IdeaPad-3i-15-6-FHD-Touch-Screen-Laptop-Intel-Core-i3-1115G4-8GB-RAM-256GB-SSD/987654321",
          image: "https://i5.walmartimages.com/asr/sample2.jpg",
          source: "Walmart (Demo Data)"
        }
      ];
      
      return res.json({
        query,
        count: mockResults.length,
        status: 'demo_data',
        message: 'Showing demo data. Walmart may be blocking automated access.',
        results: mockResults
      });
    }
    
    res.json({
      query,
      count: results.length,
      status: 'success',
      results
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch products",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🛒 Walmart Product Search API running on http://localhost:${PORT}`);
  console.log(`🔍 Try: http://localhost:${PORT}/search?q=laptop`);
  console.log('⚠️  This uses built-in Node.js functionality without requiring Puppeteer');
});