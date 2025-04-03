import fs from 'fs';
import readline from 'readline';

export async function readInput(type) {
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