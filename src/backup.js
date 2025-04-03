import fs from 'fs';
import https from 'https';
import cliProgress from 'cli-progress';

export function generateBackupName() {
    return 'sync-backup-' + new Date().toISOString().split('T')[0] + '-' + new Date().getSeconds() + ".zip";
}

export function getLocalBackupPath(backupName) {
    return 'backups/' + backupName;
}

export async function createBackup(pb, backupName) {
    await pb.backups.create(backupName);
}

export async function deleteBackup(pb, backupName) {
    try {
        await pb.backups.delete(backupName);
    } catch (err) {
        console.error("Failed to delete backup, you have to delete it manually (continuing...):", err.message);
    }
}

export async function downloadBackup(pb, backupName, localPath) {
    const fileToken = await pb.files.getToken();
    const url = pb.backups.getDownloadURL(fileToken, backupName);
    
    const file = fs.createWriteStream(localPath);
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

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
                fs.unlink(localPath, () => { });
                reject(new Error("Failed to save backup file: " + err.message));
            });

            response.on('error', err => {
                progressBar.stop();
                fs.unlink(localPath, () => { });
                reject(new Error("Failed to download backup: " + err.message));
            });
        });
    });
}

export async function uploadBackup(pb, backupName, localPath) {
    await pb.backups.upload({
        file: new File([fs.readFileSync(localPath)], backupName, { type: 'application/zip' })
    });
}

export async function restoreBackup(pb, backupName) {
    await pb.backups.restore(backupName);
}

export async function waitForInstance(pb) {
    let isUp = false;
    while (!isUp) {
        try {
            await pb.health.check();
            isUp = true;
        } catch (err) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
} 