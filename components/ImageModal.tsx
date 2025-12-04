import React, { useState, useEffect } from 'react';
import { GeneratedImage } from '../types';

interface ImageModalProps {
  image: GeneratedImage | null;
  onClose: () => void;
  onEdit: (image: GeneratedImage, newPrompt: string) => void;
  isGenerating: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({ image, onClose, onEdit, isGenerating }) => {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (image) {
      setPrompt(image.prompt);
    }
  }, [image]);

  if (!image) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `coloring-page-${image.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditSubmit = () => {
      if (prompt.trim()) {
          onEdit(image, prompt);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm p-4" onClick={onClose}>
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-gray-500 hover:text-studio-accent transition-colors z-50 bg-white rounded-full shadow-md"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      <div className="relative max-w-6xl w-full h-[90vh] flex flex-col md:flex-row bg-white border border-pink-200 rounded-xl overflow-hidden shadow-2xl shadow-pink-200/50" onClick={(e) => e.stopPropagation()}>
         
         {/* Left: Image Area */}
         <div className="w-full md:w-2/3 h-1/2 md:h-full bg-gray-50 relative flex items-center justify-center p-4">
             <div className="bg-white p-2 shadow-lg rounded">
                <img 
                    src={image.url} 
                    alt={image.prompt} 
                    className="max-w-full max-h-full object-contain"
                />
             </div>
         </div>
         
         {/* Right: Details & Edit */}
         <div className="w-full md:w-1/3 h-1/2 md:h-full p-6 flex flex-col justify-between bg-white border-l border-pink-100">
             
             <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                 <div>
                    <h3 className="text-xl font-bold text-gray-800">Generation Details</h3>
                    <div className="flex space-x-2 mt-2">
                         <span className="px-2 py-1 bg-pink-50 text-xs rounded text-pink-600 uppercase font-bold border border-pink-100">{image.resolution}</span>
                         <span className="px-2 py-1 bg-pink-50 text-xs rounded text-pink-600 uppercase font-bold border border-pink-100">{image.printSize}</span>
                         <span className="px-2 py-1 bg-gray-50 text-xs rounded text-gray-500 uppercase border border-gray-200">{new Date(image.timestamp).toLocaleTimeString()}</span>
                    </div>
                 </div>

                 <div className="bg-pink-50/50 p-4 rounded-lg border border-pink-100">
                     <label className="text-xs text-studio-accent font-bold uppercase mb-2 block">Edit / Regenerate</label>
                     <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-white text-gray-700 text-sm p-3 rounded border border-pink-200 focus:border-studio-accent focus:outline-none resize-none h-32"
                        placeholder="Modify prompt to edit..."
                     />
                     <button
                        onClick={handleEditSubmit}
                        disabled={isGenerating || !prompt.trim()}
                        className={`mt-3 w-full py-2 rounded font-medium text-sm transition-all flex items-center justify-center ${
                            isGenerating 
                             ? 'bg-gray-100 text-gray-400 cursor-wait'
                             : 'bg-studio-accent text-white hover:bg-studio-accentHover shadow-md shadow-pink-200'
                        }`}
                     >
                         {isGenerating ? (
                             <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processing...
                             </>
                         ) : (
                             'Regenerate with Changes'
                         )}
                     </button>
                     <p className="text-[10px] text-gray-400 mt-2">
                         Uses this image as a visual reference.
                     </p>
                 </div>
             </div>

             <div className="pt-4 border-t border-pink-100">
                <button 
                    onClick={handleDownload}
                    className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors shadow-lg flex items-center justify-center space-x-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>Download PNG</span>
                </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default ImageModal;