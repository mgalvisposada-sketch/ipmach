# Running with Visible Browser or on Dedicated Computer

This guide explains how to run the Deep Search Service with a visible browser window or on a dedicated computer/server.

## Option 1: Run with Visible Browser (Non-Headless Mode)

### For Debugging/Monitoring

You can now run Playwright with a visible browser window to see what's happening in real-time.

#### Windows PowerShell:
```powershell
$env:PLAYWRIGHT_HEADLESS="false"
cd DeepSearchService
npm start
```

#### Windows CMD:
```cmd
set PLAYWRIGHT_HEADLESS=false
cd DeepSearchService
npm start
```

#### Linux/Mac:
```bash
export PLAYWRIGHT_HEADLESS=false
cd DeepSearchService
npm start
```

#### Using .env file:
Create or update `.env` file in `DeepSearchService`:
```
PLAYWRIGHT_HEADLESS=false
```

### Benefits:
- ✅ See the browser in action
- ✅ Debug issues visually
- ✅ Monitor the scraping process
- ✅ Verify login/search steps

### Drawbacks:
- ⚠️ Requires a display/GUI (won't work on headless servers)
- ⚠️ Uses more resources
- ⚠️ Slower than headless mode

---

## Option 2: Run on a Dedicated Computer/Server

### Setup on Windows Server/Desktop

1. **Install Node.js and npm** (if not already installed):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Clone/Setup the project**:
   ```powershell
   cd C:\YourPath\ciparcol
   cd DeepSearchService
   npm install
   npm run build
   ```

3. **Configure environment variables**:
   Create `.env` file:
   ```
   PORT=3001
   HOST=0.0.0.0
   API_KEY=your-api-key-here
   PLAYWRIGHT_HEADLESS=true  # or false to see browser
   ```

4. **Run as Windows Service** (optional):
   Use tools like:
   - **NSSM** (Non-Sucking Service Manager)
   - **PM2** for Windows
   - **Windows Task Scheduler**

   Example with NSSM:
   ```powershell
   # Download NSSM from https://nssm.cc/download
   nssm install DeepSearchService "C:\Program Files\nodejs\node.exe"
   nssm set DeepSearchService AppDirectory "C:\YourPath\ciparcol\DeepSearchService"
   nssm set DeepSearchService AppParameters "C:\YourPath\ciparcol\DeepSearchService\dist\index.js"
   nssm start DeepSearchService
   ```

### Setup on Linux Server

1. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install dependencies**:
   ```bash
   cd /path/to/DeepSearchService
   npm install
   npm run build
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

4. **Configure environment**:
   Create `.env` file:
   ```
   PORT=3001
   HOST=0.0.0.0
   API_KEY=your-api-key-here
   PLAYWRIGHT_HEADLESS=true
   ```

5. **Run with PM2** (recommended for production):
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name deep-search-service
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start on boot
   ```

6. **Or run as systemd service**:
   Create `/etc/systemd/system/deep-search.service`:
   ```ini
   [Unit]
   Description=Deep Search Service
   After=network.target

   [Service]
   Type=simple
   User=your-user
   WorkingDirectory=/path/to/DeepSearchService
   Environment="NODE_ENV=production"
   Environment="PLAYWRIGHT_HEADLESS=true"
   ExecStart=/usr/bin/node /path/to/DeepSearchService/dist/index.js
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

   Then:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable deep-search
   sudo systemctl start deep-search
   ```

### Setup on Mac

Similar to Linux, but use Homebrew:
```bash
brew install node
cd DeepSearchService
npm install
npm run build
npm start
```

---

## Option 3: Docker Container (Visible Browser with X11)

If you want to run in Docker but see the browser, you can use X11 forwarding:

### Dockerfile with X11 support:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Install X11 dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    x11-apps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### Run with X11 forwarding:
```bash
xhost +local:docker
docker run -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -e PLAYWRIGHT_HEADLESS=false \
  your-image
```

---

## Option 4: Remote Desktop/VNC for Monitoring

If running on a server, you can use VNC to see the browser:

1. **Install VNC Server** (on Linux):
   ```bash
   sudo apt-get install tigervnc-standalone-server tigervnc-common
   vncserver :1
   ```

2. **Set DISPLAY variable**:
   ```bash
   export DISPLAY=:1
   export PLAYWRIGHT_HEADLESS=false
   ```

3. **Connect with VNC client** to see the browser window

---

## Configuration Summary

| Environment Variable | Values | Description |
|---------------------|--------|-------------|
| `PLAYWRIGHT_HEADLESS` | `true` (default) or `false` | Controls browser visibility |
| `PORT` | `3001` (default) | Service port |
| `HOST` | `0.0.0.0` (default) | Listen on all interfaces |
| `API_KEY` | Your API key | Authentication key |

---

## Troubleshooting

### Browser window doesn't appear:
- Check `PLAYWRIGHT_HEADLESS` is set to `false`
- Ensure you have a display/GUI available
- On Linux, check `DISPLAY` environment variable

### "Cannot connect to display" error:
- Install X11: `sudo apt-get install xvfb`
- Or use VNC/X11 forwarding
- Or run in headless mode: `PLAYWRIGHT_HEADLESS=true`

### Performance issues with visible browser:
- Use headless mode for production: `PLAYWRIGHT_HEADLESS=true`
- Visible mode is slower and uses more resources

---

## Recommendations

- **Development/Debugging**: Use `PLAYWRIGHT_HEADLESS=false` to see what's happening
- **Production**: Use `PLAYWRIGHT_HEADLESS=true` for better performance
- **Dedicated Server**: Use PM2 or systemd for process management
- **Monitoring**: Use logging + optional VNC for occasional visual checks

