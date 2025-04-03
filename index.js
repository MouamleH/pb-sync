#!/usr/bin/env node
import fs from 'fs';
import https from 'https';
import PocketBase from 'pocketbase/cjs';
import readline from 'readline';
import cliProgress from 'cli-progress';

const backupName = 'sync-backup-' + new Date().toISOString().split('T')[0] + '-' + new Date().getSeconds() + ".zip";
const backupLocalName = 'backups/' + backupName;

if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups');
}

async function readInput(type) {
    try {
        const envFile = fs.readFileSync('.env', 'utf8');
        const envVars = Object.fromEntries(
            envFile.split('\n')
                .filter(line => line && !line.startsWith('#'))
                .map(line => line.split('=').map(part => part.trim()))
        );

        const prefix = type.toUpperCase();
        if (envVars[`${prefix}_URL`] && envVars[`${prefix}_EMAIL`] && envVars[`${prefix}_PASSWORD`]) {
            return {
                url: envVars[`${prefix}_URL`],
                email: envVars[`${prefix}_EMAIL`],
                password: envVars[`${prefix}_PASSWORD`]
            };
        } else {
            throw new Error(`No ${type} environment variables found`);
        }
    } catch (err) {
        console.log("No environment variables found, please enter the source data manually");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl._writeToOutput = function _writeToOutput(stringToWrite) {
            if (rl.stdoutMuted) {
                rl.output.write("\x1B[2K\x1B[200D" + rl.query + "[" + ((rl.line.length % 2 == 1) ? "=-=" : "-=-") + "]");
            } else {
                rl.output.write(stringToWrite);
            }
        };

        return await new Promise((resolve, reject) => {
            rl.on('SIGINT', () => {
                rl.close();
                reject(new Error('Operation cancelled'));
            });

            rl.question(`Enter ${type} URL: `, (url) => {
                rl.question(`Enter ${type} email: `, (email) => {
                    rl.stdoutMuted = true;
                    rl.question(`Enter ${type} password: `, (password) => {
                        rl.close();
                        console.log("");
                        resolve({
                            url: url,
                            email: email,
                            password: password
                        });
                    });
                });
            });
        });
    }
}

let sourceData;
try {
    sourceData = await readInput("Source");
} catch (err) {
    console.log("\nNo input data provided, aborting...");
    process.exit(1);
}


let targetData;
try {
    targetData = await readInput("Target");
} catch (err) {
    console.log("\nNo input data for target provided, aborting...");
    process.exit(1);
}

const source = new PocketBase(sourceData.url);
const target = new PocketBase(targetData.url);

console.log("Authenticating with source...");

await source.collection("_superusers")
    .authWithPassword(sourceData.email, sourceData.password);

console.log("Authenticating with target...");

await target.collection("_superusers")
    .authWithPassword(targetData.email, targetData.password);

if (!source.authStore.isValid) {
    console.error("Failed to authenticate with source");
    process.exit(1);
}

if (!target.authStore.isValid) {
    console.error("Failed to authenticate with target");
    process.exit(1);
}

console.log("Checking if source can be backed up...");
try {
    const r = await source.health.check();    
    if (r.code !== 200) {
        console.error("Source is not available");
        process.exit(1);
    }

    if (!r.data.canBackup) {
        console.error("Source is not configured to backup");
        process.exit(1);
    }
} catch (err) {
    console.error("Failed to check for source availability:", err.message);
    process.exit(1);
}

try {
    console.log("Creating backup...");
    await source.backups.create(backupName);
} catch (err) {
    console.error("Failed to create backup:", err.message);
    process.exit(1);
}

let fileToken;
try {
    console.log("Getting token...");
    fileToken = await source.files.getToken();
} catch (err) {
    console.error("Failed to get token:", err.message);
    process.exit(1);
}

let url;
try {
    console.log("Getting URL...");
    url = source.backups.getDownloadURL(fileToken, backupName);
} catch (err) {
    console.error("Failed to get backup download URL:", err.message);
    process.exit(1);
}

console.log("Downloading backup...");
const file = fs.createWriteStream(backupLocalName);
const downloadResult = await new Promise((resolve, reject) => {
    https.get(url, response => {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        // Create progress bar
        const progressBar = new cliProgress.SingleBar({
            format: 'Downloading backup [{bar}] {percentage}%',
            barCompleteChar: '=',
            barIncompleteChar: ' '
        });

        progressBar.start(totalSize, 0);

        response.on('data', chunk => {
            downloadedSize += chunk.length;
            progressBar.update(downloadedSize);
        });

        response.pipe(file);

        file.on('finish', () => {
            progressBar.stop();
            file.close();
            console.log("Successfully downloaded and saved backup file");
            resolve(true);
        });

        file.on('error', err => {
            progressBar.stop();
            fs.unlink(backupLocalName, () => { });
            console.error("Failed to save backup file:", err.message);
            reject(err);
        });

        response.on('error', err => {
            progressBar.stop();
            fs.unlink(backupLocalName, () => { });
            console.error("Failed to download backup:", err.message);
            reject(err);
        });
    });
});

if (!downloadResult) {
    console.error("Failed to download backup");
    process.exit(1);
}

try {
    console.log("Deleting source backup...");
    await source.backups.delete(backupName);
} catch (err) {
    console.error("Failed to delete source backup, you have to delete it manually (continueing...):");
}


try {
    console.log("Uploading backup...");
    await target.backups.upload({
        file: new File([fs.readFileSync(backupLocalName)], backupLocalName, { type: 'application/zip' })
    });
} catch (err) {
    console.error("Failed to upload backup:", err);
    process.exit(1);
}

console.log("Restoring backup...");
try {
    await target.backups.restore(backupName);
} catch (err) {
    console.error("Failed to restore backup:", err);
    process.exit(1);
}

console.log("Cleaning up...");
fs.unlink(backupLocalName, () => { });

console.log("Waiting for target instance to start...");
let isUp = false;
while (!isUp) {
    try {
        await target.health.check();
        isUp = true;
    } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}

try {
    console.log("Deleting target backup...");
    await target.backups.delete(backupName);
} catch (err) {
    console.error("Failed to delete target backup, you have to delete it manually (continueing...):");
}

console.log("Sync completed successfully");
process.exit(0);