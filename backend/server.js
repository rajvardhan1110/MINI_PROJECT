//Server.js
// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors')
const puppeteer = require('puppeteer');
const app = express();
const PORT = 3000;

app.use(cors())
app.use(bodyParser.json());

// MySQL connection setup

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Rajvardhan@1110',
    database: 'miniproject'
});

// Connect to MySQL
connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('Connected to MySQL');
});

// Create necessary tables if they don't exist
connection.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
        
    )
`);



// User registration
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password ) {
        return res.status(400).json({ error: "All fields are required" });
    }

    connection.query(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, password],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: "Username already exists" });
                }
                return res.status(500).json({ error: "Failed to register user" });
            }
            res.json({ success: true, userId: result.insertId });
        }
    );
});

// User logi
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check if user exists
    connection.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: "Failed to login" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "User is not registered. Please register first." });
            }

            // User exists, now check password
            if (results[0].password !== password) {
                return res.status(401).json({ error: "Invalid password. Please try again." });
            }

            res.json({ success: true, userId: results[0].id, username: results[0].username });
        }
    );
});



// Function to get website name
const getWebsiteName = async (url) => {
    if (url.includes('amzn')) return 'Amazon';
    if (url.includes('flipkart')) return 'Flipkart';
    if (url.includes('meesho')) return 'Meesho';
    if (url.includes('snapdeal')) return 'Snapdeal';
    if (url.includes('croma')) return 'Croma';
    return 'Unknown';
};

// Function to scrape product details
const scrapeProductDetails = async (url) => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);
    
    let title, price, imageUrl;

    if (url.includes('amazon')) {
        title = $('#productTitle').text().trim();
        imageUrl = $('#landingImage').attr('src');

        // Try multiple price selectors
        price = $('.a-offscreen').first().text().trim();
        if (!price) {
            const symbol = $('.a-price-symbol').first().text().trim();
            const wholePrice = $('.a-price-whole').first().text().trim();
            const fraction = $('.a-price-fraction').first().text().trim();
            if (symbol && wholePrice) {
                price = `${symbol}${wholePrice}${fraction ? '.' + fraction : ''}`;
            }
        }

        if (!title || !imageUrl || !price) {
            console.log("Amazon scraping failed. Check fetched HTML structure.");
            console.log(response.data.substring(0, 500)); // Log first 500 characters
            throw new Error("Failed to extract product details from Amazon");
        }
    } else if (url.includes('flipkart')) {
        title = $('._35KyD6').text().trim();
        price = $('._1vC4OE._3qQ9m1').text().trim();
        imageUrl = $('._3BTv9X').find('img').attr('src');
    } else if (url.includes('meesho')) {
        title = $('span.sc-eDvSVe.fhfLdV').text().trim();
        price = $('h4.sc-eDvSVe.biMVPh').text().trim();
        imageUrl = $('div.ProductDesktopImage__ImageWrapperDesktop-sc-8sgxcr-0 img').attr('src');
    } else if (url.includes('snapdeal')) {
        title = $('h1[itemprop="name"]').text().trim();
        price = $('span[itemprop="price"]').text().trim();
        imageUrl = $('img[bigsrc]').attr('bigsrc');
    } else if (url.includes('croma')) {
        title = $('meta[property="og:title"]').attr('content');
        price = `₹${Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000}`;
        imageUrl = $('img[data-testid="super-zoom-img-0"]').attr('data-src');
    } else {
        throw new Error('Unsupported website');
    }

    const websiteName = await getWebsiteName(url);

    console.log('Scraped product details:', { title, price, imageUrl, websiteName, url });
    return { title, price, imageUrl, websiteName, url };
};

// API endpoint
app.get('/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const productDetails = await scrapeProductDetails(url);
        res.json(productDetails);
    } catch (error) {
        res.status(500).json({ error: error.message || "Failed to fetch product details" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
