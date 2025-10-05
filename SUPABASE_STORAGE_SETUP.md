# Supabase Storage Setup for Alert Screenshots

## Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard
2. Click on **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `alert-screenshots`
   - **Public bucket**: ✅ **Enable** (so images can be viewed in the web app)
   - **File size limit**: 50 MB (optional)
   - **Allowed MIME types**: `image/jpeg, image/png, image/jpg` (optional)
5. Click **Create Bucket**

## Step 2: Configure Bucket Policies

After creating the bucket, you need to set up policies for public read access:

1. Click on the `alert-screenshots` bucket
2. Click on **Policies** tab
3. Add a new policy for **SELECT** (read):
   - **Policy name**: `Public read access`
   - **Allowed operation**: SELECT
   - **Policy definition**:
   ```sql
   (bucket_id = 'alert-screenshots')
   ```
4. Add a new policy for **INSERT** (upload):
   - **Policy name**: `Authenticated users can upload`
   - **Allowed operation**: INSERT
   - **Policy definition**:
   ```sql
   (bucket_id = 'alert-screenshots')
   ```

## Step 3: Quick SQL Setup (Alternative)

Alternatively, you can run this SQL in your Supabase SQL Editor:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('alert-screenshots', 'alert-screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'alert-screenshots');

-- Policy: Allow authenticated uploads
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'alert-screenshots');

-- Policy: Allow authenticated updates
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'alert-screenshots');

-- Policy: Allow authenticated deletes
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'alert-screenshots');
```

## Step 4: Verify Setup

1. Go back to **Storage** → `alert-screenshots`
2. Try uploading a test image manually
3. Click on the uploaded image
4. Click **Get URL** → **Public URL**
5. Copy the URL and open it in a new browser tab
6. If you can see the image, the bucket is configured correctly! ✅

## Troubleshooting

### Images not uploading
- Check browser console for errors (F12 → Console tab)
- Verify your `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct in `.env.local`
- Check that the bucket exists and is public

### Images not displaying
- Check the `snapshot_url` field in the `alerts` table
- Verify the URL is correct and accessible
- Check browser network tab (F12 → Network) for 403/404 errors
- Ensure the bucket has public read access enabled

### Getting 403 Forbidden errors
- The bucket might not be public
- The storage policies might be missing
- Run the SQL commands above to fix policies

## Test the Setup

After setting up the storage bucket, test it by:

1. Opening the Camera page at http://localhost:3001/camera
2. Clicking "Start Camera"
3. Triggering a fall detection or proximity alert
4. Checking the Alerts page to see if the screenshot appears
5. If not, check the browser console (F12) for error messages

---

**Note**: Screenshots are automatically captured when:
- A person is detected too close to a vehicle (< 400px) for 2+ seconds
- A person falls and stays down for 1.5+ seconds
- A headcount mismatch is detected