export type BoardCanvasLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type BoardItem = {
  id: string;
  src: string;
  width: number;
  height: number;
  title: string;
  labels: string[];
  folderId: string | null;
  origin: "paste";
  createdAt: string;
  filename: string;
  mimeType: string;
  canvas: BoardCanvasLayout | null;
};

export type BoardFolder = {
  id: string;
  name: string;
  createdAt: string;
};
