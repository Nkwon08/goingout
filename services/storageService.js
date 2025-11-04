// Storage service - handles image and video uploads to Firebase Storage
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

// Upload a single image
export const uploadImage = async (uri, userId, folder = 'posts') => {
  try {
    console.log('📤 Uploading image:', uri);
    console.log('📤 Storage object:', storage ? 'exists' : 'null');
    console.log('📤 Storage type:', typeof storage);
    console.log('📤 Storage keys:', storage && typeof storage === 'object' ? Object.keys(storage).length : 'not an object');
    
    // Check if Storage is configured
    if (!storage || typeof storage !== 'object') {
      console.error('❌ Firebase Storage not configured - storage is null or not an object');
      return { url: null, error: 'Firebase Storage not configured. Please check your Firebase configuration and restart the app: expo start --clear' };
    }

    // Check if storage is the fallback empty object (development mode)
    if (Object.keys(storage).length === 0) {
      console.error('❌ Firebase Storage not configured - empty object (development mode)');
      return { url: null, error: 'Firebase Storage not configured. Please check your Firebase configuration and restart the app: expo start --clear' };
    }

    // Create a reference to the file location
    const filename = `${folder}/${userId}/${Date.now()}.jpg`;
    
    try {
      const storageRef = ref(storage, filename);

      // Convert URI to blob (minimal logging for speed)
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Image file is empty or could not be read');
      }

      // Upload the blob (no progress logging for speed)
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Wait for upload to complete (minimal logging)
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null, // No progress tracking for speed
          (error) => {
            // Provide more helpful error messages
            let errorMessage = error.message || 'Failed to upload image';
            
            if (error.code === 'storage/unauthorized') {
              errorMessage = 'Storage permission denied. Please check Firebase Storage security rules.';
            } else if (error.code === 'storage/canceled') {
              errorMessage = 'Upload was canceled.';
            } else if (error.code === 'storage/unknown') {
              errorMessage = 'Unknown storage error. Please check your internet connection and Firebase configuration.';
            }
            
            reject(new Error(errorMessage));
          },
          () => {
            resolve();
          }
        );
      });

      // Get download URL (minimal logging for speed)
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      return { url: downloadURL, error: null };
    } catch (storageError) {
      console.error('❌ Storage operation error:', storageError);
      console.error('❌ Error code:', storageError.code);
      console.error('❌ Error message:', storageError.message);
      throw storageError;
    }
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return { url: null, error: error.message || 'Failed to upload image. Please check your internet connection and try again.' };
  }
};

// Upload multiple images
export const uploadImages = async (uris, userId, folder = 'posts') => {
  try {
    const uploadPromises = uris.map((uri) => uploadImage(uri, userId, folder));
    const results = await Promise.all(uploadPromises);

    const successful = results.filter((r) => r.url);
    const failed = results.filter((r) => r.error);

    return {
      urls: successful.map((r) => r.url),
      errors: failed.map((r) => r.error),
    };
  } catch (error) {
    return { urls: [], errors: [error.message] };
  }
};

