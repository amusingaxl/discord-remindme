export function withTimeout(promise, timeoutMs = 2000, errorMessage = 'Operation timed out') {
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );
    
    return Promise.race([promise, timeout]);
}