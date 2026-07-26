/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Downscale an image in the browser before it is uploaded.
//
// A phone camera produces files far larger than any sensible upload limit, and
// raising the limit only moves the wall: the photo that fails is always the next
// one. Shrinking at the source removes the limit as a thing anyone has to think
// about, and it is the difference between an upload that works on tent wifi and
// one that times out.
//
// It also drops metadata. A canvas re-encode keeps only pixels, so EXIF -- which
// on a phone photo routinely includes GPS coordinates -- does not leave the
// device. For a site whose users may not want their address attached to what
// they grow, that is the more important half of this.
//
// Every failure path returns the original file. Shrinking is an optimisation,
// and it must never be the reason an upload does not happen.

// 2048px on the long edge stays sharp full-width on a high-DPI screen while
// taking a typical 12MP phone photo from several megabytes to a few hundred KB.
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

// Below this, a re-encode costs more in quality than it returns in bytes.
const SKIP_BELOW_BYTES = 600 * 1024;

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

export const shrinkImageForUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;

  // An animated GIF does not survive a canvas round-trip; it would arrive as a
  // still frame, which is worse than arriving large.
  if (file.type === 'image/gif') return file;

  // Icons are uploaded at an exact size on purpose.
  if (file.type.includes('icon')) return file;

  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    // from-image matters: the canvas keeps no EXIF, so a photo taken sideways
    // would lose the orientation tag that was correcting it and arrive rotated.
    // The value is long-standing in the spec and in browsers, but predates the
    // DOM typings this project builds against, hence the cast.
    bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as unknown as ImageBitmapOptions);
  } catch {
    // Formats this browser cannot decode -- HEIC outside Safari, mainly.
    return file;
  }

  try {
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE / longestEdge);

    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // PNG stays PNG so screenshots keep their edges and avatars keep their
    // transparency; everything else becomes JPEG, which is what makes a
    // photograph small.
    const isPng = file.type === 'image/png';
    const outType = isPng ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(
      canvas,
      outType,
      isPng ? undefined : JPEG_QUALITY,
    );

    // Re-encoding a small or already-efficient image can make it bigger.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^./\\]+$/, '') || 'image';
    return new File([blob], `${base}.${isPng ? 'png' : 'jpg'}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
};

export default shrinkImageForUpload;
