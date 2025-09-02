import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');
const PORT = process.env.PORT || 5000;

// MIME types mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Function to parse JSON body
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const cleanUrl = parsedUrl.pathname;
  
  console.log(`[${req.method}] ${cleanUrl}`);
  
  // Handle API requests by importing and executing the Vercel functions
  if (cleanUrl.startsWith('/api/')) {
    console.log('Handling API request:', cleanUrl);
    try {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parse request body for POST requests
      if (req.method === 'POST') {
        req.body = await parseBody(req);
      }

      // Add Express-like methods to response object
      res.status = (code) => {
        res.statusCode = code;
        return {
          json: (data) => {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return res; // Return response object for chaining
          },
          end: (data) => {
            res.writeHead(code);
            res.end(data);
            return res; // Return response object for chaining
          }
        };
      };
      
      // Add json method directly to response
      res.json = (data) => {
        res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return res;
      };

      let handler;
      // Route to appropriate API function
      if (cleanUrl === '/api/certificates') {
        const module = await import('../api/certificates/index.js');
        handler = module.default;
      } else if (cleanUrl.startsWith('/api/certificates/lookup/')) {
        const number = cleanUrl.split('/').pop();
        req.query = { number };
        const module = await import('../api/certificates/lookup/[number].js');
        handler = module.default;
      } else if (cleanUrl === '/api/auth/login') {
        const module = await import('../api/auth/login.js');
        handler = module.default;
      } else if (cleanUrl === '/api/setup/database') {
        const module = await import('../api/setup/database.js');
        handler = module.default;
      }

      if (handler) {
        console.log('Executing handler for:', cleanUrl);
        await handler(req, res);
        return;
      } else {
        console.log('No handler found for API route:', cleanUrl);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
        return;
      }
    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
      return;
    }
  }
  
  // Handle static files
  let filePath = path.join(publicDir, cleanUrl === '/' ? 'index.html' : cleanUrl);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist, serve index.html for client-side routing
      filePath = path.join(publicDir, 'index.html');
    }
    
    // Get file extension and content type
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read and serve the file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 - File Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 - Internal Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GIE Certificate System running on http://localhost:${PORT}`);
  console.log('📝 Static files served from /public directory');
  console.log('⚡ This is a Vercel serverless app running in local development mode');
  console.log('💡 For full API functionality, deploy to Vercel or use Vercel CLI');
});
