const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Enable WebGPU, hardware acceleration, and SharedArrayBuffer for WASM/DuckDB
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Register custom scheme with privileged flags before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AETHER-CORE // Autonomous HFT Terminal',
    backgroundColor: '#090e18',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/pwa-512x512.png'),
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL('app://localhost/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Custom protocol handler to serve dist/ assets with mandatory COOP/COEP headers
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);

    // Proxy Yahoo Finance quote requests directly so live tickers work in standalone desktop build
    if (url.pathname.startsWith('/api/yf/')) {
      const targetUrl = 'https://query1.finance.yahoo.com' + url.pathname.replace(/^\/api\/yf/, '') + url.search;
      try {
        return await net.fetch(targetUrl, {
          method: request.method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
      } catch (err) {
        console.error('Yahoo Finance proxy failed:', err);
        return new Response('Network error', { status: 502 });
      }
    }

    let relativePath = decodeURIComponent(url.pathname);
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.slice(1);
    }
    if (!relativePath || relativePath === '/') {
      relativePath = 'index.html';
    }

    const distDir = path.join(__dirname, '../dist');
    const filePath = path.join(distDir, relativePath);
    const fileUrl = pathToFileURL(filePath).toString();

    try {
      const response = await net.fetch(fileUrl);
      const headers = new Headers(response.headers);
      // Essential headers for DuckDB-WASM and C++ WASM linear memory ring buffers
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
