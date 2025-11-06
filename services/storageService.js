// Storage service - handles image and video uploads to Firebase Storage
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { auth } from '../config/firebase';

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

    // Verify user is authenticated
    if (!auth || !auth.currentUser) {
      console.error('❌ User not authenticated - cannot upload to Storage');
      return { url: null, error: 'User not authenticated. Please log in and try again.' };
    }
    
    // Verify userId matches authenticated user
    if (auth.currentUser.uid !== userId) {
      console.error('❌ User ID mismatch:', { currentUser: auth.currentUser.uid, providedUserId: userId });
      return { url: null, error: 'User ID mismatch. Please log in again.' };
    }
    
    console.log('✅ User authenticated:', auth.currentUser.uid);
    
    // Create a reference to the file location
    const filename = `${folder}/${userId}/${Date.now()}.jpg`;
    
    // Log bucket information for debugging
    try {
      // Try to get bucket from various locations
      const bucketFromStorage = storage._delegate?.bucket || storage.bucket || storage._delegate?.host || null;
      const bucketFromApp = storage._delegate?.app?.options?.storageBucket || 
                           storage.app?.options?.storageBucket || 
                           (typeof storage === 'object' && storage._app?.options?.storageBucket) || null;
      
      console.log('📤 Storage bucket (from storage):', bucketFromStorage || 'unknown');
      console.log('📤 Storage bucket (from app):', bucketFromApp || 'unknown');
      console.log('📤 Expected bucket:', 'goingout-8b2e0.firebasestorage.app');
      console.log('📤 Upload path:', filename);
      console.log('📤 User ID:', userId);
      console.log('📤 Storage object keys:', Object.keys(storage).slice(0, 10));
    } catch (e) {
      console.log('📤 Could not log bucket info:', e.message);
    }
    
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
        // Set up error handler first
        const errorHandler = (error) => {
            // Log full error object for debugging
            console.error('❌ Upload task error:', error);
            console.error('❌ Error keys:', error ? Object.keys(error) : 'no error object');
            console.error('❌ Error code:', error?.code);
            console.error('❌ Error message:', error?.message);
            console.error('❌ Error serverResponse:', error?.serverResponse);
            console.error('❌ Error customData:', error?.customData);
            console.error('❌ Error status_:', error?.status_);
            
            // Try to extract server response from customData or status_
            let serverResponseText = null;
            if (error?.customData?.serverResponse) {
              serverResponseText = error.customData.serverResponse;
              console.error('❌ Server response from customData:', serverResponseText);
            }
            if (error?.status_ && !serverResponseText) {
              serverResponseText = error.status_;
              console.error('❌ Server response from status_:', serverResponseText);
            }
            
            // Provide more helpful error messages based on error code
            let errorMessage = 'Failed to upload image';
            
            if (error?.code) {
              switch (error.code) {
                case 'storage/unauthorized':
                  errorMessage = 'Storage permission denied. Please check Firebase Storage security rules.';
                  if (serverResponseText) {
                    errorMessage += ` Server response: ${serverResponseText}`;
                  }
                  break;
                case 'storage/canceled':
                  errorMessage = 'Upload was canceled.';
                  break;
                case 'storage/unknown':
                  // For unknown errors, check server response for more details
                  if (serverResponseText) {
                    // Check if it's a 404 error (bucket not found/not enabled)
                    if (serverResponseText === '404' || serverResponseText === 404 || String(serverResponseText).includes('404')) {
                      errorMessage = 'Firebase Storage bucket not found (404). Firebase Storage may not be enabled. Go to Firebase Console → Storage → Get Started to enable Storage, then update your Storage security rules.';
                    } else {
                      errorMessage = `Storage error: ${serverResponseText}. Please check Firebase Storage security rules.`;
                    }
                  } else {
                    errorMessage = 'Unknown storage error. This usually means Firebase Storage security rules are blocking the upload. Please check your Storage rules in Firebase Console.';
                  }
                  break;
                case 'storage/invalid-argument':
                  errorMessage = 'Invalid file or path. Please try again.';
                  break;
                case 'storage/not-found':
                  errorMessage = 'Storage bucket not found (404). This usually means Firebase Storage is not enabled in your Firebase Console. Go to Firebase Console → Storage → Get Started to enable Storage.';
                  break;
                case 'storage/quota-exceeded':
                  errorMessage = 'Storage quota exceeded. Please contact support.';
                  break;
                case 'storage/unauthenticated':
                  errorMessage = 'User not authenticated. Please log in again.';
                  break;
                default:
                  errorMessage = error.message || `Upload failed: ${error.code}`;
                  if (serverResponseText) {
                    errorMessage += ` Server response: ${serverResponseText}`;
                  }
              }
            } else if (error?.message) {
              // If error has message but no code, use the message
              errorMessage = error.message;
              if (serverResponseText) {
                errorMessage += ` Server response: ${serverResponseText}`;
              }
            } else {
              // Fallback for unknown error format
              errorMessage = 'Upload failed. Please check your internet connection and Firebase Storage security rules.';
            }
            
          reject(new Error(errorMessage));
        };

        // Set up success handler
        const successHandler = () => {
          resolve();
        };

        // Attach listeners
        uploadTask.on(
          'state_changed',
          null, // No progress tracking for speed
          errorHandler,
          successHandler
        );
      });

      // Verify upload completed successfully
      if (uploadTask.snapshot.state !== 'success') {
        throw new Error(`Upload did not complete successfully. State: ${uploadTask.snapshot.state}`);
      }

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

