import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------- CORS CONFIGURATION -------------------
app.use(
  cors({
    origin: [
      'https://yogireddy.myshopify.com',
      'https://admin.shopify.com',
      /\.shopifypreview\.com$/,
      'https://nextprint.in',
      'https://www.nextprint.in' // Add this!
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://nextprint.in;"
  );
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ------------------- AI IMAGE GENERATION -------------------
app.post('/api/generate-image', async (req, res) => {
  const { prompt = '' } = req.body;

  try {
    const response = await axios.post(
      'https://api.freepik.com/v1/ai/text-to-image',
      {
        prompt,
        num_images: 4,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024,
        steps: 50,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Freepik-API-Key': process.env.FREEPIK_API_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Generation error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// ------------------- BUY AI IMAGE (CREATE PRODUCT + CHECKOUT) -------------------
app.post('/api/buy-ai-image', async (req, res) => {
  try {
    const { imageBase64, size, quantity } = req.body;

    // STEP 1: Upload image directly when creating a product
    const productRes = await axios.post(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-04/products.json`,
      {
        product: {
          title: `AI Custom Jersey - ${size}`,
          body_html: 'AI generated jersey design',
          images: [
            { attachment: imageBase64 } // base64 upload
          ],
          variants: [
            {
              option1: size,
              price: '499.00',
              inventory_management: 'shopify',
              inventory_quantity: quantity || 10, 
              requires_shipping: true
            }
          ],
          options: [{ name: 'Size' }]
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const product = productRes.data.product;
    const variantId = product.variants[0].id;

    // STEP 2: Create a checkout URL
    const checkoutUrl = `https://${process.env.SHOPIFY_STORE}/cart/${variantId}:${quantity}`;
    return res.json({ checkoutUrl });

  } catch (err) {
    console.error('Buy AI Image Error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to process AI image purchase.' });
  }
});

// ------------------- SERVE AI.HTML -------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai.html'));
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
