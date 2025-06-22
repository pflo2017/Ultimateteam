# JWT Error Handling System

This document explains how to use the JWT error handling system to automatically handle JWT expired errors in your React Native app.

## Problem

Your app was getting JWT expired errors like:
```
ERROR Error fetching teams: {"code": "PGRST301", "details": null, "hint": null, "message": "JWT expired"}
```

This happens when:
1. The access token expires (typically after 1 hour)
2. The automatic token refresh isn't working properly
3. No manual refresh mechanism is in place

## Solution

We've implemented a comprehensive JWT error handling system that:

1. **Automatically detects JWT expired errors**
2. **Attempts to refresh the token**
3. **Retries the original request with the new token**
4. **Handles refresh failures gracefully**

## How to Use

### Method 1: Using the JWTErrorHandler class directly

```typescript
import { JWTErrorHandler } from '../utils/jwtErrorHandler';

// Wrap your Supabase queries with JWT error handling
const { data, error } = await JWTErrorHandler.withJWTHandling(async () => {
  return await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId);
});

if (error) {
  console.error('Error fetching teams:', error);
} else {
  console.log('Teams loaded:', data);
}
```

### Method 2: Using the custom hooks

```typescript
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';

// In your component
const { data, error, loading, refetch } = useSupabaseQuery(() =>
  supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
);

// The hook automatically handles JWT errors and provides loading states
```

### Method 3: Manual error handling

```typescript
import { JWTErrorHandler } from '../utils/jwtErrorHandler';

try {
  const { data, error } = await supabase.from('teams').select('*');
  
  if (error) {
    const wasRefreshed = await JWTErrorHandler.handleJWTError(error);
    if (wasRefreshed) {
      // Retry your query here
      const { data: retryData, error: retryError } = await supabase.from('teams').select('*');
    }
  }
} catch (error) {
  await JWTErrorHandler.handleJWTError(error);
}
```

## What Happens When JWT Expires

1. **Detection**: The system detects JWT expired errors by checking error messages and codes
2. **Refresh**: It attempts to refresh the token using the refresh token
3. **Retry**: If refresh succeeds, it automatically retries the original request
4. **Fallback**: If refresh fails, it signs out the user and clears local storage

## Files Modified

- `src/lib/supabase.ts` - Added auth state change listener and refresh token function
- `src/utils/jwtErrorHandler.ts` - Main JWT error handling logic
- `src/hooks/useSupabaseQuery.ts` - Custom hooks for easy integration
- `App.tsx` - Added session validation on app start
- `src/screens/AttendanceScreen.tsx` - Example implementation

## Best Practices

1. **Wrap all Supabase queries** with JWT error handling
2. **Use the custom hooks** for new components
3. **Handle loading states** properly
4. **Test token refresh** scenarios

## Testing

To test the JWT error handling:

1. Log in to your app
2. Wait for the token to expire (or manually expire it)
3. Try to perform an action that requires authentication
4. The system should automatically refresh the token and retry the request

## Troubleshooting

If you're still getting JWT errors:

1. Check that `autoRefreshToken: true` is set in your Supabase client config
2. Ensure you have a valid refresh token
3. Verify that your Supabase project has refresh token rotation enabled
4. Check the console logs for detailed error information 