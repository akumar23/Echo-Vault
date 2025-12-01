# Quick Fix Guide: 403 "Not authenticated" Error

## The Problem

You were getting a 403 error when trying to create entries because the user was not logged in and the token was not being sent with the request.

## The Solution

### 1. Backend Fix (Already Applied)

Changed HTTPBearer to provide clearer error messages:
- Changed 403 → 401 for missing auth
- Added clear error: "Not authenticated - Authorization header missing"
- Added logging to debug auth issues

### 2. What You Need to Do

**Login first before creating entries!**

1. Navigate to http://localhost:3000/login
2. Use these test credentials:
   - **Email:** `dev@test.com`
   - **Password:** `password123`
3. After successful login, you'll be redirected to the home page
4. Now navigate to http://localhost:3000/new
5. Create your entry - it should work now!

### 3. How to Verify It's Working

**Option A: Check Browser Console (Recommended)**

1. Open DevTools (F12 or right-click → Inspect)
2. Go to Console tab
3. Try creating an entry
4. Look for these logs:
   ```
   [API] Adding Authorization header to request: /entries
   ```
   ✓ If you see this, auth is working!

**Option B: Check localStorage**

1. Open DevTools (F12)
2. Go to Application tab → Storage → Local Storage → http://localhost:3000
3. Look for key `token`
4. If it exists and has a value, you're logged in

**Option C: Use the Test Page**

Open `/test_frontend_auth.html` in your browser:
1. Click "Login"
2. Click "Check Token in localStorage"
3. Click "Create Entry"
4. Check the console logs at the bottom

### 4. Common Issues

**Issue: "No token found in localStorage"**
- Solution: You need to login first at `/login`

**Issue: Still getting 401/403 errors after login**
- Solution: Clear your localStorage and login again:
  1. Open DevTools → Console
  2. Run: `localStorage.clear()`
  3. Refresh page and login again

**Issue: Token expired**
- Solution: Tokens expire after 30 minutes. Just login again.

## Files Changed

The following files have been modified to fix the issue:

1. `/api/app/core/dependencies.py` - Better auth error handling
2. `/api/main.py` - Enhanced CORS configuration
3. `/app/lib/api.ts` - Added debug logging

All changes are backward compatible and don't break existing functionality.

## Restart Services (if needed)

If changes aren't taking effect:

```bash
cd infra
docker compose restart api web
```

Wait ~10 seconds for services to restart, then try again.

## Test Everything Works

Run the backend test:
```bash
cd api
python test_auth_flow.py
```

Expected: All tests pass with ✓ checkmarks

## Summary

The 403 error occurred because:
1. User was not logged in
2. No JWT token in localStorage
3. No Authorization header sent to backend
4. Backend rejected the request

Now fixed by:
1. Backend gives clearer error messages (401 instead of 403)
2. Added debug logging to track auth flow
3. Created test credentials for easy login
4. Documentation on proper flow: login → then create entries

**Bottom line:** Just login first at http://localhost:3000/login with `dev@test.com` / `password123`, then you can create entries!
