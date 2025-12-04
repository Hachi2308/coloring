import { GoogleGenAI } from "@google/genai";
import { GeminiModel, ImageStyle, Resolution, ColorPalette, PrintSize, ColorMode, FrameStyle } from '../types';

const constructPrompt = (
  userPrompt: string, 
  hasReference: boolean, 
  printSize: PrintSize,
  colorMode: ColorMode,
  styleInstruction: string,
  styleNegatives: string,
  useFrame: boolean,
  frameStyle: FrameStyle,
  palette: ColorPalette | null,
  transformType?: 'colorize' | 'decolorize'
): string => {
  
  // 1. BASE CONFIG
  const aspectRatioText = printSize; // e.g. "8.5x11 inches"
  
  // 2. COLOR & TRANSFORMATION LOGIC
  let colorInstruction = "";
  let taskDescription = "";
  let negativeExtras = "";

  if (transformType === 'colorize') {
      // Logic for Colorizing a B&W image
      taskDescription = `
        TASK: FULLY COLORIZE the provided line art.
        CRITICAL RULE: DO NOT LEAVE ANY WHITE GAPS. FILL THE ENTIRE CANVAS.
        SUBJECT: Keep the exact lines and composition of the reference image.
        ACTION: 
        1. Fill the main character/subject with vibrant colors.
        2. YOU MUST PAINT THE BACKGROUND. Do not leave a white background. Create a full scene environment color.
        3. Ensure every pixel is colored.
      `;
      colorInstruction = `
        COLOR MODE: RICH FULL COLOR ILLUSTRATION.
        - NO WHITE CANVAS. The image must look like a finished painting, not a sticker.
        - Do not change the line art style, just add color.
      `;
      if (palette && palette.colors.length > 0) {
          colorInstruction += `\n- PALETTE: YOU MUST STRICTLY USE THESE COLORS: [${palette.colors.join(', ')}].`;
      }
      negativeExtras = "white background, empty background, uncolored spots, white gaps, incomplete coloring, sketch";
  } else if (transformType === 'decolorize') {
      // Logic for removing color (making it a coloring page)
      taskDescription = `
        TASK: CONVERT the provided colored illustration into a BLACK AND WHITE COLORING PAGE.
        SUBJECT: Keep the composition exactly the same.
        ACTION: Remove all color, shading, and gradients. Turn it into clean line art.
      `;
      colorInstruction = `
        COLOR MODE: STRICT BLACK AND WHITE ONLY.
        - NO GRAYSCALE. NO SHADING.
        - Pure #000000 lines on #FFFFFF background.
      `;
      negativeExtras = "color, shading, gradient, grey, gray, painted, realistic";
  } else {
      // Standard Generation Logic
      if (colorMode === 'bw') {
          colorInstruction = `
            COLOR MODE: STRICT BLACK AND WHITE ONLY.
            - ABSOLUTELY NO GRAYSCALE. NO SHADING. NO GRADIENTS.
            - The image must be pure #000000 lines on pure #FFFFFF background.
            - This is a Coloring Book Page. The inside of shapes must be EMPTY (White) for the user to color.
          `;
      } else {
          colorInstruction = `
            COLOR MODE: FULL COLOR ILLUSTRATION.
            - Create a fully colored, finished illustration.
            - Keep the "Coloring Book" aesthetic (thick outlines), but fill the shapes with vibrant colors.
          `;
          if (palette && palette.colors.length > 0) {
              colorInstruction += `\n- PALETTE: YOU MUST STRICTLY USE THESE COLORS: [${palette.colors.join(', ')}].`;
          }
      }

      if (hasReference) {
        // STYLE TRANSFER LOGIC
        taskDescription = `
            TASK: GENERATE A NEW IMAGE based on the text prompt: "${userPrompt}".
            
            REFERENCE IMAGES ROLE: STYLE & VIBE SOURCE ONLY.
            - Analyze the provided reference image(s) for Art Style, Line Weight, Color Palette, and Rendering Technique.
            - APPLY that exact style to the NEW SUBJECT defined in the text prompt "${userPrompt}".
            - DO NOT simply redraw the reference image. Create a BRAND NEW composition.
            - If the reference is a photo, extract its vibe/color but draw it as a Coloring Page (as per rules).
            - If the reference is a drawing, mimic the artist's hand/brush strokes.
        `;
      } else {
        taskDescription = `
            TASK: Create a ${colorMode === 'bw' ? 'Black & White Coloring Page' : 'Coloring Book Illustration'}.
            SUBJECT: ${userPrompt}.
        `;
      }
  }

  // 3. FRAME LOGIC (UPDATED FOR STRICT NO-FRAME AND WIGGLY HAND DRAWN)
  let frameInstruction = "";
  let frameNegatives = "";
  
  if (useFrame) {
      let frameVisualDesc = "";
      switch (frameStyle) {
          case FrameStyle.HAND_DRAWN:
              frameVisualDesc = "A wiggly, uneven, shaky doodle-style border. Not straight. Looks like it was drawn by a human hand with a marker. Wobbly lines.";
              break;
          case FrameStyle.SKETCHER:
              frameVisualDesc = "A rough, sketched border with multiple overlapping loose lines.";
              break;
          case FrameStyle.DOUBLE:
              frameVisualDesc = "A double-line border. Two parallel lines surrounding the image.";
              break;
          case FrameStyle.ORNATE:
              frameVisualDesc = "A decorative border with corner flourishes or simple patterns.";
              break;
          case FrameStyle.SIMPLE:
          default:
              frameVisualDesc = "A clean, simple single-line black border.";
              break;
      }

      frameInstruction = `
        LAYOUT: FRAMED.
        - Draw a border around the entire page.
        - FRAME STYLE: ${frameVisualDesc}
        - The gap between the image edge and the frame must be MINIMAL (Maximize the drawing area inside).
        - The main illustration must be contained ENTIRELY inside this frame.
      `;
  } else {
      frameInstruction = `
        LAYOUT: FULL BLEED / EDGE-TO-EDGE.
        - CRITICAL RULE: DO NOT DRAW A FRAME. DO NOT DRAW A BORDER.
        - The illustration must extend all the way to the canvas edges.
        - Elements at the edges should be cut off by the canvas.
        - NO white margin around the drawing.
        - The drawing is NOT contained in a box.
      `;
      frameNegatives = "frame, border, margin, padding, square box, rectangle box, picture frame, white border, outline around image";
  }

  // 4. CORE INSTRUCTION (User Style)
  const coreStyle = styleInstruction || "";

  // 5. NEGATIVES
  const baseNegatives = [
      'text', 'writing', 'letters', 'typography', 'watermark', 'signature',
      'blurry', 'noise', 'jpeg artifacts', 'pixelated', 'low quality',
      'photorealistic', 'photo', '3d render'
  ];
  if (colorMode === 'bw' || transformType === 'decolorize') {
      baseNegatives.push('color', 'grey', 'gray', 'red', 'blue', 'green', 'shading', 'gradients');
  }
  
  // Combine all negatives
  const negativePrompt = [...baseNegatives, styleNegatives, negativeExtras, frameNegatives].filter(Boolean).join(', ');

  return `
    ${taskDescription}

    ${coreStyle}

    ${colorInstruction}

    ${frameInstruction}
    
    OUTPUT SIZE RATIO: ${aspectRatioText}.
    
    NEGATIVE PROMPT: ${negativePrompt}.
  `.trim();
};

export const generateSingleImage = async (
  apiKey: string | undefined,
  _defaultModel: GeminiModel, 
  prompt: string,
  printSize: PrintSize,
  seed: number,
  style: ImageStyle,
  colorMode: ColorMode,
  resolution: Resolution,
  useFrame: boolean,
  frameStyle: FrameStyle,
  referenceImages: string[] = [], // Changed to array
  isEditing: boolean = false,
  palette: ColorPalette | null = null,
  customStyleInstruction: string = "",
  customNegatives: string = "",
  transformType?: 'colorize' | 'decolorize'
): Promise<{ url: string; usedModel: string } | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
    
    const hasReference = referenceImages.length > 0;
    const fullPrompt = constructPrompt(
        prompt, 
        hasReference, 
        printSize, 
        colorMode, 
        customStyleInstruction, 
        customNegatives,
        useFrame,
        frameStyle,
        palette,
        transformType
    );

    const parts: any[] = [];
    
    // Add all reference images as parts
    for (const refImg of referenceImages) {
        if (refImg) {
            const base64Data = refImg.split(',')[1] || refImg;
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: base64Data
                }
            });
        }
    }

    parts.push({ text: fullPrompt });

    let activeModel: string;
    let imageConfig: any = {};
    
    // Map Print Sizes to Aspect Ratios
    switch (printSize) {
        case PrintSize.SQUARE_8x8: imageConfig.aspectRatio = "1:1"; break;
        case PrintSize.LETTER: imageConfig.aspectRatio = "3:4"; break; 
        case PrintSize.PORTRAIT_8x10: imageConfig.aspectRatio = "4:5"; break; 
        case PrintSize.PORTRAIT_6x9: imageConfig.aspectRatio = "9:16"; break; 
        default: imageConfig.aspectRatio = "1:1";
    }

    if (resolution === '2k') {
      activeModel = 'gemini-3-pro-image-preview';
      imageConfig.imageSize = '2K';
    } else if (resolution === '4k') {
      activeModel = 'gemini-3-pro-image-preview';
      imageConfig.imageSize = '4K';
    } else {
      activeModel = 'gemini-2.5-flash-image';
    }

    const response = await ai.models.generateContent({
      model: activeModel,
      contents: { parts: parts },
      config: {
        seed: seed,
        imageConfig: imageConfig,
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return { 
            url: `data:image/png;base64,${base64EncodeString}`,
            usedModel: activeModel
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Generation Error:`, error);
    throw error;
  }
};