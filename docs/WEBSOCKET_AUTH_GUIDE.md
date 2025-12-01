# WebSocket Authentication Guide

## Overview

The WebSocket endpoint `/ws/reflections/{entry_id}` now requires JWT authentication and enforces authorization checks to ensure users can only access their own journal entries.

## Security Implementation

### Authentication Flow

1. **Connection Initiation**: Client connects with JWT token in query parameter
2. **Token Validation**: Server validates JWT signature and expiration
3. **User Verification**: Server confirms user exists and is active
4. **Entry Authorization**: Server verifies user owns the requested entry
5. **Streaming**: If all checks pass, reflection streaming begins

### WebSocket Close Codes

The implementation uses custom close codes to indicate specific error conditions:

| Code | Meaning | Reason |
|------|---------|--------|
| 4001 | Authentication Failure | Missing or invalid JWT token |
| 4002 | User Not Found/Inactive | User doesn't exist or account is disabled |
| 4003 | Authorization Failure | User doesn't own the requested entry |
| 4004 | Entry Not Found | The requested entry doesn't exist |
| 1011 | Server Error | Unexpected internal server error |

## Frontend Integration

### TypeScript/JavaScript Implementation

#### Basic WebSocket Connection

```typescript
/**
 * Connect to WebSocket endpoint with authentication
 */
function connectToReflectionStream(entryId: number, token: string): WebSocket {
  // Construct WebSocket URL with token in query parameter
  const wsUrl = `${getWebSocketBaseUrl()}/ws/reflections/${entryId}?token=${encodeURIComponent(token)}`;

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected successfully');
  };

  ws.onmessage = (event) => {
    console.log('Received:', event.data);
    // Handle streaming tokens here
    displayReflectionToken(event.data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = (event) => {
    handleWebSocketClose(event);
  };

  return ws;
}

/**
 * Handle WebSocket close events with error handling
 */
function handleWebSocketClose(event: CloseEvent) {
  switch (event.code) {
    case 4001:
      console.error('Authentication failed:', event.reason);
      // Redirect to login or refresh token
      handleAuthenticationFailure();
      break;

    case 4002:
      console.error('User not found or inactive:', event.reason);
      // User account issue - show error message
      showError('Your account is not accessible. Please contact support.');
      break;

    case 4003:
      console.error('Unauthorized access:', event.reason);
      // User tried to access someone else's entry
      showError('You do not have permission to access this entry.');
      break;

    case 4004:
      console.error('Entry not found:', event.reason);
      // Entry doesn't exist
      showError('The requested entry could not be found.');
      break;

    case 1011:
      console.error('Server error:', event.reason);
      // Internal server error
      showError('An unexpected error occurred. Please try again.');
      break;

    case 1000:
      console.log('WebSocket closed normally');
      // Normal closure - streaming completed
      break;

    default:
      console.warn('WebSocket closed with code:', event.code, event.reason);
  }
}

/**
 * Get WebSocket base URL based on environment
 */
function getWebSocketBaseUrl(): string {
  // In production
  if (window.location.protocol === 'https:') {
    return `wss://${window.location.host}`;
  }
  // In development
  return 'ws://localhost:8000';
}

/**
 * Get JWT token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('access_token');
}

/**
 * Handle authentication failure (e.g., expired token)
 */
function handleAuthenticationFailure() {
  // Clear invalid token
  localStorage.removeItem('access_token');
  // Redirect to login
  window.location.href = '/login';
}
```

#### React Hook Example

```typescript
import { useEffect, useRef, useState } from 'react';

interface UseReflectionStreamProps {
  entryId: number;
  token: string;
  enabled: boolean;
}

interface UseReflectionStreamResult {
  reflection: string;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useReflectionStream({
  entryId,
  token,
  enabled
}: UseReflectionStreamProps): UseReflectionStreamResult {
  const [reflection, setReflection] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsUrl = `ws://localhost:8000/ws/reflections/${entryId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      setReflection(prev => prev + event.data);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      setIsConnected(false);

      // Handle error codes
      if (event.code === 4001) {
        setError('Authentication failed. Please log in again.');
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      } else if (event.code === 4003) {
        setError('You do not have permission to access this entry.');
      } else if (event.code === 4004) {
        setError('Entry not found.');
      } else if (event.code === 4002) {
        setError('User account is not active.');
      } else if (event.code !== 1000) {
        setError(`Connection closed with code ${event.code}`);
      }
    };

    wsRef.current = ws;
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client initiated close');
      wsRef.current = null;
    }
  };

  useEffect(() => {
    if (enabled && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [entryId, token, enabled]);

  return {
    reflection,
    isConnected,
    error,
    connect,
    disconnect
  };
}
```

#### React Component Example

```typescript
import React from 'react';
import { useReflectionStream } from '../hooks/useReflectionStream';

interface ReflectionPanelProps {
  entryId: number;
}

export function ReflectionPanel({ entryId }: ReflectionPanelProps) {
  const token = localStorage.getItem('access_token') || '';
  const [enabled, setEnabled] = React.useState(false);

  const {
    reflection,
    isConnected,
    error,
    connect,
    disconnect
  } = useReflectionStream({
    entryId,
    token,
    enabled
  });

  const handleStartReflection = () => {
    setEnabled(true);
  };

  const handleStopReflection = () => {
    setEnabled(false);
    disconnect();
  };

  return (
    <div className="reflection-panel">
      <div className="controls">
        {!enabled ? (
          <button onClick={handleStartReflection}>
            Start Reflection
          </button>
        ) : (
          <button onClick={handleStopReflection} disabled={!isConnected}>
            Stop Reflection
          </button>
        )}
        {isConnected && <span className="status">Connected</span>}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="reflection-content">
        {reflection || 'Click "Start Reflection" to begin...'}
      </div>
    </div>
  );
}
```

## Testing the WebSocket Connection

### Manual Testing with Browser Console

```javascript
// Get your JWT token from localStorage
const token = localStorage.getItem('access_token');

// Replace with actual entry ID you own
const entryId = 1;

// Connect to WebSocket
const ws = new WebSocket(`ws://localhost:8000/ws/reflections/${entryId}?token=${token}`);

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', event.data);
ws.onerror = (error) => console.error('Error:', error);
ws.onclose = (event) => console.log('Closed:', event.code, event.reason);
```

### Testing Authentication Failures

```javascript
// Test 1: Missing token
const ws1 = new WebSocket('ws://localhost:8000/ws/reflections/1');
// Expected: Close code 4001

// Test 2: Invalid token
const ws2 = new WebSocket('ws://localhost:8000/ws/reflections/1?token=invalid');
// Expected: Close code 4001

// Test 3: Valid token, unauthorized entry (entry you don't own)
const ws3 = new WebSocket(`ws://localhost:8000/ws/reflections/999?token=${validToken}`);
// Expected: Close code 4003 or 4004
```

### Testing with curl/websocat

```bash
# Install websocat
brew install websocat  # macOS
# or
cargo install websocat  # If you have Rust installed

# Test with valid token
websocat "ws://localhost:8000/ws/reflections/1?token=YOUR_JWT_TOKEN"

# Test without token (should fail with 4001)
websocat "ws://localhost:8000/ws/reflections/1"
```

## Backend Implementation Details

### Authentication Function

The `authenticate_websocket()` helper function:
1. Checks if token is provided
2. Decodes JWT using `decode_access_token()` from `app/core/security.py`
3. Extracts `user_id` from token payload (`sub` claim)
4. Queries database for user and verifies `is_active` status
5. Returns `User` object or `None` (after closing WebSocket with error)

### Authorization Function

The `authorize_entry_access()` helper function:
1. Checks if entry exists
2. Compares `entry.user_id` with authenticated `user.id`
3. Returns `True` if authorized, `False` otherwise (after closing WebSocket)

### Database Session Management

The implementation ensures proper cleanup:
- Database session created at start of function
- `finally` block ensures `db.close()` is always called
- Connection manager cleanup wrapped in try/except to handle edge cases

## Security Considerations

1. **Token in Query Parameter**: WebSocket connections from browsers cannot set custom headers, so the token must be in the query parameter. This is standard practice but means tokens may appear in logs. Consider:
   - Short token expiration times (current: 30 minutes)
   - Secure WebSocket (WSS) in production
   - Log sanitization to remove tokens

2. **Error Message Details**: Error messages are descriptive enough for debugging but don't expose sensitive information like user IDs or internal system details.

3. **User Isolation**: All queries are scoped to the authenticated user's ID, preventing cross-user data access.

4. **Token Validation**: Full JWT validation including signature verification and expiration checks.

## Migration Notes

### For Existing Frontend Code

If you have existing WebSocket connections, update them to include the token:

**Before:**
```typescript
const ws = new WebSocket(`ws://localhost:8000/ws/reflections/${entryId}`);
```

**After:**
```typescript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/ws/reflections/${entryId}?token=${token}`);
```

### Handling Token Refresh

If your application refreshes tokens, ensure WebSocket reconnection:

```typescript
// Listen for token refresh events
window.addEventListener('token-refreshed', () => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.close();
    // Will automatically reconnect with new token via useEffect
  }
});
```

## Troubleshooting

### Connection Closes Immediately

- **Check token**: Ensure JWT token is valid and not expired
- **Check permissions**: Verify you own the entry you're trying to access
- **Check network**: Ensure WebSocket connection is not blocked by firewall/proxy

### "Authentication failed" Error

- Token is missing, invalid, or expired
- Solution: Log in again to get a fresh token

### "Unauthorized access" Error

- You're trying to access an entry that belongs to another user
- Solution: Verify the entry ID is correct

### "Entry not found" Error

- The entry ID doesn't exist in the database
- Solution: Check if entry was deleted or ID is incorrect

## Performance Considerations

- WebSocket connections are stateful; avoid opening multiple connections for the same entry
- Implement exponential backoff for reconnection attempts
- Clean up connections when components unmount
- Consider connection pooling for multiple entries

## Next Steps

1. Update all WebSocket client code to include authentication token
2. Implement proper error handling and user feedback
3. Add token refresh logic for long-lived connections
4. Test with various authentication scenarios
5. Monitor WebSocket connection metrics in production
