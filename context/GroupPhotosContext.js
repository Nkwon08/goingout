import * as React from 'react';
import { createContext, useContext, useState } from 'react';

const GroupPhotosContext = createContext();

export function GroupPhotosProvider({ children }) {
  const [groupPhotos, setGroupPhotos] = useState([]);

  const addPhoto = (photoUri) => {
    setGroupPhotos((prev) => [photoUri, ...prev]);
  };

  const addVideo = (videoUri) => {
    setGroupPhotos((prev) => [{ type: 'video', uri: videoUri }, ...prev]);
  };

  return (
    <GroupPhotosContext.Provider value={{ groupPhotos, addPhoto, addVideo }}>
      {children}
    </GroupPhotosContext.Provider>
  );
}

export function useGroupPhotos() {
  const context = useContext(GroupPhotosContext);
  if (!context) {
    throw new Error('useGroupPhotos must be used within GroupPhotosProvider');
  }
  return context;
}

