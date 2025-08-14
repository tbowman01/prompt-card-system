# Fix for better-sqlite3 "database connection is not open" Error

## Issue Summary
Fixes the `TypeError: The database connection is not open` error that occurs in the hive-mind session manager when attempting to perform database operations after the connection has been closed.

## Root Cause Analysis

**Error Location:**
- File: `src/cli/simple-commands/hive-mind/session-manager.js`
- Method: `removeChildPid()` at line 932
- Also affects: `addChildPid()` and `getChildPids()` methods

**Root Cause:**
The methods attempt to call `this.db.prepare()` without checking if the database connection is still open. This commonly occurs during:
- Session cleanup operations (Ctrl+C to stop)
- Process termination scenarios
- Race conditions during shutdown

## Solution Implementation

### 1. Database Connection Validation
Added connection state checks before database operations:

```javascript
// Check if database connection is still open
if (!this.db) {
  console.warn('Database connection not available for [operation] operation');
  return false;
}
```

### 2. Graceful Error Handling
Wrapped database operations in try-catch blocks with specific handling for connection errors:

```javascript
try {
  // Database operations...
} catch (error) {
  if (error.message.includes('database connection is not open') || error.message.includes('database is closed')) {
    console.warn(`Database connection closed during [operation] operation: ${error.message}`);
    return false;
  }
  // Re-throw other errors
  throw error;
}
```

### 3. Methods Fixed
- **`removeChildPid(sessionId, pid)`** - Line 932 (original error location)
- **`addChildPid(sessionId, pid)`** - Line 889 (preventive fix)
- **`getChildPids(sessionId)`** - Line 981 (preventive fix)

## Testing Results

✅ **Before Fix:**
```
TypeError: The database connection is not open
    at Database.prepare (/home/tbowman/.nvm/versions/node/v22.18.0/lib/node_modules/claude-flow/node_modules/better-sqlite3/lib/methods/wrappers.js:5:21)
    at HiveMindSessionManager.removeChildPid (file:///home/tbowman/.nvm/versions/node/v22.18.0/lib/node_modules/claude-flow/src/cli/simple-commands/hive-mind/session-manager.js:932:29)
```

✅ **After Fix:**
- `hive-mind init` - ✅ Works
- `hive-mind spawn` - ✅ Works  
- `hive-mind stop` - ✅ Works without errors
- Session cleanup - ✅ Graceful handling
- Ctrl+C termination - ✅ No more crashes

## Files Changed
- `src/cli/simple-commands/hive-mind/session-manager.js`

## Impact
- **Fixes:** Critical crash during session cleanup
- **Improves:** Session lifecycle management robustness  
- **Maintains:** Full backward compatibility
- **Adds:** Graceful degradation for closed connections

## How to Apply

### Option 1: Direct File Edit
Apply the changes shown in the patch file to the three methods mentioned above.

### Option 2: Patch File
Use the provided patch file `better-sqlite3-fix.patch`:
```bash
git apply better-sqlite3-fix.patch
```

## Verification Steps
1. Initialize hive-mind: `claude-flow hive-mind init`
2. Spawn a session: `claude-flow hive-mind spawn "test"`
3. Stop with Ctrl+C or: `claude-flow hive-mind stop [session-id]`
4. Verify no "database connection is not open" errors occur

This fix ensures the hive-mind system handles database connection lifecycle properly and degrades gracefully when connections are closed during cleanup operations.