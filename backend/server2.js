require('dotenv').config();  
const express = require('express');  
const axios = require('axios');  

const app = express();  
const PORT = 3000;  
const SERPAPI_KEY = process.env.SERPAPI_KEY; // Store API key in .env file  

app.get('/search', async (req, res) => {  
    try {  
        const query = req.query.q; // Get product name from query parameter  
        if (!query) return res.status(400).json({ error: "Product name is required" });  

        const response = await axios.get('https://serpapi.com/search', {  
            params: {  
                engine: 'google_shopping',  
                q: query,  
                api_key: SERPAPI_KEY  
            }  
        });  

        res.json(response.data);  
    } catch (error) {  
        res.status(500).json({ error: error.message });  
    }  
});  

app.listen(PORT, () => {  
    console.log(`Server running on http://localhost:${PORT}`);  
});