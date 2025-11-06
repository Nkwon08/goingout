# Firestore Index Verification

## Your Current Index

**Collection:** `posts`  
**Fields:** `expiresAt`, `createdAt`, `__name__`  
**Status:** Enabled ✅

## Issue: Index Field Order

Based on your query:
```javascript
where('expiresAt', '>', timestamp)  // Range query on expiresAt
orderBy('createdAt', 'desc')       // Order by createdAt
```

**Firestore Rule:** When you have a range query (`>`, `<`, `>=`, `<=`) on one field and `orderBy` on another field, the **orderBy field must come FIRST** in the index.

## Correct Index Order

The index should have fields in this order:
1. **`createdAt`** (Ascending) - **FIRST** (this is the orderBy field)
2. **`expiresAt`** (Ascending) - **SECOND** (this is the range query field)
3. **`__name__`** (Ascending) - **THIRD** (automatic tiebreaker)

## What to Do

### Option 1: Delete and Recreate (Recommended)

1. Go to [Firebase Console - Firestore Indexes](https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes)
2. Find the index with ID `CICAgOjXh4EK`
3. **Delete** it (click the trash icon)
4. **Create new index** with this exact configuration:
   - Collection: `posts`
   - Fields (in this order):
     - Field 1: `createdAt` → Mode: **Ascending**
     - Field 2: `expiresAt` → Mode: **Ascending**
     - Field 3: `__name__` → Mode: **Ascending** (if not auto-added)
   - Query scope: Collection
5. Click **"Create"**
6. Wait 1-5 minutes for the index to build

### Option 2: Use the Automatic Link

1. Run your app and try to view posts
2. When the error appears, click the **automatic index creation URL** in the error message
3. This will create the index with the correct field order automatically

## Why Order Matters

Firestore uses indexes to efficiently query data. When you have:
- Range query on `expiresAt` (`where('expiresAt', '>', ...)`)
- Order by `createdAt` (`orderBy('createdAt', 'desc')`)

Firestore needs to:
1. First sort by `createdAt` (the orderBy field)
2. Then filter by `expiresAt` (the range query field)

So `createdAt` must come first in the index.

## Verification

After recreating the index:
1. Check that Status is **"Enabled"** (not "Building")
2. Try querying posts in your app
3. The error should be gone

## Summary

**Delete your current index and create a new one with this exact order:**
1. `createdAt` (Ascending) - **FIRST**
2. `expiresAt` (Ascending) - **SECOND**
3. `__name__` (Ascending) - **THIRD**

