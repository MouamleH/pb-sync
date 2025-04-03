import PocketBase from 'pocketbase/cjs';

export async function authenticatePocketBase(url, email, password) {
    const pb = new PocketBase(url);
    
    await pb.collection("_superusers")
        .authWithPassword(email, password);

    if (!pb.authStore.isValid) {
        throw new Error("Failed to authenticate");
    }

    return pb;
}

export async function checkInstanceAvailability(pb) {
    const r = await pb.health.check();    
    if (r.code !== 200) {
        throw new Error("Instance is not available");
    }

    if (!r.data.canBackup) {
        throw new Error("Instance is not configured to backup");
    }
} 