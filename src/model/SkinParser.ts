/** 1面分のUV座標（0.0〜1.0正規化済み） */
export interface FaceUV {
  u: number; // 左上U
  v: number; // 左上V
  w: number; // 幅
  h: number; // 高さ
}

/** パーツの6面分のUV */
export interface FaceUVs {
  top: FaceUV;
  bottom: FaceUV;
  front: FaceUV;
  back: FaceUV;
  left: FaceUV;
  right: FaceUV;
}

/**
 * Minecraftキューブネットレイアウトから6面のUVを計算する。
 *
 * 展開図内の配置:
 *   行1: [空(d)] [top(w×d)]    [bottom(w×d)] [空]
 *   行2: [left(d×h)] [front(w×h)] [right(d×h)]  [back(w×h)]
 *
 * @param originX 展開図の左上ピクセルX座標
 * @param originY 展開図の左上ピクセルY座標
 * @param w パーツ幅（ピクセル）
 * @param h パーツ高さ（ピクセル）
 * @param d パーツ奥行き（ピクセル）
 * @param texW テクスチャ全体の幅（ピクセル）
 * @param texH テクスチャ全体の高さ（ピクセル）
 */
export function computeFaceUVs(
  originX: number,
  originY: number,
  w: number,
  h: number,
  d: number,
  texW: number,
  texH: number,
): FaceUVs {
  const norm = (px: number, py: number, pw: number, ph: number): FaceUV => ({
    u: (originX + px) / texW,
    v: (originY + py) / texH,
    w: pw / texW,
    h: ph / texH,
  });

  return {
    top: norm(d, 0, w, d),
    bottom: norm(d + w, 0, w, d),
    left: norm(0, d, d, h),
    front: norm(d, d, w, h),
    right: norm(d + w, d, d, h),
    back: norm(d + w + d, d, w, h),
  };
}
