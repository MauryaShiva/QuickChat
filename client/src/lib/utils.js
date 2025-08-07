/**
 * Formats a given date into a human-readable string using the 'Asia/Kolkata' timezone.
 * Example output: "Aug 05, 2025, 11:36 PM"
 * @param {string | Date} date - The date object or date string to be formatted.
 * @returns {string} The formatted date and time string.
 */
export function formatMessageTime(date) {
  return new Date(date).toLocaleString("en-US", {
    // This explicitly sets the timezone to Indian Standard Time (IST).
    // To use the user's local timezone instead, this line can be removed.
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
