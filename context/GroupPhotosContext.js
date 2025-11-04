// Group photos context - manages shared photos/videos for groups
import * as React from 'react';
import { createContext, useContext, useState } from 'react';

const GroupPhotosContext = createContext();

// Provider component - manages group photos state
export function GroupPhotosProvider({ children }) {
  // Store array of photo URIs and video objects
  const [groupPhotos, setGroupPhotos] = useState([]);

  // Add a photo to the group photos list
  const addPhoto = (photoUri) => {
    setGroupPhotos((prev) => [photoUri, ...prev]);
  };

  // Add a video to the group photos list
  const addVideo = (videoUri) => {
    setGroupPhotos((prev) => [{ type: 'video', uri: videoUri }, ...prev]);
  };

  return (
    <GroupPhotosContext.Provider value={{ groupPhotos, addPhoto, addVideo }}>
      {children}
    </GroupPhotosContext.Provider>
  );
}

// Hook to use group photos context in components
export function useGroupPhotos() {
  const context = useContext(GroupPhotosContext);
  if (!context) {
    throw new Error('useGroupPhotos must be used within GroupPhotosProvider');
  }
  return context;
}

