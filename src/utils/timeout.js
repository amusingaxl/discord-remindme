export async function withTimeout(promise, timeoutMs = 2000, errorMessage = "Operation timed out") {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
