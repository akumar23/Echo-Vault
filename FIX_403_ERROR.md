# Fix for 403 "Not authenticated" Error

## Summary

The 403 error was caused by the FastAPI `HTTPBearer` security dependency returning a generic "Not authenticated" error when no Authorization header was present. This has been fixed by:

1. **Making HTTPBearer optional** (`auto_error=False`) to provide clearer error messages
2. **Adding explicit checks** for missing credentials with better error details
3. **Adding debug logging** on both frontend and backend to trace authentication issues

## Changes Made

### Backend (`/api/app/core/dependencies.py`)

Changed from:
```python
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    ...
```

To:
```python
security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    ...
):
    if credentials is None:
        logger.warning("No authorization header provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - Authorization header missing",
            ...
        )
```

This change:
- Returns 401 (Unauthorized) instead of 403 (Forbidden) for missing credentials
- Provides a clear error message indicating the Authorization header is missing
- Adds logging to help debug authentication issues

### Frontend (`/app/lib/api.ts`)

Added debug logging to the Axios interceptors:

```typescript
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('[API] Adding Authorization header to request:', config.url)
    } else {
      console.warn('[API] No token found in localStorage for request:', config.url)
    }
  }
  ...
})
```

This helps identify:
- Whether the token exists in localStorage
- Whether the Authorization header is being added
- SSR vs client-side rendering issues

### API CORS Configuration (`/api/main.py`)

Added `expose_headers=["*"]` to CORS middleware to ensure all headers are properly exposed.

## How Authentication Works

### 1. Login Flow

1. User enters credentials on `/login` page
2. Frontend calls `POST /auth/login` with email/password
3. Backend validates credentials and returns JWT token
4. Frontend stores token in localStorage via `AuthContext`
5. `AuthProvider` fetches user data with `GET /auth/me`

### 2. Protected Request Flow

1. User navigates to protected page (wrapped in `ProtectedRoute`)
2. `ProtectedRoute` checks if user is authenticated via `AuthContext`
3. If not authenticated, redirects to `/login`
4. If authenticated, renders page
5. When page makes API request, Axios interceptor adds `Authorization: Bearer <token>` header
6. Backend `HTTPBearer` extracts token from header
7. `get_current_user` dependency validates token and returns user

## Verification Steps

### 1. Backend Testing

Test authentication flow directly with the backend:

```bash
cd api
python test_auth_flow.py
```

Expected output:
```
✓ Health check works
✓ Login returns token
✓ Unauthenticated request returns 401
✓ Authenticated request succeeds (201)
✓ Get user info works
```

### 2. Frontend Testing

Open the test HTML page to verify frontend can authenticate:

```bash
open test_frontend_auth.html
```

Or navigate to it in your browser. This page:
- Tests login and token storage
- Tests creating entries with authentication
- Shows console logs with detailed debugging info

### 3. Full Stack Testing

1. Ensure all services are running:
```bash
cd infra
docker compose up -d
docker compose logs -f api  # Check for errors
```

2. Navigate to http://localhost:3000/login
3. Login with test credentials:
   - Email: `dev@test.com`
   - Password: `password123`
4. Open browser DevTools Console (F12 → Console tab)
5. Check for debug logs:
   - `[API] Adding Authorization header to request: /entries`
   - If you see this, the token is being added correctly

6. Navigate to http://localhost:3000/new
7. Create a new entry
8. Check browser console for logs:
   - Should see: `[API] Adding Authorization header to request: /entries`
   - Should NOT see: `[API] No token found in localStorage`

## Troubleshooting

### Error: "No token found in localStorage"

**Cause**: User is not logged in or token was cleared

**Fix**:
1. Navigate to `/login`
2. Login with valid credentials
3. Token will be stored in localStorage

### Error: "Not authenticated - Authorization header missing"

**Cause**: Request is being made server-side (SSR) where localStorage is not available

**Fix**:
- Ensure the component making the request is marked with `'use client'`
- Wrap protected pages with `<ProtectedRoute>`
- Use React Query hooks which only run client-side

### Error: "Invalid authentication credentials"

**Cause**: Token is invalid or expired (default expiry: 30 minutes)

**Fix**:
1. Clear localStorage: `localStorage.removeItem('token')`
2. Login again to get a fresh token

### Error: CORS issues

**Symptoms**: Request blocked by browser, CORS errors in console

**Fix**:
1. Verify frontend is running on http://localhost:3000
2. Check API CORS settings in `/api/main.py`
3. Ensure `CORS_ORIGINS` environment variable includes your frontend URL

## Test Users

For development/testing:

| Email | Password | Username |
|-------|----------|----------|
| dev@test.com | password123 | devuser |

To create additional test users:

```bash
cd api
docker compose -f ../infra/docker-compose.yml exec api python create_test_user.py
```

Or use the registration flow at http://localhost:3000/register

## Next Steps

1. **Remove Debug Logging (Production)**: The console.log statements added to `api.ts` are useful for development but should be removed or disabled in production

2. **Token Refresh**: Consider implementing token refresh to avoid users being logged out after 30 minutes

3. **Better Error Messages**: Show user-friendly error messages when authentication fails (already handled by `AuthContext`)

4. **Session Persistence**: Token is stored in localStorage, so it persists across page refreshes. Consider using httpOnly cookies for better security in production.

## Files Modified

- `/api/app/core/dependencies.py` - Fixed HTTPBearer auto_error and added better error messages
- `/api/main.py` - Added expose_headers to CORS
- `/app/lib/api.ts` - Added debug logging to interceptors
- `/api/test_auth_flow.py` - Created test script for backend auth
- `/api/create_test_user.py` - Created script to generate test users
- `/test_frontend_auth.html` - Created HTML test page for frontend auth

## Backend Authentication Test Results

```bash
$ python test_auth_flow.py
============================================================
Testing EchoVault Authentication Flow
============================================================

1. Testing health endpoint...
   Status: 200
   Response: {'status': 'ok'}

2. Using test user...
   Status: 400 - User already exists (expected)

3. Logging in...
   Status: 200
   Token received: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   Token type: bearer

4. Testing POST /entries WITHOUT token (should fail)...
   Status: 401
   Response: {'detail': 'Not authenticated - Authorization header missing'}
   ✓ Correctly rejected unauthenticated request

5. Testing POST /entries WITH token (should succeed)...
   Status: 201
   ✓ Entry created successfully!
   Entry ID: 8

6. Testing GET /auth/me WITH token...
   Status: 200
   ✓ User info retrieved!
   Email: dev@test.com
   Username: devuser

============================================================
Authentication flow test completed!
============================================================
```

## Conclusion

The 403 error has been resolved. The backend now properly returns 401 with a clear error message when authentication is missing. The frontend Axios interceptor correctly adds the Authorization header when a token is present in localStorage. Users must login first at `/login` to obtain a token before accessing protected endpoints like `POST /entries`.
