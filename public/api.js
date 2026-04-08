(() => {
    function getCookieValue(name) {
        const match = document.cookie
            .split('; ')
            .find(part => part.startsWith(`${name}=`));
        return match ? decodeURIComponent(match.split('=')[1]) : '';
    }

    function getCsrfToken() {
        return getCookieValue('csrf_token');
    }

    function apiFetch(input, init = {}) {
        const options = { ...init };
        const headers = new Headers(options.headers || {});
        const token = getCsrfToken();
        if (token && !headers.has('X-CSRF-Token')) {
            headers.set('X-CSRF-Token', token);
        }
        options.headers = headers;
        return fetch(input, options);
    }

    window.apiFetch = apiFetch;
    window.getCsrfToken = getCsrfToken;
})();
