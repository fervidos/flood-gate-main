/**
 * Extract username from NGL link or return the username as-is
 * @param {string} input - Either a username or full NGL link
 * @returns {string} - Extracted username in lowercase
 */
export function extractUsername(input) {
    if (!input) return '';

    // Remove whitespace
    input = input.trim();

    // Check if it's a full URL
    const urlPatterns = [
        /^https?:\/\/ngl\.link\/([^\/\?#]+)/i,
        /^ngl\.link\/([^\/\?#]+)/i,
        /^www\.ngl\.link\/([^\/\?#]+)/i
    ];

    for (const pattern of urlPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            return match[1].toLowerCase();
        }
    }

    // If not a URL, treat as username
    return input.toLowerCase();
}
