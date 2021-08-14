export function deconstructDuration(duration) {
    return {
        hours: Math.floor(duration / 3600),
        minutes: Math.floor((duration % 3600) / 60),
        seconds: duration % 60
    };
}

export function toEST(date) {
    return new Date(date).toLocaleString('en-US', { timeZone: 'America/New_York' });
} 