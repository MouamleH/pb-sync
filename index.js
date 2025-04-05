#!/usr/bin/env node
import fs from 'fs';
import { readInput } from './src/config.js';
import { authenticatePocketBase, checkInstanceAvailability } from './src/auth.js';

import {
    generateBackupName,
    getLocalBackupPath,
    createBackup,
    deleteBackup,
    downloadBackup,
    uploadBackup,
    restoreBackup,
    waitForInstance
} from './src/backup.js';

// Ensure backups directory exists
if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups');
}

try {
    // Get source credentials
    const sourceData = await readInput("Source");
    const source = await authenticatePocketBase(sourceData.url, sourceData.email, sourceData.password);
    console.log("Authenticated with source");

    // Get target credentials
    const targetData = await readInput("Target");
    const target = await authenticatePocketBase(targetData.url, targetData.email, targetData.password);
    console.log("Authenticated with target");

    // Check source availability
    console.log("Checking if source can be backed up...");
    await checkInstanceAvailability(source);

    // Generate backup name and path
    const backupName = generateBackupName();
    const backupLocalPath = getLocalBackupPath(backupName);

    // Create and download backup
    console.log("Creating backup...");
    await createBackup(source, backupName);
    console.log("Downloading backup...");
    await downloadBackup(source, backupName, backupLocalPath);

    // Clean up source backup
    await deleteBackup(source, backupName);

    // Upload and restore to target
    console.log("Uploading backup...");
    await uploadBackup(target, backupName, backupLocalPath);
    console.log("Restoring backup...");
    await restoreBackup(target, backupName);

    // Clean up local backup
    fs.unlink(backupLocalPath, () => { });

    // Wait for target to restart
    console.log("Waiting for target instance to start...");
    await waitForInstance(target);

    console.log(`Delete the backup file manually on target instance wthen the restore is done: ${backupName}`);

    console.log("Sync completed successfully");
    process.exit(0);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
