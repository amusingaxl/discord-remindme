import * as chrono from 'chrono-node';
import moment from 'moment-timezone';

class TimeParser {
    static parseTimeString(timeString, userTimezone = 'UTC') {
        const now = moment().tz(userTimezone);
        
        const results = chrono.parse(timeString, now.toDate(), {
            timezone: userTimezone === 'UTC' ? undefined : userTimezone
        });
        
        if (results.length === 0) {
            return null;
        }
        
        const result = results[0];
        let parsedDate = moment(result.date());
        
        if (userTimezone !== 'UTC') {
            parsedDate = parsedDate.tz(userTimezone);
        }
        
        if (parsedDate.isBefore(now)) {
            if (this.isRelativeTime(timeString)) {
                parsedDate = parsedDate.add(1, 'day');
            } else {
                return null;
            }
        }
        
        return {
            date: parsedDate.utc().toDate(),
            originalTimezone: userTimezone,
            displayTime: parsedDate.format('YYYY-MM-DD HH:mm:ss z'),
            isValid: true
        };
    }
    
    static isRelativeTime(timeString) {
        const relativePatterns = [
            /in\s+\d+\s+(minute|hour|day|week|month)s?/i,
            /\d+\s+(minute|hour|day|week|month)s?\s+(from\s+now|later)/i,
            /next\s+(minute|hour|day|week|month)/i,
            /tomorrow/i,
            /tonight/i,
            /this\s+(afternoon|evening|morning)/i
        ];
        
        return relativePatterns.some(pattern => pattern.test(timeString.toLowerCase()));
    }
    
    static getTimeExamples() {
        return [
            '• **Relative times:** "in 2 hours", "in 30 minutes", "in 1 day"',
            '• **Specific times:** "tomorrow at 3pm", "next friday at 9am"', 
            '• **Dates:** "January 15th at 2pm", "2025-03-20 14:30"',
            '• **Natural language:** "tonight", "this evening", "next week"'
        ];
    }
    
    static formatReminderTime(date, timezone = 'UTC') {
        const momentDate = moment(date).tz(timezone);
        const now = moment().tz(timezone);
        
        const diffMinutes = momentDate.diff(now, 'minutes');
        const diffHours = momentDate.diff(now, 'hours');
        const diffDays = momentDate.diff(now, 'days');
        
        let timeDisplay = '';
        
        if (diffMinutes < 60) {
            timeDisplay = `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
            timeDisplay = `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        } else if (diffDays < 7) {
            timeDisplay = `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        } else {
            timeDisplay = momentDate.format('MMM Do, YYYY [at] h:mm A');
        }
        
        const fullFormat = momentDate.format('YYYY-MM-DD [at] h:mm A z');
        
        return {
            relative: timeDisplay,
            absolute: fullFormat,
            timestamp: Math.floor(momentDate.valueOf() / 1000)
        };
    }
    
    static getSupportedTimezones() {
        return [
            'UTC',
            'America/New_York',
            'America/Chicago', 
            'America/Denver',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Asia/Tokyo',
            'Asia/Shanghai',
            'Australia/Sydney'
        ];
    }
    
    static validateTimezone(timezone) {
        return moment.tz.zone(timezone) !== null;
    }
}

export default TimeParser;