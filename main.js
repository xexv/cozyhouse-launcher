const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { Client } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');

let win;
const launcher = new Client();

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  win.loadFile('index.html');

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CONSOLE] ${message} (at ${sourceId}:${line})`);
  });
}

// IPC handlers registered once at module level to prevent duplicate registration
// if createWindow() is called more than once (e.g. macOS activate event).
ipcMain.on('window-minimize', () => {
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (win) win.close();
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Fetch Minecraft server status via mcsrvstat.us API
ipcMain.handle('get-server-status', (event, host) => {
  return new Promise((resolve) => {
    const url = `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({
            online: json.online === true,
            players: {
              online: json.players?.online ?? 0,
              max: json.players?.max ?? 0
            },
            version: json.version ?? null,
            motd: json.motd?.clean?.[0] ?? null
          });
        } catch {
          resolve({ online: false, players: { online: 0, max: 0 } });
        }
      });
    });
    req.on('error', () => resolve({ online: false, players: { online: 0, max: 0 } }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ online: false, players: { online: 0, max: 0 } });
    });
  });
});

// Auto-updater setup — runs only in packaged builds to avoid dev errors
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (win) win.webContents.send('update-status', { type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    if (win) win.webContents.send('update-status', { type: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    if (win) win.webContents.send('update-status', { type: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (win) win.webContents.send('update-status', {
      type: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (win) win.webContents.send('update-status', { type: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater]', err.message);
    if (win) win.webContents.send('update-status', { type: 'error', error: getErrorMessage(err) });
  });

  // Delay check so the window is fully ready before any UI updates
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log('[Updater] Check skipped:', err.message);
    });
  }, 4000);
}

// Helper to safely extract error message string
const getErrorMessage = (err) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  return err.message || err.toString();
};

// Helper to recursively find javaw.exe on disk
const findJavaw = (dir) => {
  if (!fs.existsSync(dir)) return null;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      if (stat.isDirectory()) {
        const found = findJavaw(fullPath);
        if (found) return found;
      } else if (file.toLowerCase() === 'javaw.exe') {
        return fullPath;
      }
    }
  } catch (e) {
    console.error('Error scanning JRE folder:', e);
  }
  return null;
};

// Recursive Node.js HTTP/HTTPS downloader supporting redirects (max 10 hops)
const downloadFile = (url, dest, progressCallback, _redirectDepth = 0) => {
  return new Promise((resolve, reject) => {
    if (_redirectDepth > 10) {
      reject(new Error('Too many redirects while downloading JRE'));
      return;
    }

    const client = url.startsWith('https://') ? https : http;

    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location;
        response.resume(); // consume and discard response body
        downloadFile(location, dest, progressCallback, _redirectDepth + 1).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download JRE: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (progressCallback && totalSize) {
          progressCallback(Math.round((downloaded / totalSize) * 100));
        }
      });

      response.on('end', () => {
        file.end();
        resolve();
      });

      response.on('error', (err) => {
        file.destroy();
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// PowerShell zip extractor
const extractZip = (zipPath, destDir) => {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    // Run PowerShell command to extract the JRE safely without dependencies
    const cmd = `powershell.exe -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

// Handle Minecraft launch IPC channel
ipcMain.on('launch-game', (event, options) => {
  const { username, uuid, accessToken, version, maxMemory, mcPath, javaPath, serverAddress } = options;

  // Clear any existing event listeners to avoid duplicates and memory leaks
  launcher.removeAllListeners();

  const targetMcRoot = mcPath || path.join(app.getPath('appData'), '.cozyhouse');
  const jreFolder = path.join(targetMcRoot, 'jre21');

  // Start Minecraft core launch
  const startLaunch = (resolvedJavaPath) => {
    const launchOptions = {
      authorization: {
        access_token: accessToken || '00000000000000000000000000000000',
        client_token: uuid || '00000000000000000000000000000000',
        uuid: uuid || '00000000-0000-0000-0000-000000000000',
        name: username,
        user_properties: '{}'
      },
      root: targetMcRoot,
      version: {
        number: version || '26.1.2',
        type: 'release'
      },
      memory: {
        max: maxMemory || '4096M',
        min: '1024M'
      },
      // Auto-connect to server if provided
      customLaunchArgs: serverAddress ? ["--server", serverAddress] : []
    };

    if (resolvedJavaPath) {
      launchOptions.javaPath = resolvedJavaPath;
    }

    // Setup MCLC listeners and pipe output back to index.html webview
    launcher.on('debug', (e) => {
      if (win) win.webContents.send('launch-status', { type: 'debug', data: e });
    });

    launcher.on('data', (e) => {
      if (win) win.webContents.send('launch-status', { type: 'data', data: e });
    });

    launcher.on('progress', (e) => {
      if (win) {
        win.webContents.send('launch-status', { 
          type: 'progress', 
          task: e.task, 
          total: e.total, 
          pending: e.pending 
        });
      }
    });

    launcher.on('close', (code) => {
      if (win) win.webContents.send('launch-status', { type: 'close', code });
    });

    launcher.on('error', (err) => {
      if (win) win.webContents.send('launch-status', { type: 'error', error: getErrorMessage(err) });
    });

    launcher.launch(launchOptions).catch(err => {
      if (win) win.webContents.send('launch-status', { type: 'error', error: getErrorMessage(err) });
    });
  };

  // Java checking workflow
  if (javaPath && javaPath.trim() !== '' && javaPath !== 'java') {
    // Custom user Java selected
    startLaunch(javaPath);
  } else {
    // Look for our portable local JRE 21 folder
    const localJavaw = findJavaw(jreFolder);
    if (localJavaw) {
      console.log('Found local JRE 21 path:', localJavaw);
      startLaunch(localJavaw);
    } else {
      // Need to download portable JRE 21 automatically
      console.log('Local Java 21 JRE not found. Initiating auto-download...');
      if (win) win.webContents.send('launch-status', { type: 'progress', task: 'СКАЧИВАНИЕ JAVA 21', total: 100, pending: 100 });
      
      // Ensure the target game directory exists before writing files
      fs.mkdirSync(targetMcRoot, { recursive: true });
      const zipPath = path.join(targetMcRoot, `tmp_jre21_${Date.now()}.zip`);
      const jreUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_x64_windows_hotspot_21.0.3_9.zip';

      downloadFile(jreUrl, zipPath, (percent) => {
        if (win) win.webContents.send('launch-status', { type: 'progress', task: `СКАЧИВАНИЕ JAVA 21 (${percent}%)`, total: 100, pending: 100 - percent });
      })
      .then(() => {
        if (win) win.webContents.send('launch-status', { type: 'progress', task: 'РАСПАКОВКА JAVA 21', total: 100, pending: 10 });
        return extractZip(zipPath, jreFolder);
      })
      .then(() => {
        // Clean up temporary zip
        try {
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }
        } catch(e) {}

        const downloadedJavaw = findJavaw(jreFolder);
        if (downloadedJavaw) {
          console.log('JRE 21 downloaded and extracted successfully. Path:', downloadedJavaw);
          startLaunch(downloadedJavaw);
        } else {
          throw new Error('Не удалось найти javaw.exe в распакованном архиве JRE 21.');
        }
      })
      .catch((err) => {
        if (win) win.webContents.send('launch-status', { type: 'error', error: 'Ошибка установки Java 21: ' + err.message });
      });
    }
  }
});

// Handle dynamic JRE 21 path checking
ipcMain.handle('get-active-java-path', async (event, customMcPath, customJavaPath) => {
  if (customJavaPath && customJavaPath.trim() !== '' && customJavaPath !== 'java') {
    return customJavaPath;
  }
  const targetMcRoot = customMcPath || path.join(app.getPath('appData'), '.cozyhouse');
  const jreFolder = path.join(targetMcRoot, 'jre21');
  const foundJavaw = findJavaw(jreFolder);
  return foundJavaw || 'java';
});

// Handle directory selection picker
ipcMain.handle('select-folder', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle file selection picker
ipcMain.handle('select-file', async (event, filters) => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || []
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    setupAutoUpdater();
  }

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
