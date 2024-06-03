import * as fs from 'fs';
import * as https from 'https';
import { WebSocketServer } from 'ws';

// Configuration
const host = '0.0.0.0';
const port = 8444;
const tlsKeyFilePath = 'certificates/leafKey.pem';
const tlsCertFilePath = 'certificates/certChain.pem';
const rootCACertFilePath = 'certificates/rootCertificate.pem';

// Create HTTPS server with mTLS configuration
const server = https.createServer({
  key: fs.readFileSync(tlsKeyFilePath),
  cert: fs.readFileSync(tlsCertFilePath),
  ca: fs.readFileSync(rootCACertFilePath),
  requestCert: true,
  rejectUnauthorized: true,
  ciphers: [
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'RSA-AES128-GCM-SHA256',
  ].join(':'),
  honorCipherOrder: true,
  ticketKeys: Buffer.alloc(48, 'ticket')
});

// Event loggers
server.on('tlsClientError', (err, socket) => {
    console.error('TLS client error:', err);
  });
  
server.on('request', (req, res) => {
    console.log(`Received request for ${req.url}`);
});

server.on('connection', (socket) => {
    console.log('New connection established at ' + new Date().toISOString());
    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
    socket.on('close', (hadError) => {
        console.log('Connection closed', hadError ? 'due to an error' : '');
    });
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Handle incoming messages
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Handle close
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Handle HTTPS upgrade requests to WebSocket
server.on('upgrade', (request, socket, head) => {
  // Check client certificate validity
  const cert = request.socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Start server
server.listen(port, host, () => {
  console.log(`mTLS WebSocket server running at https://${host}:${port}/`);
});
