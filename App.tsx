import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Controls from './components/Controls';
import Gallery from './components/Gallery';
import ImageModal from './components/ImageModal';
import LogConsole, { LogEntry } from './components/LogConsole';
import { PrintSize, GenerationConfig, GeneratedImage, ImageStyle, Resolution, ColorPalette, StyleDefinition, FrameStyle, GeminiModel, FailedJob } from './types';
import { generateSingleImage } from './services/geminiService';
import { saveImageToDB, getImagesFromDB, deleteImageFromDB, clearImagesFromDB, saveFailedJobToDB, getFailedJobsFromDB, deleteFailedJobFromDB, clearFailedJobsFromDB } from './services/storageService';
import JSZip from 'jszip';

// Helper for rate limiting/delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Convert Data URI to Blob for reliable downloads
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

// Built-in style: Trung Default
const TRUNG_STYLE: StyleDefinition = {
  id: 'trung-default',
  label: 'Trung',
  icon: '🌸',
  desc: 'Default Coloring Book Style',
  isVisible: true,
  instruction: `
    STYLE DEFINITION: "Trung"

    1. CORE AESTHETIC:
    Mood: Hygge, Warm, Stress-free, Whimsical.
    Target Audience: Adult relaxation & Beginners. "Easy Coloring" is the priority.
    Simplicity: High readability. Instant recognition of objects.

    2. LINE WORK RULES:
    Weight: UNIFORM THICK LINES. The line weight must be heavy (think Sharpie marker style).
    Contrast: Stark Black and White only. NO grayscale, NO shading, NO sketching lines.
    Closure: All shapes must be closed (no open gaps).

    3. CHARACTER & SHAPES:
    Geometry: 100% Rounded & Organic. "Squishy" aesthetic.
    Prohibitions: NO sharp corners, NO jagged edges. Even tables or boxes should have soft, rounded corners.
    Facial Features: Minimalist. Eyes are simple black dots or inverted arcs. Tiny mouths. High forehead ratio (Chibi proportions).

    4. SCENERY & COMPOSITION:
    Full Scene: Create a complete environment (bedroom, garden, bakery), NOT just a floating character.
    The "Spacious" Rule: Objects in the background must be LARGE. Avoid tiny details (like individual blades of grass or complex textures).
    Spacing: Leave ample negative space inside objects for coloring. Example: A tree should be a large cloud shape, not hundreds of individual leaves.
  `,
  negativePrompt: "sharp corners, jagged lines, thin lines, sketching, shading, grayscale, complex texture, noise, chaotic, horror, angry, realistic eyes, open shapes"
};

const DEFAULT_STYLES: StyleDefinition[] = [TRUNG_STYLE];

const DEFAULT_CONFIG: GenerationConfig = {
    model: 'gemini-2.5-flash-image', 
    prompt: '',
    style: 'trung-default',
    printSize: PrintSize.SQUARE_8x8,
    colorMode: 'bw',
    resolution: '1k',
    batchCount: 1, 
    useFrame: false,
    frameStyle: FrameStyle.SIMPLE,
    selectedPaletteId: null,
};

const DEFAULT_PALETTES: ColorPalette[] = [
    { id: 'wc-1', name: 'Pastel Dream', colors: ['#FFB7B2', '#E2F0CB', '#B5EAD7', '#C7CEEA'] },
    { id: 'wc-2', name: 'Ocean Mist', colors: ['#A0E7E5', '#B4F8C8', '#FBE7C6', '#FFAEBC'] },
    { id: 'wc-3', name: 'Sunset Wash', colors: ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB'] },
];

const App: React.FC = () => {
  // --- CONFIG STATE WITH PERSISTENCE ---
  const [config, setConfig] = useState<GenerationConfig>(() => {
      try {
          const saved = localStorage.getItem('trung_studio_config');
          return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
      } catch {
          return DEFAULT_CONFIG;
      }
  });

  // 1. Custom Palettes (Persisted Independently)
  const [customPalettes, setCustomPalettes] = useState<ColorPalette[]>(() => {
      try {
          const saved = localStorage.getItem('trung_studio_palettes');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // 2. Custom Styles (Persisted Independently - Only user created ones)
  const [customStyles, setCustomStyles] = useState<StyleDefinition[]>(() => {
      try {
          const saved = localStorage.getItem('trung_custom_styles');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // 3. Hidden Style IDs (Persisted Independently - Tracks visibility for defaults too)
  const [hiddenStyleIds, setHiddenStyleIds] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('trung_hidden_styles');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // Derived State: Merge Defaults + Custom + Visibility
  const allStyles = [...DEFAULT_STYLES, ...customStyles].map(style => ({
      ...style,
      isVisible: !hiddenStyleIds.includes(style.id)
  }));

  const allPalettes = [...DEFAULT_PALETTES, ...customPalettes];

  // Persist State Effects
  useEffect(() => {
      localStorage.setItem('trung_studio_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
      localStorage.setItem('trung_studio_palettes', JSON.stringify(customPalettes));
  }, [customPalettes]);

  useEffect(() => {
      localStorage.setItem('trung_custom_styles', JSON.stringify(customStyles));
  }, [customStyles]);

  useEffect(() => {
      localStorage.setItem('trung_hidden_styles', JSON.stringify(hiddenStyleIds));
  }, [hiddenStyleIds]);
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');

  // --- STANDARD STATE ---
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadImages = async () => {
      try {
        const storedImages = await getImagesFromDB();
        setImages(storedImages);
        const storedFailedJobs = await getFailedJobsFromDB();
        setFailedJobs(storedFailedJobs);
      } catch (e) {
        console.error("Failed to load history from DB", e);
      }
    };
    loadImages();
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // Changed to array
  const [batchPrompts, setBatchPrompts] = useState<string[]>([]);
  
  const stopGenerationRef = useRef<boolean>(false);
  const [activeTab, setActiveTab] = useState<'gallery' | 'logs' | 'failed'>('gallery');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
     checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const storedKey = localStorage.getItem('trung_api_key');
    if (storedKey) {
        setManualApiKey(storedKey);
        setHasApiKey(true);
        return;
    }

    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      const has = await aiStudio.hasSelectedApiKey();
      setHasApiKey(has);
    }
  };

  const handleConnectKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
          await aiStudio.openSelectKey();
          setHasApiKey(true);
      }
  };

  const handleSaveManualKey = () => {
      if (!tempApiKey.trim()) return;
      localStorage.setItem('trung_api_key', tempApiKey.trim());
      setManualApiKey(tempApiKey.trim());
      setHasApiKey(true);
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [{ timestamp: new Date().toLocaleTimeString(), message, type }, ...prev]);
  };

  const handleStop = () => {
    stopGenerationRef.current = true;
    addLog("Stopping generation sequence...", 'warning');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        return newSet;
    });
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === images.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(images.map(img => img.id)));
  };

  const handleSavePalette = (newPalette: ColorPalette) => {
      setCustomPalettes(prev => [...prev, newPalette]);
      addLog(`Palette '${newPalette.name}' created.`, 'success');
  };

  const handleDeletePalette = (id: string) => {
      setCustomPalettes(prev => prev.filter(p => p.id !== id));
      if (config.selectedPaletteId === id) setConfig(prev => ({...prev, selectedPaletteId: null}));
  };

  // Style Management Handlers
  const handleSaveStyle = (style: StyleDefinition) => {
      setCustomStyles(prev => [...prev, style]);
      addLog(`Style '${style.label}' created.`, 'success');
  };

  const handleUpdateStyle = (updatedStyle: StyleDefinition) => {
      setCustomStyles(prev => prev.map(s => s.id === updatedStyle.id ? updatedStyle : s));
      addLog(`Style '${updatedStyle.label}' updated.`, 'success');
  };

  const handleDeleteStyle = (id: string) => {
      if (id === 'trung-default') return; // Cannot delete default
      setCustomStyles(prev => prev.filter(s => s.id !== id));
      // Also clean up hidden list if needed
      setHiddenStyleIds(prev => prev.filter(hid => hid !== id));
      
      if (config.style === id) setConfig(prev => ({ ...prev, style: 'trung-default' }));
      addLog(`Style deleted.`, 'info');
  };

  const handleToggleStyleVisibility = (id: string) => {
      setHiddenStyleIds(prev => {
          if (prev.includes(id)) return prev.filter(i => i !== id); // Unhide
          return [...prev, id]; // Hide
      });
  };

  const runConcurrentTasks = async <T,>(tasks: (() => Promise<T>)[], concurrency: number) => {
      const executing: Promise<void>[] = [];
      for (const task of tasks) {
          if (stopGenerationRef.current) break;
          // Add small delay between starting tasks to avoid burst rate limits
          await delay(1000); 
          const p = Promise.resolve().then(() => task());
          const e: Promise<void> = p.then(() => { executing.splice(executing.indexOf(e), 1); }).catch(() => { executing.splice(executing.indexOf(e), 1); });
          executing.push(e);
          if (executing.length >= concurrency) await Promise.race(executing);
      }
      return Promise.all(executing);
  };

  const generateImageSafe = async (
    prompt: string,
    printSize: PrintSize,
    seed: number,
    style: ImageStyle,
    colorMode: 'bw' | 'color',
    resolution: Resolution,
    useFrame: boolean,
    frameStyle: FrameStyle,
    referenceImages: string[] = [], // Changed to array
    isEditing: boolean = false,
    transformType?: 'colorize' | 'decolorize'
  ): Promise<{ content: string; usedModel: string } | null> => {
    const dummyModel: GeminiModel = 'gemini-2.5-flash-image'; 
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries <= MAX_RETRIES) {
        if (stopGenerationRef.current) return null;
        try {
            let actionLabel = isEditing ? 'Editing' : `Generating`;
            if (transformType === 'colorize') actionLabel = 'Colorizing';
            if (transformType === 'decolorize') actionLabel = 'Decolorizing';
            
            if (retries === 0) {
                addLog(`${actionLabel}...`, 'info');
            } else {
                addLog(`Retry ${retries}/${MAX_RETRIES}: ${actionLabel}...`, 'warning');
            }
            
            const selectedPalette = allPalettes.find(p => p.id === config.selectedPaletteId) || null;
            
            // Get Style Instructions
            const activeStyleDef = allStyles.find(s => s.id === style) || TRUNG_STYLE;
            const customInstruction = activeStyleDef.instruction || "";
            const customNegatives = activeStyleDef.negativePrompt || "";

            // Pass manualApiKey here. If empty string, service handles it.
            const result = await generateSingleImage(
                manualApiKey,
                dummyModel, 
                prompt, 
                printSize, 
                seed, 
                style, 
                colorMode, 
                resolution, 
                useFrame, 
                frameStyle, 
                referenceImages, // Pass array
                isEditing, 
                selectedPalette, 
                String(customInstruction), 
                String(customNegatives), 
                transformType
            );
            
            if (result) {
                return { content: result.url, usedModel: result.usedModel };
            }
            // If result is null but no error thrown, break loop (shouldn't happen typically)
            break; 

        } catch (err: any) {
            let errorMsg = 'Unknown error';
            if (err instanceof Error) errorMsg = err.message;
            else if (typeof err === 'string') errorMsg = err;
            else errorMsg = String(err);

            // Handle 429 Rate Limit
            if (errorMsg.includes("429") || errorMsg.includes("Too many requests")) {
                if (retries < MAX_RETRIES) {
                    const waitTime = 10000 * (retries + 1); // 10s, 20s, 30s
                    addLog(`Rate Limited (429). Waiting ${waitTime/1000}s...`, 'warning');
                    await delay(waitTime);
                    retries++;
                    continue;
                } else {
                    addLog(`Failed after ${MAX_RETRIES} retries due to rate limits.`, 'error');
                }
            } else {
                // Other errors
                addLog(`Generation failed: ${errorMsg}`, 'error');
                
                // If error is permission related and we aren't using manual key, prompt.
                if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("403") || errorMsg.includes("API key not valid")) {
                    setHasApiKey(false);
                    setError("API Key Invalid or Permission Denied. Please re-enter.");
                    if (!manualApiKey && (window as any).aistudio) {
                        await (window as any).aistudio.openSelectKey();
                        setHasApiKey(true);
                    }
                }
            }

            // --- SAVE FAILED JOB TO PERSISTENT DB ---
            if (retries >= MAX_RETRIES || !errorMsg.includes("429")) {
                const failedJob: FailedJob = {
                    id: `fail-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    timestamp: Date.now(),
                    error: errorMsg,
                    jobConfig: {
                        prompt, printSize, seed, style, colorMode, resolution,
                        useFrame, frameStyle, referenceImages, isEditing, transformType, // Store array
                        selectedPaletteId: config.selectedPaletteId
                    }
                };
                await saveFailedJobToDB(failedJob);
                setFailedJobs(prev => [failedJob, ...prev]);
                addLog(`Saved failed job to Retry Queue.`, 'warning');
            }

            // Stop on non-retryable error
            break;
        }
    }
    return null;
  };

  const addImage = async (newImage: GeneratedImage) => {
      await saveImageToDB(newImage);
      setImages(prev => [newImage, ...prev]);
  };

  const handleGenerate = async () => {
    if (!hasApiKey) return;

    setIsGenerating(true);
    stopGenerationRef.current = false;
    setError(null);

    // MODE 1: BATCH EDIT / UPSCALE
    if (selectedIds.size > 0) {
        const targets = images.filter(img => selectedIds.has(img.id));
        const editPrompt = config.prompt.trim();
        if (!editPrompt) { setError("Please enter a prompt."); setIsGenerating(false); return; }

        addLog(`Batch Edit: ${targets.length} images.`, 'info');
        const tasks = targets.map((targetImg) => async () => {
            if (stopGenerationRef.current) return;
            const seed = Math.floor(Math.random() * 1000000000);
            const result = await generateImageSafe(
                editPrompt, config.printSize, seed, config.style, config.colorMode, targetImg.resolution, config.useFrame, config.frameStyle, [targetImg.url], true // Pass as array
            );
            if (result) {
                await addImage({
                    id: Math.random().toString(36).substring(7),
                    url: result.content,
                    prompt: editPrompt,
                    timestamp: Date.now(),
                    resolution: config.resolution,
                    printSize: config.printSize
                });
            }
        });
        // REDUCED CONCURRENCY TO 2
        await runConcurrentTasks(tasks, 2);
        setSelectedIds(new Set()); 
        addLog("Batch Edit Finished.", 'success');
        setIsGenerating(false);
        return;
    }

    // MODE 2: NEW GENERATION (No Angles loop anymore)
    const promptsToProcess = batchPrompts.length > 0 ? batchPrompts : (config.prompt.trim() ? [config.prompt] : []);
    if (promptsToProcess.length === 0) { setIsGenerating(false); return; }
    
    try {
        const allTasks: (() => Promise<void>)[] = [];

        for (const currentPrompt of promptsToProcess) {
            for (let i = 0; i < config.batchCount; i++) {
                allTasks.push(async () => {
                    if (stopGenerationRef.current) return;
                    const sessionSeed = Math.floor(Math.random() * 1000000000);
                    // generateImageSafe handles both Text-to-Image and Image-to-Image (via uploadedImages)
                    const resultObj = await generateImageSafe(
                        currentPrompt, 
                        config.printSize, 
                        sessionSeed, 
                        config.style, 
                        config.colorMode, 
                        config.resolution, 
                        config.useFrame, 
                        config.frameStyle,
                        uploadedImages // Pass array
                    );

                    if (resultObj) await addImage({ 
                        id: Math.random().toString(36).substring(7), 
                        url: resultObj.content, 
                        prompt: currentPrompt, 
                        timestamp: Date.now(), 
                        resolution: config.resolution,
                        printSize: config.printSize
                    });
                });
            }
        }

        if (allTasks.length > 0) {
            // REDUCED CONCURRENCY TO 2
            addLog(`Queueing ${allTasks.length} tasks (2 threads)...`, 'info');
            await runConcurrentTasks(allTasks, 2);
        }

    } catch (err: any) {
      let errorMessage = 'Unknown error';
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === 'string') errorMessage = err;
      else errorMessage = String(err);
      
      setError(`Error: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
      stopGenerationRef.current = false;
      addLog("Finished.", 'info');
    }
  };

  const handleRetryJob = async (job: FailedJob) => {
      if (!hasApiKey) return;
      setIsGenerating(true);
      stopGenerationRef.current = false;
      addLog(`Retrying job: ${job.jobConfig.prompt.substring(0, 20)}...`, 'info');
      
      try {
          const cfg = job.jobConfig;
          const result = await generateImageSafe(
              cfg.prompt, cfg.printSize, cfg.seed, cfg.style, cfg.colorMode, cfg.resolution,
              cfg.useFrame, cfg.frameStyle, cfg.referenceImages, cfg.isEditing, cfg.transformType // Updated prop name
          );

          if (result) {
              await addImage({
                  id: Math.random().toString(36).substring(7),
                  url: result.content,
                  prompt: cfg.prompt,
                  timestamp: Date.now(),
                  resolution: cfg.resolution,
                  printSize: cfg.printSize
              });
              await deleteFailedJobFromDB(job.id);
              setFailedJobs(prev => prev.filter(j => j.id !== job.id));
              addLog(`Retry successful. Job removed from queue.`, 'success');
          }
      } catch (e) {
          addLog(`Retry failed again.`, 'error');
      } finally {
          setIsGenerating(false);
      }
  };

  const handleRetryAllFailed = async () => {
      if (failedJobs.length === 0) return;
      setIsGenerating(true);
      stopGenerationRef.current = false;
      addLog(`Retrying all ${failedJobs.length} failed jobs...`, 'info');

      const tasks = failedJobs.map(job => async () => {
           if (stopGenerationRef.current) return;
           const cfg = job.jobConfig;
           const result = await generateImageSafe(
              cfg.prompt, cfg.printSize, cfg.seed, cfg.style, cfg.colorMode, cfg.resolution,
              cfg.useFrame, cfg.frameStyle, cfg.referenceImages, cfg.isEditing, cfg.transformType
          );
          if (result) {
              await addImage({
                  id: Math.random().toString(36).substring(7),
                  url: result.content,
                  prompt: cfg.prompt,
                  timestamp: Date.now(),
                  resolution: cfg.resolution,
                  printSize: cfg.printSize
              });
              await deleteFailedJobFromDB(job.id);
          }
      });
      
      await runConcurrentTasks(tasks, 2);
      
      // Refresh list
      const remaining = await getFailedJobsFromDB();
      setFailedJobs(remaining);
      setIsGenerating(false);
  };

  const handleClearFailedJobs = async () => {
      await clearFailedJobsFromDB();
      setFailedJobs([]);
      addLog(`Cleared all failed jobs.`, 'info');
  };

  const handleEditImage = async (originalImage: GeneratedImage, newPrompt: string) => {
      if (!hasApiKey) return;
      setIsGenerating(true);
      try {
        const seed = Math.floor(Math.random() * 1000000000);
        const result = await generateImageSafe(
            newPrompt, config.printSize, seed, config.style, config.colorMode, originalImage.resolution, config.useFrame, config.frameStyle, [originalImage.url], true // Pass as array
        );
        if (result) {
            await addImage({
                id: Math.random().toString(36).substring(7),
                url: result.content,
                prompt: newPrompt,
                timestamp: Date.now(),
                resolution: originalImage.resolution,
                printSize: originalImage.printSize
            });
            setSelectedImage(null); 
        }
      } catch (e: any) { } finally { setIsGenerating(false); }
  };

  const handleBatchUpscale = async (targetResolution: Resolution) => {
      if (!hasApiKey) return;
      if (selectedIds.size === 0) return;

      setIsGenerating(true);
      stopGenerationRef.current = false;
      // Ensure targetResolution is stringified just in case
      addLog(`Upscaling ${selectedIds.size} images to ${String(targetResolution)}...`, 'info');
      
      const targets = images.filter(img => selectedIds.has(img.id));
      const tasks = targets.map((targetImg) => async () => {
          if (stopGenerationRef.current) return;
          const seed = Math.floor(Math.random() * 1000000000);
          
          const result = await generateImageSafe(
              targetImg.prompt, 
              config.printSize,
              seed, 
              config.style, 
              config.colorMode, 
              targetResolution, 
              config.useFrame,
              config.frameStyle,
              [targetImg.url], // Pass as array
              true 
          );
          
          if (result) {
              await addImage({
                  id: Math.random().toString(36).substring(7),
                  url: result.content,
                  prompt: targetImg.prompt,
                  timestamp: Date.now(),
                  resolution: targetResolution,
                  printSize: targetImg.printSize
              });
          }
      });

      // REDUCED CONCURRENCY TO 2
      await runConcurrentTasks(tasks, 2);
      setSelectedIds(new Set());
      addLog("Batch Upscale Finished.", 'success');
      setIsGenerating(false);
  };

  const handleBatchColorize = async () => {
      if (!hasApiKey) return;
      if (selectedIds.size === 0) return;
      setIsGenerating(true);
      stopGenerationRef.current = false;
      addLog(`Colorizing ${selectedIds.size} images...`, 'info');
      
      const targets = images.filter(img => selectedIds.has(img.id));
      const tasks = targets.map((targetImg) => async () => {
          if (stopGenerationRef.current) return;
          const seed = Math.floor(Math.random() * 1000000000);
          
          const result = await generateImageSafe(
              targetImg.prompt, config.printSize, seed, config.style, 
              'color', // Force Color mode
              targetImg.resolution, config.useFrame, config.frameStyle, [targetImg.url], true, // Pass as array
              'colorize' // Transform Type
          );
          
          if (result) {
              await addImage({
                  id: Math.random().toString(36).substring(7),
                  url: result.content,
                  prompt: `Colorized: ${targetImg.prompt}`,
                  timestamp: Date.now(),
                  resolution: targetImg.resolution,
                  printSize: targetImg.printSize
              });
          }
      });
      // REDUCED CONCURRENCY TO 2
      await runConcurrentTasks(tasks, 2);
      setSelectedIds(new Set());
      addLog("Batch Colorize Finished.", 'success');
      setIsGenerating(false);
  };

  const handleBatchDecolorize = async () => {
      if (!hasApiKey) return;
      if (selectedIds.size === 0) return;
      setIsGenerating(true);
      stopGenerationRef.current = false;
      addLog(`Decolorizing ${selectedIds.size} images...`, 'info');
      
      const targets = images.filter(img => selectedIds.has(img.id));
      const tasks = targets.map((targetImg) => async () => {
          if (stopGenerationRef.current) return;
          const seed = Math.floor(Math.random() * 1000000000);
          
          const result = await generateImageSafe(
              targetImg.prompt, config.printSize, seed, config.style, 
              'bw', // Force B&W mode
              targetImg.resolution, config.useFrame, config.frameStyle, [targetImg.url], true, // Pass as array
              'decolorize' // Transform Type
          );
          
          if (result) {
              await addImage({
                  id: Math.random().toString(36).substring(7),
                  url: result.content,
                  prompt: `Line Art: ${targetImg.prompt}`,
                  timestamp: Date.now(),
                  resolution: targetImg.resolution,
                  printSize: targetImg.printSize
              });
          }
      });
      // REDUCED CONCURRENCY TO 2
      await runConcurrentTasks(tasks, 2);
      setSelectedIds(new Set());
      addLog("Batch Decolorize Finished.", 'success');
      setIsGenerating(false);
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    addLog(`Zipping ${images.length} images...`, 'info');
    try {
        const zip: any = new JSZip();
        const folder = zip.folder("coloring-book-pages");
        if (folder) {
            images.forEach((img, index) => {
                const blob = dataURItoBlob(img.url);
                folder.file(`coloring-page-${index}.png`, blob);
            });
            const content = await zip.generateAsync({ type: "blob" }) as Blob;
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `trung-coloring-studio-${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
        }
    } catch (e: unknown) { 
        let msg = 'Unknown error';
        if (e instanceof Error) {
            msg = e.message;
        } else if (typeof e === 'string') {
            msg = e;
        } else {
            msg = String(e);
        }
        addLog(`ZIP failed: ${msg}`, 'error'); 
    }
  };

  const handleClearHistory = async () => {
      await clearImagesFromDB();
      setImages([]);
      setSelectedIds(new Set());
      addLog("History cleared.", 'warning');
  };

  const handleDeleteSelected = async () => {
      if (selectedIds.size === 0) return;
      
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
          await deleteImageFromDB(id);
      }
      
      setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
      setSelectedIds(new Set());
      addLog(`Deleted ${idsToDelete.length} images.`, 'info');
  };

  const handleDeleteImage = async (id: string) => {
    await deleteImageFromDB(id);
    setImages(prev => prev.filter(img => img.id !== id));
  };

  if (!hasApiKey) {
      return (
          <div className="min-h-screen bg-pink-50 text-gray-800 font-sans flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-pink-200 max-w-md w-full text-center">
                <h1 className="text-3xl font-bold mb-2 text-studio-accent">Trung Coloring Studio</h1>
                <p className="text-gray-400 mb-6 text-sm">Pastel Edition</p>
                
                <button 
                    onClick={handleConnectKey} 
                    className="w-full px-6 py-4 bg-studio-accent hover:bg-studio-accentHover text-white rounded-lg font-bold shadow-md shadow-pink-200 transition-all mb-4"
                >
                    Connect with AI Studio
                </button>
                
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">OR</span></div>
                </div>

                <div className="text-left">
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Enter API Key Manually</label>
                    <input 
                        type="password"
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-gray-50 border border-gray-200 rounded p-3 text-black mb-3 focus:border-studio-accent outline-none font-mono text-sm"
                    />
                    <button 
                        onClick={handleSaveManualKey}
                        disabled={!tempApiKey.trim()}
                        className="w-full px-4 py-3 bg-gray-800 hover:bg-black text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save API Key
                    </button>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">Key is stored locally in your browser.</p>
                </div>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans selection:bg-studio-accent selection:text-white">
      <Header />
      <main className="max-w-[98%] mx-auto px-4 py-4 h-[calc(100vh-60px)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
           <div className="lg:col-span-4 xl:col-span-3 h-full flex flex-col">
              <Controls 
                config={config} setConfig={setConfig} onGenerate={handleGenerate} onStop={handleStop}
                isGenerating={isGenerating} 
                uploadedImages={uploadedImages} setUploadedImages={setUploadedImages} // Updated props
                batchPrompts={batchPrompts} setBatchPrompts={setBatchPrompts} selectedCount={selectedIds.size}
                palettes={allPalettes}
                onDeletePalette={handleDeletePalette}
                onSavePalette={handleSavePalette}
                onBatchUpscale={handleBatchUpscale}
                onBatchColorize={handleBatchColorize}
                onBatchDecolorize={handleBatchDecolorize}
                styles={allStyles}
                onSaveStyle={handleSaveStyle}
                onUpdateStyle={handleUpdateStyle}
                onDeleteStyle={handleDeleteStyle}
                onToggleStyleVisibility={handleToggleStyleVisibility}
              />
              {error && <div className="mt-2 p-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded text-center">{error}</div>}
           </div>

           <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full overflow-hidden">
             <div className="flex items-center space-x-1 mb-4 border-b border-pink-200 shrink-0">
                <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'gallery' ? 'border-studio-accent text-studio-accent font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Gallery ({images.length})</button>
                <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logs' ? 'border-studio-accent text-studio-accent font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Logs ({logs.length})</button>
                <button onClick={() => setActiveTab('failed')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'failed' ? 'border-red-400 text-red-500 font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Failed ({failedJobs.length})</button>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'gallery' && (
                <Gallery 
                    images={images} onImageClick={setSelectedImage} onDownloadAll={handleDownloadAll}
                    onClearHistory={handleClearHistory} onDeleteSelected={handleDeleteSelected} 
                    onDeleteImage={handleDeleteImage} selectedIds={selectedIds}
                    onToggleSelect={toggleSelection} onToggleSelectAll={toggleSelectAll}
                />
                )}
                {activeTab === 'logs' && (
                <LogConsole logs={logs} onClear={() => setLogs([])} />
                )}
                {activeTab === 'failed' && (
                    <div className="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-lg animate-fade-in-up p-4 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-gray-700 font-bold">Failed Generations Queue</h3>
                            <div className="space-x-2">
                                <button 
                                    onClick={handleRetryAllFailed}
                                    disabled={failedJobs.length === 0 || isGenerating}
                                    className="px-4 py-2 bg-studio-accent text-white rounded text-sm font-bold hover:bg-studio-accentHover disabled:opacity-50"
                                >
                                    Retry All
                                </button>
                                <button 
                                    onClick={handleClearFailedJobs}
                                    disabled={failedJobs.length === 0}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-500 rounded text-sm font-bold hover:bg-red-50 disabled:opacity-50"
                                >
                                    Clear List
                                </button>
                            </div>
                        </div>
                        {failedJobs.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 italic">No failed jobs in the queue.</div>
                        ) : (
                            <div className="space-y-3">
                                {failedJobs.map(job => (
                                    <div key={job.id} className="border border-red-100 bg-red-50/50 rounded-lg p-4 flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{job.jobConfig.prompt}</p>
                                            <p className="text-red-500 text-xs font-mono mb-1">{job.error}</p>
                                            <p className="text-gray-400 text-xs">{new Date(job.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-col space-y-2 ml-4">
                                            <button 
                                                onClick={() => handleRetryJob(job)}
                                                disabled={isGenerating}
                                                className="px-3 py-1 bg-white border border-studio-accent text-studio-accent text-xs rounded font-bold hover:bg-pink-50 disabled:opacity-50"
                                            >
                                                Retry
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    await deleteFailedJobFromDB(job.id);
                                                    setFailedJobs(prev => prev.filter(j => j.id !== job.id));
                                                }}
                                                className="px-3 py-1 bg-white border border-gray-200 text-gray-400 text-xs rounded hover:text-red-500 hover:border-red-200"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
             </div>
           </div>
        </div>
      </main>

      <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} onEdit={handleEditImage} isGenerating={isGenerating} />
    </div>
  );
};

export default App;