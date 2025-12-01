# WebSocket Authentication - Quick Reference

## For Frontend Developers

### Connecting to WebSocket

```typescript
// Get token from localStorage
const token = localStorage.getItem('access_token');

// Connect with authentication
const ws = new WebSocket(
  `ws://localhost:8000/ws/reflections/${entryId}?token=${token}`
);
```

### Error Codes

| Code | Fix |
|------|-----|
| 4001 | Log in again (invalid/expired token) |
| 4002 | User account inactive - contact support |
| 4003 | You don't own this entry |
| 4004 | Entry doesn't exist |

### React Hook (Copy-Paste Ready)

```typescript
import { useEffect, useRef, useState } from 'react';

export function useReflectionStream(entryId: number, token: string) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:8000/ws/reflections/${entryId}?token=${token}`
    );

    ws.onmessage = (e) => setText(prev => prev + e.data);

    ws.onclose = (e) => {
      if (e.code === 4001) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      } else if (e.code === 4003) {
        setError('Unauthorized access');
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [entryId, token]);

  return { text, error };
}
```

## For Backend Developers

### Testing Authentication

```bash
# Valid connection (replace YOUR_TOKEN and ENTRY_ID)
websocat "ws://localhost:8000/ws/reflections/ENTRY_ID?token=YOUR_TOKEN"

# Should fail with 4001 (no token)
websocat "ws://localhost:8000/ws/reflections/1"
```

### Running Tests

```bash
cd api
pytest tests/test_websocket.py -v
```

### Close Codes Reference

```python
4001  # Authentication failure
4002  # User not found/inactive
4003  # Not authorized (doesn't own entry)
4004  # Entry not found
1011  # Server error
```

## Quick Troubleshooting

**Problem:** Connection closes immediately
**Solution:** Check that JWT token is valid and not expired

**Problem:** "Unauthorized access" error
**Solution:** Verify you own the entry you're trying to access

**Problem:** Tests failing
**Solution:** Ensure test database is set up and Ollama service is mocked

## Security Checklist

- ✅ Token passed in query parameter (not headers - WebSocket limitation)
- ✅ Token validated on every connection
- ✅ User ownership verified before streaming
- ✅ No sensitive data in error messages
- ✅ Database sessions properly cleaned up
- ✅ Connection manager cleanup in finally block

## Need More Info?

- Full Guide: `/docs/WEBSOCKET_AUTH_GUIDE.md`
- Implementation Details: `/docs/SECURITY_FIX_SUMMARY.md`
- Test Suite: `/api/tests/test_websocket.py`
- Source Code: `/api/app/websocket.py`
