export enum PrintSize {
  SQUARE_8x8 = '8.25x8.25"',
  LETTER = '8.5x11"',
  PORTRAIT_8x10 = '8x10"',
  PORTRAIT_6x9 = '6x9"'
}

export type ImageStyle = string; 
export type Resolution = '1k' | '2k' | '4k';

export type ColorMode = 'bw' | 'color';

export enum FrameStyle {
    HAND_DRAWN = 'Hand Drawn',
    SKETCHER = 'Sketcher',
    SIMPLE = 'Simple Line',
    DOUBLE = 'Double Line',
    ORNATE = 'Ornate'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  resolution: Resolution;
  printSize: PrintSize;
}

export type GeminiModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[]; // Hex codes
  isCustom?: boolean;
}

export interface StyleDefinition {
    id: string;
    label: string;
    icon: string; // Emoji or char
    desc: string;
    isCustom?: boolean;
    isVisible: boolean;
    instruction?: string;
    negativePrompt?: string;
}

export interface GenerationConfig {
  model: GeminiModel;
  prompt: string;
  style: ImageStyle;
  printSize: PrintSize;
  colorMode: ColorMode; // Replaces background color options
  resolution: Resolution;
  batchCount: number;
  useFrame: boolean;
  frameStyle: FrameStyle;
  selectedPaletteId: string | null;
}

export interface FailedJob {
  id: string;
  timestamp: number;
  error: string;
  jobConfig: {
    prompt: string;
    printSize: PrintSize;
    seed: number;
    style: ImageStyle;
    colorMode: 'bw' | 'color';
    resolution: Resolution;
    useFrame: boolean;
    frameStyle: FrameStyle;
    referenceImages?: string[]; // Changed to array
    isEditing: boolean;
    transformType?: 'colorize' | 'decolorize';
    selectedPaletteId: string | null;
  };
}