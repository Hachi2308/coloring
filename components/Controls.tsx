import React, { useRef, useState } from 'react';
import { PrintSize, GenerationConfig, Resolution, ColorPalette, StyleDefinition, FrameStyle } from '../types';

interface ControlsProps {
  config: GenerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
  onGenerate: () => void;
  onStop?: () => void;
  isGenerating: boolean;
  uploadedImages: string[];
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  batchPrompts: string[];
  setBatchPrompts: (prompts: string[]) => void;
  selectedCount?: number;
  palettes: ColorPalette[];
  onDeletePalette: (id: string) => void;
  onSavePalette: (palette: ColorPalette) => void;
  onBatchUpscale: (resolution: Resolution) => void;
  onBatchColorize: () => void;
  onBatchDecolorize: () => void;
  styles: StyleDefinition[];
  onSaveStyle: (style: StyleDefinition) => void;
  onUpdateStyle: (style: StyleDefinition) => void;
  onDeleteStyle: (id: string) => void;
  onToggleStyleVisibility: (id: string) => void;
}

// Helper: Convert Hex to RGB
const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.substring(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

// Helper: Calculate Euclidean distance between two colors
const getColorDistance = (c1: string, c2: string) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return Math.sqrt(Math.pow(rgb2.r - rgb1.r, 2) + Math.pow(rgb2.g - rgb1.g, 2) + Math.pow(rgb2.b - rgb1.b, 2));
};

const Controls: React.FC<ControlsProps> = ({ 
  config, 
  setConfig, 
  onGenerate, 
  onStop,
  isGenerating,
  uploadedImages,
  setUploadedImages,
  batchPrompts,
  setBatchPrompts,
  selectedCount = 0,
  palettes,
  onDeletePalette,
  onSavePalette,
  onBatchUpscale,
  onBatchColorize,
  onBatchDecolorize,
  styles,
  onSaveStyle,
  onUpdateStyle,
  onDeleteStyle,
  onToggleStyleVisibility
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paletteFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'settings'>('studio');
  
  // Palette Creation State
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [newPaletteName, setNewPaletteName] = useState('New Palette');
  const [isCreatingPalette, setIsCreatingPalette] = useState(false);

  // Style Creation State
  const [newStyle, setNewStyle] = useState<Partial<StyleDefinition>>({
      label: 'New Style', icon: '🎨', desc: 'Custom Style', instruction: '', negativePrompt: ''
  });
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);

  // --- HANDLERS ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      files.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setUploadedImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(file);
      });
    }
  };

  const removeUploadedImage = (index: number) => {
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaletteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  extractColors(img);
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const extractColors = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 100; // Resize for performance
      canvas.height = 100 * (img.height / img.width);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorCounts: { [key: string]: number } = {};

      for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          // Simple quantization to reduce noise
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      // Sort by frequency
      const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
      
      // Select 10 distinct colors using distance metric
      const distinctColors: string[] = [];
      
      for (const color of sortedColors) {
          if (distinctColors.length >= 10) break;
          
          let isTooSimilar = false;
          for (const existing of distinctColors) {
              if (getColorDistance(color, existing) < 40) { // Threshold for similarity
                  isTooSimilar = true;
                  break;
              }
          }
          
          if (!isTooSimilar) {
              distinctColors.push(color);
          }
      }

      // Fill remaining spots if needed (fallback)
      let idx = 0;
      while (distinctColors.length < 10 && idx < sortedColors.length) {
           if (!distinctColors.includes(sortedColors[idx])) distinctColors.push(sortedColors[idx]);
           idx++;
      }

      setExtractedColors(distinctColors);
      setIsCreatingPalette(true);
  };

  const handleSaveExtractedPalette = () => {
      const newPalette: ColorPalette = {
          id: `custom-${Date.now()}`,
          name: newPaletteName,
          colors: extractedColors,
          isCustom: true
      };
      onSavePalette(newPalette);
      setIsCreatingPalette(false);
      setExtractedColors([]);
      setNewPaletteName('New Palette');
  };

  const handleEditStyle = (style: StyleDefinition) => {
      setNewStyle(style);
      setEditingStyleId(style.id);
      setActiveTab('settings');
      // Scroll to form
      const form = document.getElementById('style-form');
      if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveStyleForm = () => {
      if (!newStyle.label || !newStyle.instruction) return;
      
      const stylePayload: StyleDefinition = {
          id: editingStyleId || `style-${Date.now()}`,
          label: newStyle.label || 'Custom',
          icon: newStyle.icon || '🎨',
          desc: newStyle.desc || '',
          instruction: newStyle.instruction,
          negativePrompt: newStyle.negativePrompt,
          isCustom: true,
          isVisible: true
      };

      if (editingStyleId) {
          onUpdateStyle(stylePayload);
      } else {
          onSaveStyle(stylePayload);
      }
      
      setNewStyle({ label: 'New Style', icon: '🎨', desc: 'Custom Style', instruction: '', negativePrompt: '' });
      setEditingStyleId(null);
  };

  const isBatchMode = selectedCount > 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-pink-200 shadow-sm relative z-20">
      {/* TABS */}
      <div className="flex border-b border-pink-100">
        <button 
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-3 text-sm font-bold tracking-wide uppercase transition-colors ${activeTab === 'studio' ? 'text-studio-accent border-b-2 border-studio-accent bg-pink-50' : 'text-gray-400 hover:text-gray-600'}`}
        >
            Studio
        </button>
        <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-sm font-bold tracking-wide uppercase transition-colors ${activeTab === 'settings' ? 'text-studio-accent border-b-2 border-studio-accent bg-pink-50' : 'text-gray-400 hover:text-gray-600'}`}
        >
            Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 space-y-8">
        
        {activeTab === 'studio' && (
            <>
                {/* --- BATCH EDIT ACTIONS --- */}
                {isBatchMode ? (
                    <div className="bg-pink-50 p-4 rounded-xl border border-pink-200 animate-pulse-fast">
                        <h3 className="text-studio-accent font-bold text-sm mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Batch Editing ({selectedCount})
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">Select an action for selected images:</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                             <button onClick={() => onBatchUpscale('2k')} className="px-3 py-2 bg-white border border-pink-200 text-pink-600 text-xs font-bold rounded hover:bg-pink-100">Upscale 2K</button>
                             <button onClick={() => onBatchUpscale('4k')} className="px-3 py-2 bg-white border border-pink-200 text-pink-600 text-xs font-bold rounded hover:bg-pink-100">Upscale 4K</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={onBatchColorize} className="px-3 py-2 bg-gradient-to-r from-red-100 via-yellow-100 to-blue-100 border border-gray-200 text-gray-700 text-xs font-bold rounded hover:opacity-80">Colorize</button>
                             <button onClick={onBatchDecolorize} className="px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold rounded hover:bg-gray-200">Decolorize</button>
                        </div>
                    </div>
                ) : (
                    <>
                    {/* --- REFERENCE IMAGES --- */}
                    <section>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-bold text-black uppercase tracking-wider">Reference Images ({uploadedImages.length})</label>
                            {uploadedImages.length > 0 && (
                                <button onClick={() => setUploadedImages([])} className="text-xs text-red-400 hover:text-red-600 underline">Clear All</button>
                            )}
                        </div>
                        
                        {uploadedImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {uploadedImages.map((img, idx) => (
                                    <div key={idx} className="relative group aspect-square rounded overflow-hidden border border-gray-200">
                                        <img src={img} alt="Ref" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeUploadedImage(idx)}
                                            className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-pink-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 hover:border-studio-accent transition-colors group h-24"
                        >
                            <svg className="w-6 h-6 text-pink-300 group-hover:text-studio-accent mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-xs font-medium text-gray-500 group-hover:text-studio-accent">Add Reference(s)</span>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            className="hidden" 
                            accept="image/*"
                            multiple 
                        />
                    </section>

                    {/* --- STYLE SELECTOR --- */}
                    <section>
                        <label className="text-sm font-bold text-black uppercase tracking-wider mb-3 block">Art Style</label>
                        <div className="grid grid-cols-3 gap-2">
                            {styles.filter(s => s.isVisible).map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => setConfig({ ...config, style: style.id })}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-20 ${
                                        config.style === style.id
                                        ? 'bg-pink-50 border-studio-accent ring-1 ring-pink-200'
                                        : 'bg-white border-gray-100 hover:border-pink-200 hover:shadow-sm'
                                    }`}
                                >
                                    <span className="text-xl mb-1">{style.icon}</span>
                                    <span className={`text-[10px] text-center leading-tight ${config.style === style.id ? 'text-studio-accent font-bold' : 'text-gray-500'}`}>
                                        {style.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* --- CONFIG GRID --- */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* PRINT SIZE */}
                        <section>
                            <label className="text-sm font-bold text-black uppercase tracking-wider mb-2 block">Print Size</label>
                            <select 
                                value={config.printSize}
                                onChange={(e) => setConfig({ ...config, printSize: e.target.value as PrintSize })}
                                className="w-full bg-gray-50 border border-gray-200 text-black text-base rounded-lg p-2 focus:border-studio-accent focus:ring-1 focus:ring-pink-200 outline-none"
                            >
                                {Object.values(PrintSize).map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </section>

                        {/* BATCH SIZE */}
                        <section>
                            <label className="text-sm font-bold text-black uppercase tracking-wider mb-2 block">Batch Size</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="20"
                                value={config.batchCount}
                                onChange={(e) => setConfig({ ...config, batchCount: parseInt(e.target.value) || 1 })}
                                className="w-full bg-gray-50 border border-gray-200 text-black text-base rounded-lg p-2 text-center focus:border-studio-accent focus:ring-1 focus:ring-pink-200 outline-none"
                            />
                        </section>
                    </div>

                    {/* --- COLOR MODE --- */}
                    <section>
                         <label className="text-sm font-bold text-black uppercase tracking-wider mb-2 block">Color Mode</label>
                         <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                             <button
                                onClick={() => setConfig({...config, colorMode: 'bw'})}
                                className={`py-2 text-sm font-bold rounded-md transition-all ${config.colorMode === 'bw' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                                 B&W (Line Art)
                             </button>
                             <button
                                onClick={() => setConfig({...config, colorMode: 'color'})}
                                className={`py-2 text-sm font-bold rounded-md transition-all ${config.colorMode === 'color' ? 'bg-purple-100 text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                                 Full Color
                             </button>
                         </div>
                    </section>
                    
                    {/* --- COLOR PALETTE (Only if Color Mode) --- */}
                    {config.colorMode === 'color' && (
                        <section className="animate-fade-in-up">
                            <label className="text-sm font-bold text-black uppercase tracking-wider mb-2 block">Palette</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                    onClick={() => setConfig({...config, selectedPaletteId: null})}
                                    className={`px-3 py-1.5 rounded border text-xs font-medium ${!config.selectedPaletteId ? 'bg-white border-studio-accent text-studio-accent' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                >
                                    Default
                                </button>
                                {palettes.map(p => (
                                    <div key={p.id} className="relative group">
                                        <button
                                            onClick={() => setConfig({...config, selectedPaletteId: p.id})}
                                            className={`pl-2 pr-2 py-1.5 rounded border flex items-center space-x-1 ${config.selectedPaletteId === p.id ? 'bg-white border-studio-accent' : 'bg-gray-50 border-gray-200'}`}
                                        >
                                            <div className="flex -space-x-1">
                                                {p.colors.slice(0, 3).map((c, i) => (
                                                    <div key={i} className="w-3 h-3 rounded-full" style={{backgroundColor: c}}></div>
                                                ))}
                                            </div>
                                            <span className={`text-[10px] ml-1 ${config.selectedPaletteId === p.id ? 'text-black' : 'text-gray-500'}`}>{p.name}</span>
                                        </button>
                                        {p.isCustom && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeletePalette(p.id); }}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete Palette"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* --- FRAMES --- */}
                    <section>
                         <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-black uppercase tracking-wider">Frame Options</label>
                            <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-bold ${!config.useFrame ? 'text-pink-400' : 'text-gray-300'}`}>No Frame</span>
                                <button 
                                    onClick={() => setConfig({...config, useFrame: !config.useFrame})}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.useFrame ? 'bg-pink-400' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${config.useFrame ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <span className={`text-[10px] font-bold ${config.useFrame ? 'text-pink-400' : 'text-gray-300'}`}>Add Frame</span>
                            </div>
                         </div>
                         
                         {config.useFrame && (
                            <div className="grid grid-cols-2 gap-2 animate-fade-in-up">
                                {Object.values(FrameStyle).map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setConfig({...config, frameStyle: style})}
                                        className={`py-2 px-3 text-xs border rounded-lg transition-all text-center ${
                                            config.frameStyle === style 
                                            ? 'border-pink-300 bg-pink-50 text-pink-600 font-bold' 
                                            : 'border-gray-200 text-gray-500 hover:border-pink-200'
                                        }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                         )}
                    </section>
                    </>
                )}
            </>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
             <div className="space-y-8 animate-fade-in-up">
                
                {/* 1. PALETTE CREATOR */}
                <section>
                    <h3 className="text-black font-bold text-sm mb-3 flex items-center">
                        <span className="mr-2 text-xl">🌈</span> Create Palette
                    </h3>
                    
                    {!isCreatingPalette ? (
                        <div 
                            onClick={() => paletteFileInputRef.current?.click()}
                            className="border border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-studio-accent transition-colors"
                        >
                            <p className="text-xs text-gray-500 font-medium">Click to upload image & extract colors</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-pink-100 rounded-lg p-3">
                            <label className="text-xs text-gray-400 uppercase block mb-1">Palette Name</label>
                            <input 
                                type="text"
                                value={newPaletteName}
                                onChange={(e) => setNewPaletteName(e.target.value)}
                                className="w-full bg-gray-50 text-black text-sm p-2 rounded mb-3 border border-gray-300 focus:border-studio-accent outline-none"
                            />
                            
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {extractedColors.map((color, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div 
                                            className="w-full aspect-video rounded border border-gray-300 mb-1"
                                            style={{backgroundColor: color}}
                                        ></div>
                                        <input 
                                            type="text"
                                            value={color}
                                            onChange={(e) => {
                                                const newColors = [...extractedColors];
                                                newColors[idx] = e.target.value;
                                                setExtractedColors(newColors);
                                            }}
                                            className="w-full text-[8px] text-center border border-gray-200 rounded text-gray-500"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex space-x-2">
                                <button onClick={() => setIsCreatingPalette(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded">Cancel</button>
                                <button onClick={handleSaveExtractedPalette} className="flex-1 py-2 bg-studio-accent text-white text-xs font-bold rounded shadow-md shadow-pink-200">Save Palette</button>
                            </div>
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={paletteFileInputRef} 
                        onChange={handlePaletteImageUpload} 
                        className="hidden" 
                        accept="image/*"
                    />
                </section>

                {/* 2. STYLE CREATOR / EDITOR */}
                <section id="style-form">
                    <h3 className="text-black font-bold text-sm mb-3 flex items-center">
                        <span className="mr-2 text-xl">✨</span> {editingStyleId ? 'Edit Style' : 'Create Custom Style'}
                    </h3>
                    <div className="space-y-3 bg-white border border-pink-100 p-4 rounded-xl shadow-sm">
                        <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-3">
                                <label className="text-xs text-black font-bold uppercase mb-1 block">Name</label>
                                <input 
                                    type="text" 
                                    value={newStyle.label}
                                    onChange={(e) => setNewStyle({...newStyle, label: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded text-sm text-black focus:border-studio-accent outline-none"
                                    placeholder="My Style"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-black font-bold uppercase mb-1 block">Icon</label>
                                <input 
                                    type="text" 
                                    value={newStyle.icon}
                                    onChange={(e) => setNewStyle({...newStyle, icon: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 p-2 rounded text-sm text-center text-black focus:border-studio-accent outline-none"
                                    placeholder="🎨"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs text-black font-bold uppercase mb-1 block">Prompt Instruction</label>
                            <textarea 
                                value={newStyle.instruction}
                                onChange={(e) => setNewStyle({...newStyle, instruction: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 p-2 rounded text-sm text-black focus:border-studio-accent outline-none h-24 resize-none"
                                placeholder="Describe the art style rules..."
                            />
                        </div>

                        <div>
                            <label className="text-xs text-black font-bold uppercase mb-1 block">Negative Prompt</label>
                            <input 
                                type="text" 
                                value={newStyle.negativePrompt}
                                onChange={(e) => setNewStyle({...newStyle, negativePrompt: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 p-2 rounded text-sm text-black focus:border-studio-accent outline-none"
                                placeholder="Things to avoid..."
                            />
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                            {editingStyleId && (
                                <button 
                                    onClick={() => { setEditingStyleId(null); setNewStyle({ label: 'New Style', icon: '🎨', desc: 'Custom Style', instruction: '', negativePrompt: '' }); }}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
                                >
                                    Cancel
                                </button>
                            )}
                            <button 
                                onClick={handleSaveStyleForm}
                                className="px-6 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                {editingStyleId ? 'Update Style' : 'Save Style'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 3. STYLE MANAGER */}
                <section>
                    <h3 className="text-black font-bold text-sm mb-3 flex items-center">
                        <span className="mr-2 text-xl">🛠️</span> Manage Styles
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {styles.map(style => (
                            <div key={style.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => onToggleStyleVisibility(style.id)} className="text-gray-400 hover:text-studio-accent">
                                        {style.isVisible ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        )}
                                    </button>
                                    <span className="text-base">{style.icon}</span>
                                    <span className={`text-sm font-medium ${style.isVisible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{style.label}</span>
                                </div>
                                
                                {style.isCustom && (
                                    <div className="flex space-x-1">
                                        <button 
                                            onClick={() => handleEditStyle(style)}
                                            className="p-1 text-blue-400 hover:text-blue-600"
                                            title="Edit"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => onDeleteStyle(style.id)}
                                            className="p-1 text-gray-300 hover:text-red-500"
                                            title="Delete"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
             </div>
        )}
      </div>

      {/* FIXED BOTTOM: PROMPT & GENERATE BUTTON */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-pink-200 p-4 shadow-lg z-30">
        <label className="text-xs font-bold text-black uppercase tracking-wider mb-2 flex justify-between">
            <span>Prompt</span>
            {isBatchMode && <span className="text-studio-accent">Batch Editing Active</span>}
        </label>
        
        <textarea 
          value={isBatchMode ? config.prompt : batchPrompts.length > 0 ? batchPrompts.join('\n') : config.prompt}
          onChange={(e) => {
              const val = e.target.value;
              if (isBatchMode) {
                  setConfig({ ...config, prompt: val });
              } else {
                  if (val.includes('\n')) {
                      setBatchPrompts(val.split('\n').filter(p => p.trim() !== ''));
                  } else {
                      setBatchPrompts([]);
                      setConfig({ ...config, prompt: val });
                  }
              }
          }}
          className="w-full bg-gray-50 border border-gray-200 text-black text-sm p-3 rounded-lg focus:border-studio-accent focus:ring-1 focus:ring-pink-200 outline-none resize-none h-24 mb-3 shadow-inner"
          placeholder={isBatchMode ? "Enter instructions to modify selected images..." : "Describe your coloring page..."}
        />
        
        <button 
          onClick={isGenerating ? onStop : onGenerate}
          disabled={!isGenerating && !config.prompt.trim() && batchPrompts.length === 0}
          className={`w-full py-4 rounded-xl font-bold text-base tracking-wide shadow-lg shadow-pink-200/50 transition-all transform active:scale-95 flex items-center justify-center space-x-2 ${
            isGenerating 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : isBatchMode 
                ? 'bg-black hover:bg-gray-800 text-white' 
                : 'bg-studio-accent hover:bg-studio-accentHover text-white'
          }`}
        >
           {isGenerating ? (
               <>
                 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>STOP GENERATION</span>
               </>
           ) : (
               <>
                 {isBatchMode ? (
                     <span>APPLY TO {selectedCount} IMAGES</span>
                 ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>GENERATE {batchPrompts.length > 1 ? `(${batchPrompts.length * config.batchCount})` : config.batchCount > 1 ? `(${config.batchCount})` : ''}</span>
                    </>
                 )}
               </>
           )}
        </button>
      </div>
    </div>
  );
};

export default Controls;