# Firestore Indexes Guide

## Do You Need Indexes?

**Yes, you need ONE composite index** for storing and querying posts efficiently.

## Index Required for Posts Collection

### Index Needed: `posts` collection

**Query Pattern:**
- Filter by: `expiresAt > now`
- Order by: `createdAt` (descending)

This requires a **composite index** because you're filtering by one field (`expiresAt`) and ordering by another (`createdAt`).

## How to Create the Index

### Option 1: Automatic (Recommended - Easiest)

1. **Run your app** and try to view posts
2. When the query runs, Firestore will detect the missing index
3. **Check the console** - you'll see an error message with a link like:
   ```
   Firestore error. Please check your Firebase configuration or create an index:
   https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes?create_composite=...
   ```
4. **Click the link** - it will open Firebase Console with the index pre-configured
5. **Click "Create Index"** - Firestore will build the index automatically (takes 1-5 minutes)

### Option 2: Manual Creation

1. Go to [Firebase Console - Firestore Indexes](https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes)
2. Click **"Create Index"**
3. Configure:
   - **Collection ID:** `posts`
   - **Fields to index:**
     - Field: `expiresAt` → Mode: **Ascending**
     - Field: `createdAt` → Mode: **Descending**
   - **Query scope:** Collection
4. Click **"Create"**
5. Wait 1-5 minutes for the index to build

## Index Configuration Details

### Posts Collection Index

**Collection:** `posts`

**Fields:**
1. `expiresAt` - **Ascending** (for `where('expiresAt', '>', timestamp)`)
2. `createdAt` - **Descending** (for `orderBy('createdAt', 'desc')`)

**Query Scope:** Collection

## What Doesn't Need Indexes?

### ✅ No Index Needed For:

1. **Users Collection**
   - Uses `orderBy('__name__')` - document ID is always indexed
   - Simple queries don't need indexes

2. **Simple Queries**
   - Single `where()` clause
   - Single `orderBy()` on the same field as `where()`
   - Document lookups by ID

3. **Basic Writes**
   - Creating/updating documents doesn't need indexes
   - Only complex queries need indexes

## Index Building Status

After creating an index:
- **Status: Building** - Index is being created (1-5 minutes)
- **Status: Enabled** - Index is ready to use

You can still use your app while indexes are building, but queries that need the index will fail until it's ready.

## Verify Index is Created

1. Go to [Firebase Console - Firestore Indexes](https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes)
2. Look for an index on `posts` collection
3. Check that it has:
   - `expiresAt` (Ascending)
   - `createdAt` (Descending)

## Troubleshooting

### "Index not found" error
- Make sure the index is created and enabled
- Wait for the index to finish building (check status in Console)

### "Index still building" error
- Wait 1-5 minutes for the index to build
- Check the status in Firebase Console

### Query works but is slow
- Make sure the index includes all fields used in the query
- Check that the index is enabled (not still building)

## Summary

**You only need ONE index:**
- **Collection:** `posts`
- **Fields:** `expiresAt` (Ascending), `createdAt` (Descending)
- **How to create:** Use the automatic link from error message, or create manually in Firebase Console

Everything else (users, usernames, groups) works without indexes!

