import React from 'react';
import { GeneratedImage } from '../types';

interface GalleryProps {
  images: GeneratedImage[];
  onImageClick: (img: GeneratedImage) => void;
  onDownloadAll: () => void;
  onClearHistory: () => void;
  onDeleteSelected: () => void;
  onDeleteImage: (id: string) => void;
  selectedIds: Set<string>; 
  onToggleSelect: (id: string) => void; 
  onToggleSelectAll: () => void; 
}

const Gallery: React.FC<GalleryProps> = ({ 
  images, 
  onImageClick, 
  onDownloadAll,
  onClearHistory, 
  onDeleteSelected,
  onDeleteImage,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll
}) => {
  if (images.length === 0) return null;

  const handleDownload = (e: React.MouseEvent, img: GeneratedImage) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = img.url;
    link.download = `coloring-page-${img.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      onDeleteImage(id);
  };
  
  const handleCheckboxClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onToggleSelect(id);
  };

  const allSelected = images.length > 0 && selectedIds.size === images.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="mt-12 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-pink-200 pb-4 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-black flex items-center">
            Gallery 
            {hasSelection && <span className="ml-3 text-base px-3 py-1 bg-studio-accent text-white rounded-full shadow-sm">{selectedIds.size} Selected</span>}
        </h2>
        <div className="flex items-center space-x-3">
            {/* Selection Toolbar */}
            <button 
                onClick={onToggleSelectAll}
                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-pink-200 hover:border-pink-400 bg-white text-gray-700 transition-colors mr-2"
            >
                {allSelected ? 'Deselect All' : 'Select All'}
            </button>

            {/* Download Local */}
            <button 
                onClick={onDownloadAll}
                className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium rounded-lg flex items-center space-x-2 transition-colors border border-gray-200"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="hidden sm:inline">Zip All</span>
            </button>

             {/* Clear / Delete Selected */}
             <button 
                onClick={hasSelection ? onDeleteSelected : onClearHistory}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg flex items-center transition-colors border ${
                    hasSelection 
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200' 
                    : 'bg-white hover:bg-red-50 text-red-400 border-red-100'
                }`}
                title={hasSelection ? `Delete ${selectedIds.size} Selected` : "Delete ALL Images"}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {hasSelection && <span className="ml-2 hidden sm:inline">Delete Selected</span>}
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((img) => {
          const isSelected = selectedIds.has(img.id);
          return (
            <div 
                key={img.id} 
                className={`group relative bg-white rounded-xl overflow-hidden border transition-all hover:shadow-xl ${
                    isSelected 
                    ? 'border-studio-accent ring-2 ring-studio-accent shadow-pink-200' 
                    : 'border-pink-100 hover:border-pink-300 shadow-sm'
                }`}
            >
                {/* SELECTION CHECKBOX - Always visible on top-left */}
                <div 
                    onClick={(e) => handleCheckboxClick(e, img.id)}
                    className="absolute top-2 left-2 z-[60] cursor-pointer"
                >
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors shadow-sm ${
                        isSelected 
                        ? 'bg-studio-accent border-studio-accent' 
                        : 'bg-white border-gray-400 hover:border-studio-accent'
                    }`}>
                        {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                </div>

                {/* DELETE BUTTON */}
                <button 
                    onClick={(e) => handleDelete(e, img.id)}
                    className="absolute top-2 right-2 z-[60] p-2 bg-white text-red-500 rounded hover:bg-red-50 transition-colors shadow-md border border-red-100 opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Delete Image"
                >
                    <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>

                {/* Clickable Area for Modal */}
                <div 
                    onClick={() => onImageClick(img)}
                    className="cursor-zoom-in relative z-10"
                >
                    <div className="aspect-square w-full bg-white flex items-center justify-center">
                    <img 
                        src={img.url} 
                        alt={img.prompt} 
                        loading="lazy"
                        className="max-w-full max-h-full object-contain"
                    />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-pink-100 z-20 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <div className="flex justify-between items-end">
                            <div className="w-3/4">
                                <p className="text-black font-semibold text-sm truncate">{img.prompt}</p>
                                <p className="text-gray-500 text-xs font-mono mt-0.5 uppercase flex items-center space-x-1">
                                    <span>{img.printSize}</span>
                                    <span className="text-studio-accent">• {img.resolution}</span>
                                </p>
                            </div>
                            <button 
                                onClick={(e) => handleDownload(e, img)}
                                className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-studio-accent hover:text-white transition-colors"
                                title="Download"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Gallery;