/**
 * Valentine Game - FTP Deployment Script
 * 
 * Deploys the Valentine game to FTP server
 * 
 * Usage:
 *   npm run deploy           - Deploy all files
 *   npm run deploy:dry-run   - Test without uploading
 *   npm run deploy:verbose   - Deploy with detailed logging
 */

const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
    // FTP Connection Settings
    host: process.env.FTP_HOST || 'ftp.willyoubemyvalentine.fun',
    user: process.env.FTP_USER || 'u836338583.willyoubemyvalentine',
    password: process.env.FTP_PASSWORD || 'Netscape@2308',
    secure: false,
    
    // Remote directory path (FTP user root is already public_html)
    remoteDir: process.env.FTP_REMOTE_DIR || '/',
    
    // Files to deploy
    filesToDeploy: [
        // Core files
        'index.html',
        'styles.css',
        'script.js',
        '.htaccess',
        
        // SEO files
        'sitemap.xml',
        'sitemap_index.xml',
        'sitemap.txt',
        'robots.txt',
        
        // Images
        'favicon.ico',
        'og-image.jpeg',
        'buymeacoffee-qr.png'
    ],
    
    // Folders to deploy (entire folder contents)
    foldersToDeploy: [
        'articles',
        'ecard',
        'github',
        'minion'
    ]
};

// ============================================================================
// COMMAND LINE ARGUMENTS
// ============================================================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow');
}

function logVerbose(message) {
    if (isVerbose) {
        log(`  ${message}`, 'blue');
    }
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

function validateFiles() {
    log('\n💕 Validating files to deploy...', 'magenta');
    
    const validFiles = [];
    const missingFiles = [];
    
    for (const file of config.filesToDeploy) {
        const localPath = path.join(__dirname, file);
        
        if (fs.existsSync(localPath)) {
            const stats = fs.statSync(localPath);
            validFiles.push({
                name: file,
                localPath: localPath,
                size: stats.size
            });
            logVerbose(`Found: ${file} (${formatBytes(stats.size)})`);
        } else {
            missingFiles.push(file);
            logWarning(`Missing: ${file}`);
        }
    }
    
    if (missingFiles.length > 0) {
        logError(`\n${missingFiles.length} file(s) not found!`);
        return null;
    }
    
    logSuccess(`All ${validFiles.length} files validated`);
    return validFiles;
}

function validateFolders() {
    log('\n📁 Validating folders to deploy...', 'magenta');
    
    const validFolders = [];
    const missingFolders = [];
    
    for (const folder of config.foldersToDeploy) {
        const localPath = path.join(__dirname, folder);
        
        if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
            const files = getAllFilesInFolder(localPath, folder);
            validFolders.push({
                name: folder,
                localPath: localPath,
                files: files
            });
            logVerbose(`Found folder: ${folder} (${files.length} files)`);
        } else {
            missingFolders.push(folder);
            logWarning(`Missing folder: ${folder}`);
        }
    }
    
    if (missingFolders.length > 0) {
        logWarning(`${missingFolders.length} folder(s) not found (will be skipped)`);
    }
    
    if (validFolders.length > 0) {
        const totalFiles = validFolders.reduce((sum, f) => sum + f.files.length, 0);
        logSuccess(`${validFolders.length} folder(s) validated (${totalFiles} files total)`);
    }
    
    return validFolders;
}

function getAllFilesInFolder(folderPath, relativePath) {
    const files = [];
    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const itemRelativePath = path.join(relativePath, item).replace(/\\/g, '/');
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
            // Recursively get files from subdirectories
            files.push(...getAllFilesInFolder(itemPath, itemRelativePath));
        } else {
            files.push({
                name: itemRelativePath,
                localPath: itemPath,
                size: stats.size
            });
        }
    }
    
    return files;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// FTP DEPLOYMENT
// ============================================================================

async function deploy() {
    console.log('\n');
    log('═══════════════════════════════════════════════════════════', 'magenta');
    log('   💖 Valentine Game - FTP Deployment 💖', 'bright');
    log('═══════════════════════════════════════════════════════════', 'magenta');
    
    if (isDryRun) {
        logWarning('\n🔍 DRY RUN MODE - No files will be uploaded\n');
    }
    
    // Validate files first
    const files = validateFiles();
    if (!files) {
        process.exit(1);
    }
    
    // Validate folders
    const folders = validateFolders();
    
    // Collect all files from folders
    const folderFiles = [];
    for (const folder of folders) {
        folderFiles.push(...folder.files);
    }
    
    // Combine all files
    const allFiles = [...files, ...folderFiles];
    
    if (isDryRun) {
        log('\n📋 Files that would be deployed:', 'cyan');
        files.forEach(f => log(`   • ${f.name} (${formatBytes(f.size)})`));
        if (folderFiles.length > 0) {
            log('\n📁 Folder files that would be deployed:', 'cyan');
            folderFiles.forEach(f => log(`   • ${f.name} (${formatBytes(f.size)})`));
        }
        log(`\n✓ Dry run complete. ${allFiles.length} files would be uploaded.`, 'green');
        return;
    }
    
    // Connect and upload
    const client = new ftp.Client();
    client.ftp.verbose = isVerbose;
    
    try {
        log('\n🔌 Connecting to FTP server...', 'cyan');
        logVerbose(`Host: ${config.host}`);
        logVerbose(`User: ${config.user}`);
        
        await client.access({
            host: config.host,
            user: config.user,
            password: config.password,
            secure: config.secure
        });
        
        logSuccess('Connected to FTP server');
        
        // Navigate to remote directory
        log(`\n📁 Navigating to: ${config.remoteDir}`, 'cyan');
        
        try {
            await client.ensureDir(config.remoteDir);
            logSuccess('Remote directory ready');
        } catch (dirError) {
            logWarning(`Directory navigation issue: ${dirError.message}`);
            logInfo('Attempting to continue with upload...');
        }
        
        // Remove conflicting default.php file if it exists
        log('\n🧹 Cleaning up conflicting files...', 'cyan');
        try {
            await client.remove('default.php');
            logSuccess('Removed default.php');
        } catch (removeError) {
            logVerbose('No default.php to remove (this is fine)');
        }
        
        // Upload root files
        log('\n📤 Uploading root files...', 'cyan');
        
        let uploadedCount = 0;
        let failedCount = 0;
        
        for (const file of files) {
            try {
                const remotePath = file.name;
                logVerbose(`Uploading: ${file.name} → ${remotePath}`);
                
                await client.uploadFrom(file.localPath, remotePath);
                uploadedCount++;
                logSuccess(`Uploaded: ${file.name}`);
                
            } catch (uploadError) {
                failedCount++;
                logError(`Failed: ${file.name} - ${uploadError.message}`);
            }
        }
        
        // Upload folder contents
        if (folderFiles.length > 0) {
            log('\n📁 Uploading folder contents...', 'cyan');
            
            // Track created directories to avoid redundant operations
            const createdDirs = new Set();
            
            for (const file of folderFiles) {
                try {
                    // Ensure the directory exists
                    const dirPath = path.dirname(file.name).replace(/\\/g, '/');
                    if (dirPath && dirPath !== '.' && !createdDirs.has(dirPath)) {
                        await client.ensureDir('/' + dirPath);
                        await client.cd('/');
                        createdDirs.add(dirPath);
                        logVerbose(`Created directory: ${dirPath}`);
                    }
                    
                    const remotePath = file.name;
                    logVerbose(`Uploading: ${file.name} → ${remotePath}`);
                    
                    await client.uploadFrom(file.localPath, remotePath);
                    uploadedCount++;
                    logSuccess(`Uploaded: ${file.name}`);
                    
                } catch (uploadError) {
                    failedCount++;
                    logError(`Failed: ${file.name} - ${uploadError.message}`);
                }
            }
        }
        
        // Summary
        log('\n═══════════════════════════════════════════════════════════', 'magenta');
        log('   📊 Deployment Summary', 'bright');
        log('═══════════════════════════════════════════════════════════', 'magenta');
        
        logSuccess(`Uploaded: ${uploadedCount} file(s)`);
        if (failedCount > 0) {
            logError(`Failed: ${failedCount} file(s)`);
        }
        
        log(`\n🌐 Your site is live at:`, 'green');
        log(`   https://willyoubemyvalentine.fun`, 'bright');
        log(`   http://willyoubemyvalentine.fun\n`, 'bright');
        
    } catch (error) {
        logError(`\nDeployment failed: ${error.message}`);
        
        if (error.code === 530) {
            logError('Authentication failed. Check your FTP credentials.');
        } else if (error.code === 'ENOTFOUND') {
            logError('FTP server not found. Check the hostname.');
        } else if (error.code === 'ETIMEDOUT') {
            logError('Connection timed out. Check your network or firewall.');
        }
        
        process.exit(1);
        
    } finally {
        client.close();
        logVerbose('FTP connection closed');
    }
}

// ============================================================================
// RUN DEPLOYMENT
// ============================================================================

deploy().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
});
