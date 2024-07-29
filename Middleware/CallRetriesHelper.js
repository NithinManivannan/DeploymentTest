const withRetries = async (operation, maxRetries = 3, onError = null) => {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const response = await operation();
            console.log(`Attempt ${retries + 1} succeeded`)
            return response;
        } catch (error) {
            console.log(`Attempt ${retries + 1} failed: ${error.message}`)
            retries++;
            if (retries === maxRetries) {
                console.log(`All attempts failed`)
                return null;
            }

            if (onError) {
                onError(error);
            }
        }
    }
};

module.exports = {
    withRetries,
};