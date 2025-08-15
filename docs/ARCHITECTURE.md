# Architecture Documentation

## User Preferences Context System

### Overview

The application uses a unified context system to manage cross-cutting user preferences like locale and timezone. This ensures consistent behavior across all commands and services without prop drilling or repeated database lookups.

### Core Components

#### 1. User Preferences Context (`src/context/userPreferences.js`)

- **Purpose**: Centralized management of user preferences using AsyncLocalStorage
- **Stores**: Both locale and timezone in a single context
- **Default values**: `en-US` for locale, `UTC` for timezone

#### 2. Context Functions

##### Setting Context

```javascript
// Set both preferences
withPreferences({ locale: "es-ES", timezone: "America/New_York" }, async () => {
    // Code runs with these preferences
});

// Set only locale
withLocale("es-ES", async () => {
    // Code runs with Spanish locale
});

// Set only timezone
withTimezone("America/New_York", async () => {
    // Code runs with NY timezone
});
```

##### Reading Context

```javascript
getCurrentPreferences(); // Returns { locale: "...", timezone: "..." }
getCurrentLocale(); // Returns current locale
getCurrentTimezone(); // Returns current timezone
```

### Integration Points

#### Bot Entry Points (`src/bot.js`)

All Discord interactions are wrapped with user preferences:

```javascript
const preferences = getUserPreferences(interaction, userService);
await withPreferences(preferences, async () => {
    // Handle command with user's locale and timezone
});
```

#### Time Parsing (`src/utils/timeParser.js`)

TimeParser automatically uses timezone from context when not explicitly provided:

```javascript
// These are equivalent when context has timezone
parseTimeString("in 2 hours"); // Uses context timezone
parseTimeString("in 2 hours", "UTC"); // Explicitly uses UTC
```

#### Translations (`src/i18n/i18n.js`)

The translation function `t()` automatically uses locale from context:

```javascript
t("commands.help.title"); // Uses current locale from context
```

### Benefits

1. **Consistency**: User preferences are applied uniformly across all operations
2. **Performance**: Preferences are fetched once per interaction, not repeatedly
3. **Clean Code**: No need to pass timezone/locale through multiple function calls
4. **Maintainability**: Single source of truth for preference management
5. **Testability**: Easy to mock preferences for testing

### Data Flow

1. User triggers Discord interaction
2. Bot fetches user preferences from database
3. Bot sets preferences in AsyncLocalStorage context
4. All subsequent operations use context preferences
5. Context is automatically cleaned up after interaction

### Database Schema

User preferences are persisted in the `users` table:

- `language`: User's preferred locale (null = auto-detect from Discord)
- `timezone`: User's timezone (default: UTC)

### Future Enhancements

The context system is designed to be extensible. Additional preferences can be added by:

1. Adding fields to the preferences object
2. Updating `getUserPreferences()` to fetch new preferences
3. Adding convenience getters like `getCurrentNewPreference()`
