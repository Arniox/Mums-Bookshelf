import type { BookAppearance } from "@mums-bookshelf/shared";
import * as THREE from "three";

type TitleTextureOptions = {
  accent: string;
  appearance: Pick<BookAppearance, "spineStyle">;
  height: number;
  title: string;
  width: number;
};

export class BookTitleTextureFactory {
  private readonly maximumAnisotropy: number;

  constructor(maximumAnisotropy: number) {
    this.maximumAnisotropy = maximumAnisotropy;
  }

  create(options: TitleTextureOptions): THREE.CanvasTexture {
    const textureScale = 2;
    const titleAspect = Math.max(options.width / options.height, 0.16);
    const logicalHeight = 1024;
    const logicalWidth = Math.round(
      THREE.MathUtils.clamp(logicalHeight * titleAspect, 196, 768),
    );
    const canvas = document.createElement("canvas");
    canvas.width = logicalWidth * textureScale;
    canvas.height = logicalHeight * textureScale;
    const context = canvas.getContext("2d");
    if (!context) return new THREE.CanvasTexture(canvas);

    context.scale(textureScale, textureScale);
    this.drawDecoration(context, logicalWidth, logicalHeight, options);
    this.drawTitle(
      context,
      logicalWidth,
      logicalHeight,
      options.title,
      options.accent,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(this.maximumAnisotropy, 4);
    return texture;
  }

  private drawDecoration(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: TitleTextureOptions,
  ) {
    const inset = Math.max(10, width * 0.12);
    context.globalAlpha = 0.72;
    context.strokeStyle = options.accent;
    context.lineWidth = Math.max(2, width * 0.025);
    if (options.appearance.spineStyle === "bands") {
      const bandHeight = Math.max(12, height * 0.035);
      context.strokeRect(inset, height * 0.1, width - inset * 2, bandHeight);
      context.strokeRect(inset, height * 0.86, width - inset * 2, bandHeight);
    } else if (options.appearance.spineStyle === "frame") {
      context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    } else if (options.appearance.spineStyle === "rule") {
      context.beginPath();
      context.moveTo(width * 0.22, inset);
      context.lineTo(width * 0.22, height - inset);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  private drawTitle(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    title: string,
    accent: string,
  ) {
    const family = "Cormorant Garamond, Georgia, serif";
    const maximumFontSize = Math.min(width * 0.64, 132);
    context.font = `600 ${maximumFontSize}px ${family}`;
    const textWidth = Math.max(context.measureText(title).width, 1);
    const fontSize = Math.min(
      maximumFontSize,
      (maximumFontSize * height * 0.68) / textWidth,
    );
    context.font = `600 ${Math.max(fontSize, 18)}px ${family}`;
    context.fillStyle = accent;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(title, 0, 0);
    context.restore();
  }
}
