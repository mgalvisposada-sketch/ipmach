#!/bin/bash

# StockService IIS-Only Deployment Script
# This script builds the project for Windows IIS deployment (HTTP endpoints only)

set -e  # Exit on any error

# Configuration
PROJECT_NAME="StockService"
DEPLOYMENT_DIR="deployment-iis"
BUILD_CONFIG="Release"
TARGET_FRAMEWORK="net9.0"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ZIP_NAME="${PROJECT_NAME}_iis_${TIMESTAMP}.zip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists dotnet; then
        print_error ".NET SDK is not installed. Please install .NET 9.0 SDK first."
        print_status "Visit: https://dotnet.microsoft.com/download"
        exit 1
    fi
    
    # Check .NET version
    DOTNET_VERSION=$(dotnet --version)
    print_success "Found .NET SDK version: $DOTNET_VERSION"
    
    if ! command_exists zip; then
        print_warning "zip command is not available. Will use alternative method."
        print_status "Installing zip or using alternative..."
        
        # Try to install zip based on the system
        if command_exists apt-get; then
            print_status "Installing zip via apt-get..."
            sudo apt-get update && sudo apt-get install -y zip
        elif command_exists yum; then
            print_status "Installing zip via yum..."
            sudo yum install -y zip
        elif command_exists brew; then
            print_status "Installing zip via brew..."
            brew install zip
        else
            print_warning "Cannot install zip automatically. Will create tar.gz instead."
            USE_TAR=true
        fi
        
        # Check again after installation attempt
        if ! command_exists zip && [ "$USE_TAR" != "true" ]; then
            print_error "Failed to install zip. Please install it manually or use tar.gz option."
            exit 1
        fi
    fi
    
    # If using tar fallback, check if tar is available
    if [ "$USE_TAR" = "true" ]; then
        if ! command_exists tar; then
            print_error "Neither zip nor tar is available. Please install one of them."
            exit 1
        fi
        print_success "Will use tar.gz format for packaging"
    fi
    
    print_success "All prerequisites are satisfied"
}

# Clean previous builds
clean_build() {
    print_status "Cleaning previous builds..."
    
    if [ -d "bin" ]; then
        rm -rf bin
        print_success "Cleaned bin directory"
    fi
    
    if [ -d "obj" ]; then
        rm -rf obj
        print_success "Cleaned obj directory"
    fi
    
    if [ -d "$DEPLOYMENT_DIR" ]; then
        rm -rf "$DEPLOYMENT_DIR"
        print_success "Cleaned deployment directory"
    fi
}

# Restore dependencies
restore_dependencies() {
    print_status "Restoring NuGet dependencies..."
    dotnet restore
    print_success "Dependencies restored successfully"
}

# Build the project
build_project() {
    print_status "Building project in $BUILD_CONFIG configuration..."
    dotnet build --configuration $BUILD_CONFIG --no-restore
    print_success "Project built successfully"
}

# Publish the project for Windows IIS
publish_project() {
    print_status "Publishing project for Windows IIS deployment..."
    
    # Create deployment directory
    mkdir -p "$DEPLOYMENT_DIR"
    
    # Publish for Windows
    dotnet publish \
        --configuration $BUILD_CONFIG \
        --output "$DEPLOYMENT_DIR/$PROJECT_NAME" \
        --runtime win-x64 \
        --self-contained false \
        --no-restore
    
    print_success "Project published successfully for Windows IIS"
}

# Copy additional files
copy_additional_files() {
    print_status "Copying additional deployment files..."
    
    # Copy appsettings.json if it exists
    if [ -f "appsettings.json" ]; then
        cp appsettings.json "$DEPLOYMENT_DIR/$PROJECT_NAME/"
        print_success "Copied appsettings.json"
    fi
    
    # Copy appsettings.Production.json if it exists
    if [ -f "appsettings.Production.json" ]; then
        cp appsettings.Production.json "$DEPLOYMENT_DIR/$PROJECT_NAME/"
        print_success "Copied appsettings.Production.json"
    fi
    
    # Copy database scripts if they exist
    if [ -d "../database" ]; then
        cp -r ../database "$DEPLOYMENT_DIR/"
        print_success "Copied database scripts"
    fi
    
    # Create log directory
    mkdir -p "$DEPLOYMENT_DIR/logs"
    echo "Log directory created at: $DEPLOYMENT_DIR/logs" > "$DEPLOYMENT_DIR/logs/README.txt"
    echo "Log files will be created automatically when the application runs." >> "$DEPLOYMENT_DIR/logs/README.txt"
    echo "Format: StockService_YYYY-MM-DD.log" >> "$DEPLOYMENT_DIR/logs/README.txt"
    print_success "Created log directory"
    
    # Create deployment info file
    cat > "$DEPLOYMENT_DIR/deployment-info.txt" << EOF
StockService IIS Deployment Package
Generated: $(date)
Build Configuration: $BUILD_CONFIG
Target Framework: $TARGET_FRAMEWORK
Runtime: win-x64
Deployment Type: Windows IIS (HTTP Endpoints Only)

IIS Deployment Instructions:
1. Extract this package to your IIS web root (e.g., C:\\inetpub\\wwwroot\\StockService)
2. Run deploy-to-iis.bat as Administrator
3. Access your API at http://localhost:8080

Available HTTP Endpoints:
- GET  /api/productstock/{strProducto} - Get product stock for current month
- GET  /api/clientbi - Get all clients from BI view (cached)
- GET  /api/clientbi/search?searchTerm={term} - Search clients (cached)

Authentication:
- Username: admin
- Password: Admin123!
- Use Basic Authentication header: Authorization: Basic {base64(username:password)}

Swagger Documentation:
- Access at: http://localhost:8080/swagger

Database Setup:
- Check the database directory for SQL scripts
- Update connection string in appsettings.json
- Ensure SQL Server is accessible from the IIS server

Logging:
- Application logs are stored in the /logs directory
- Log files are created daily: StockService_YYYY-MM-DD.log
- Log levels: INFO, WARN, ERROR, DEBUG, API, DB, CACHE

Troubleshooting:
- Check IIS logs: C:\\inetpub\\logs\\LogFiles
- Check application logs in the /logs directory
- Check application logs in Event Viewer
- Verify .NET Core Hosting Bundle is installed on the server
EOF
    
    print_success "Created deployment info file"
}

# Create IIS deployment script
create_iis_deployment_script() {
    print_status "Creating IIS deployment script..."
    
    cat > "$DEPLOYMENT_DIR/deploy-to-iis.bat" << 'EOF'
@echo off
REM StockService IIS Deployment Script
REM This script deploys the StockService to IIS for HTTP endpoints

setlocal enabledelayedexpansion

REM Configuration
set APP_NAME=StockService
set SITE_NAME=StockServiceAPI
set APP_POOL_NAME=StockServicePool
set INSTALL_DIR=C:\inetpub\wwwroot\%APP_NAME%
set SOURCE_DIR=%~dp0%APP_NAME%

REM Colors for output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo %BLUE%==========================================%NC%
echo %BLUE%StockService IIS Deployment Script%NC%
echo %BLUE%==========================================%NC%
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%[ERROR] This script must be run as Administrator%NC%
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

REM Check if IIS is installed
reg query "HKLM\SOFTWARE\Microsoft\InetStp" >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%[ERROR] IIS is not installed on this machine%NC%
    echo Please install IIS and ASP.NET Core Hosting Bundle first
    pause
    exit /b 1
)

echo %BLUE%[INFO] Deploying %APP_NAME% to IIS for HTTP endpoints...%NC%

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    echo %BLUE%[INFO] Creating installation directory...%NC%
    mkdir "%INSTALL_DIR%"
)

REM Copy application files
echo %BLUE%[INFO] Copying application files...%NC%
xcopy "%SOURCE_DIR%\*" "%INSTALL_DIR%\" /E /Y /Q

REM Create application pool
echo %BLUE%[INFO] Creating application pool...%NC%
%windir%\system32\inetsrv\appcmd.exe add apppool /name:"%APP_POOL_NAME%" /managedRuntimeVersion:"" /managedPipelineMode:Integrated

REM Create website
echo %BLUE%[INFO] Creating website...%NC%
%windir%\system32\inetsrv\appcmd.exe add site /name:"%SITE_NAME%" /physicalPath:"%INSTALL_DIR%" /bindings:http://*:8080

REM Set application pool for the site
echo %BLUE%[INFO] Setting application pool...%NC%
%windir%\system32\inetsrv\appcmd.exe set site /site.name:"%SITE_NAME%" /applicationDefaults.applicationPool:"%APP_POOL_NAME%"

REM Set permissions
echo %BLUE%[INFO] Setting file permissions...%NC%
icacls "%INSTALL_DIR%" /grant "IIS_IUSRS:(OI)(CI)(RX)" /T
icacls "%INSTALL_DIR%" /grant "NETWORK SERVICE:(OI)(CI)(RX)" /T

REM Start the site
echo %BLUE%[INFO] Starting website...%NC%
%windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"

echo %GREEN%[SUCCESS] IIS deployment completed successfully!%NC%
echo.
echo Deployment Information:
echo - Website Name: %SITE_NAME%
echo - Application Pool: %APP_POOL_NAME%
echo - Installation Directory: %INSTALL_DIR%
echo - URL: http://localhost:8080
echo.
echo Available HTTP Endpoints:
echo - GET  http://localhost:8080/api/products
echo - GET  http://localhost:8080/api/clients
echo - Swagger: http://localhost:8080/swagger
echo.
echo Management Commands:
echo - Start Site: %windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"
echo - Stop Site: %windir%\system32\inetsrv\appcmd.exe stop site "%SITE_NAME%"
echo - Restart Site: %windir%\system32\inetsrv\appcmd.exe stop site "%SITE_NAME%" && %windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"
echo.
echo Next Steps:
echo 1. Update connection string in appsettings.json
echo 2. Test your API endpoints
echo 3. Configure SSL certificate if needed
echo 4. Set up firewall rules

pause
EOF
    
    print_success "Created IIS deployment script"
}

# Create installation script
create_install_script() {
    print_status "Creating installation script..."
    
    cat > "$DEPLOYMENT_DIR/install.bat" << 'EOF'
@echo off
REM StockService Installation Script
REM This script installs the StockService application

setlocal enabledelayedexpansion

REM Configuration
set APP_NAME=StockService
set SITE_NAME=StockServiceAPI
set APP_POOL_NAME=StockServicePool
set INSTALL_DIR=C:\inetpub\wwwroot\%APP_NAME%
set SOURCE_DIR=%~dp0%APP_NAME%

REM Colors for output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo %BLUE%==========================================%NC%
echo %BLUE%StockService Installation Script%NC%
echo %BLUE%==========================================%NC%
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%[ERROR] This script must be run as Administrator%NC%
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

REM Check if IIS is installed
reg query "HKLM\SOFTWARE\Microsoft\InetStp" >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%[ERROR] IIS is not installed on this machine%NC%
    echo Please install IIS and ASP.NET Core Hosting Bundle first
    echo Download from: https://dotnet.microsoft.com/download/dotnet/9.0
    pause
    exit /b 1
)

REM Check if .NET Core Hosting Bundle is installed
reg query "HKLM\SOFTWARE\Microsoft\IIS\Extensions\URLRewrite" >nul 2>&1
if %errorLevel% neq 0 (
    echo %YELLOW%[WARNING] ASP.NET Core Hosting Bundle may not be installed%NC%
    echo Please ensure ASP.NET Core Hosting Bundle is installed
    echo Download from: https://dotnet.microsoft.com/download/dotnet/9.0
    echo.
    set /p CONTINUE="Do you want to continue anyway? (y/N): "
    if /i not "%CONTINUE%"=="y" (
        echo Installation cancelled.
        pause
        exit /b 1
    )
)

echo %BLUE%[INFO] Installing %APP_NAME%...%NC%

REM Check if application pool already exists
%windir%\system32\inetsrv\appcmd.exe list apppool /name:"%APP_POOL_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo %YELLOW%[WARNING] Application pool %APP_POOL_NAME% already exists%NC%
    set /p REMOVE_POOL="Do you want to remove and recreate it? (y/N): "
    if /i "%REMOVE_POOL%"=="y" (
        echo %BLUE%[INFO] Removing existing application pool...%NC%
        %windir%\system32\inetsrv\appcmd.exe delete apppool /apppool.name:"%APP_POOL_NAME%"
    ) else (
        echo %YELLOW%[WARNING] Using existing application pool%NC%
    )
)

REM Check if website already exists
%windir%\system32\inetsrv\appcmd.exe list site /name:"%SITE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo %YELLOW%[WARNING] Website %SITE_NAME% already exists%NC%
    set /p REMOVE_SITE="Do you want to remove and recreate it? (y/N): "
    if /i "%REMOVE_SITE%"=="y" (
        echo %BLUE%[INFO] Removing existing website...%NC%
        %windir%\system32\inetsrv\appcmd.exe delete site /site.name:"%SITE_NAME%"
    ) else (
        echo %YELLOW%[WARNING] Using existing website%NC%
    )
)

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    echo %BLUE%[INFO] Creating installation directory...%NC%
    mkdir "%INSTALL_DIR%"
) else (
    echo %BLUE%[INFO] Installation directory already exists, backing up...%NC%
    if exist "%INSTALL_DIR%\backup" (
        rmdir /s /q "%INSTALL_DIR%\backup"
    )
    mkdir "%INSTALL_DIR%\backup"
    xcopy "%INSTALL_DIR%\*" "%INSTALL_DIR%\backup\" /E /Y /Q >nul 2>&1
)

REM Copy application files
echo %BLUE%[INFO] Copying application files...%NC%
xcopy "%SOURCE_DIR%\*" "%INSTALL_DIR%\" /E /Y /Q

REM Create application pool if it doesn't exist
%windir%\system32\inetsrv\appcmd.exe list apppool /name:"%APP_POOL_NAME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo %BLUE%[INFO] Creating application pool...%NC%
    %windir%\system32\inetsrv\appcmd.exe add apppool /name:"%APP_POOL_NAME%" /managedRuntimeVersion:"" /managedPipelineMode:Integrated
)

REM Create website if it doesn't exist
%windir%\system32\inetsrv\appcmd.exe list site /name:"%SITE_NAME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo %BLUE%[INFO] Creating website...%NC%
    %windir%\system32\inetsrv\appcmd.exe add site /name:"%SITE_NAME%" /physicalPath:"%INSTALL_DIR%" /bindings:http://*:8080
)

REM Set application pool for the site
echo %BLUE%[INFO] Setting application pool...%NC%
%windir%\system32\inetsrv\appcmd.exe set site /site.name:"%SITE_NAME%" /applicationDefaults.applicationPool:"%APP_POOL_NAME%"

REM Set permissions
echo %BLUE%[INFO] Setting file permissions...%NC%
icacls "%INSTALL_DIR%" /grant "IIS_IUSRS:(OI)(CI)(RX)" /T
icacls "%INSTALL_DIR%" /grant "NETWORK SERVICE:(OI)(CI)(RX)" /T

REM Start the site
echo %BLUE%[INFO] Starting website...%NC%
%windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"

REM Test if the site is running
timeout /t 3 >nul
%windir%\system32\inetsrv\appcmd.exe list site /name:"%SITE_NAME%" | find "Started" >nul 2>&1
if %errorLevel% equ 0 (
    echo %GREEN%[SUCCESS] Installation completed successfully!%NC%
    echo.
    echo Installation Information:
    echo - Website Name: %SITE_NAME%
    echo - Application Pool: %APP_POOL_NAME%
    echo - Installation Directory: %INSTALL_DIR%
    echo - URL: http://localhost:8080
    echo.
    echo Available HTTP Endpoints:
    echo - GET  http://localhost:8080/api/products
    echo - GET  http://localhost:8080/api/clients
    echo - Swagger: http://localhost:8080/swagger
    echo.
    echo Management Commands:
    echo - Start Site: %windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"
    echo - Stop Site: %windir%\system32\inetsrv\appcmd.exe stop site "%SITE_NAME%"
    echo - Restart Site: %windir%\system32\inetsrv\appcmd.exe stop site "%SITE_NAME%" && %windir%\system32\inetsrv\appcmd.exe start site "%SITE_NAME%"
    echo.
    echo Next Steps:
    echo 1. Update connection string in appsettings.json
    echo 2. Test your API endpoints
    echo 3. Configure SSL certificate if needed
    echo 4. Set up firewall rules
) else (
    echo %RED%[ERROR] Installation completed but website failed to start%NC%
    echo Please check IIS logs and application configuration
)

pause
EOF
    
    print_success "Created installation script"
}

# Create web.config for IIS
create_web_config() {
    print_status "Creating web.config for IIS..."
    
    cat > "$DEPLOYMENT_DIR/$PROJECT_NAME/web.config" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet" 
                  arguments=".\StockService.dll" 
                  stdoutLogEnabled="false" 
                  stdoutLogFile=".\logs\stdout" 
                  hostingModel="inprocess" />
    </system.webServer>
  </location>
</configuration>
EOF
    
    print_success "Created web.config for IIS"
}

# Create zip package
create_zip_package() {
    print_status "Creating IIS deployment package: $ZIP_NAME"
    
    # Create zip file
    cd "$DEPLOYMENT_DIR"
    
    if command_exists zip; then
        zip -r "../$ZIP_NAME" .
        print_success "IIS deployment package created: $ZIP_NAME"
    else
        # Fallback to tar.gz
        TAR_NAME="${ZIP_NAME%.zip}.tar.gz"
        tar -czf "../$TAR_NAME" .
        print_success "IIS deployment package created: $TAR_NAME (tar.gz format)"
        ZIP_NAME="$TAR_NAME"
    fi
    
    cd ..
}

# Display deployment summary
show_summary() {
    print_success "IIS deployment completed successfully!"
    echo
    echo "Deployment Summary:"
    echo "=================="
    echo "Package Name: $ZIP_NAME"
    if [ -f "$ZIP_NAME" ]; then
        echo "Package Size: $(du -h "$ZIP_NAME" | cut -f1)"
    else
        echo "Package Size: N/A (package not found)"
    fi
    echo "Deployment Directory: $DEPLOYMENT_DIR"
    echo "Build Configuration: $BUILD_CONFIG"
    echo "Target Framework: $TARGET_FRAMEWORK"
    echo "Runtime: win-x64"
    echo "Deployment Type: IIS (HTTP Endpoints Only)"
    echo
    echo "Contents:"
    echo "- $PROJECT_NAME/ (Application files)"
    echo "- web.config (IIS configuration)"
    echo "- install.bat (Main installation script)"
    echo "- deploy-to-iis.bat (IIS deployment script)"
    echo "- deployment-info.txt (Deployment information)"
    echo "- logs/ (Log directory with README)"
    if [ -d "$DEPLOYMENT_DIR/database" ]; then
        echo "- database/ (Database scripts)"
    fi
    echo
    echo "HTTP Endpoints Available:"
    echo "========================="
    echo "- GET  /api/productstock/{strProducto} - Get product stock for current month"
    echo "- GET  /api/clientbi - Get all clients from BI view (cached)"
    echo "- GET  /api/clientbi/search?searchTerm={term} - Search clients (cached)"
    echo
    echo "Authentication:"
    echo "==============="
    echo "- Username: admin"
    echo "- Password: Admin123!"
    echo "- Use Basic Authentication header: Authorization: Basic {base64(username:password)}"
    echo
    echo "Deployment Instructions:"
    echo "======================="
    echo "1. Transfer $ZIP_NAME to Windows server"
    echo "2. Extract the ZIP file"
    echo "3. Run install.bat as Administrator (recommended)"
    echo "   OR run deploy-to-iis.bat as Administrator"
    echo "4. Access API at http://localhost:8080"
    echo "5. View Swagger docs at http://localhost:8080/swagger"
    echo
    echo "Prerequisites on Windows Server:"
    echo "- IIS with ASP.NET Core Hosting Bundle"
    echo "- .NET 9.0 Runtime"
    echo "- SQL Server (if using SQL Server database)"
}

# Main execution
main() {
    echo "=========================================="
    echo "StockService IIS-Only Deployment Script"
    echo "=========================================="
    echo
    
    check_prerequisites
    clean_build
    restore_dependencies
    build_project
    publish_project
    copy_additional_files
    create_iis_deployment_script
    create_install_script
    create_web_config
    create_zip_package
    show_summary
}

# Run main function
main "$@"
