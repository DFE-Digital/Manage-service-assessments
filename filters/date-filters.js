/**
 * Format a date in GOV.UK style (D MMMM YYYY)
 * @param {string|Date} timestamp - Date to format
 * @returns {string} Formatted date
 */
exports.formatDate = (timestamp) => {
    if (!timestamp) {
        return '';
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return '';
    }

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}; 