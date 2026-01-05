export interface AppConfig {
  appName: string;
  packageName: string;
  versionName: string;
  htmlContent: string; // Se usa para el análisis de IA
  zipFile?: File;      // Se usa para la construcción final si se sube un zip
  iconUrl?: string;
  description: string;
}

export interface AndroidPermissions {
  usesInternet: boolean;
  usesCamera: boolean;
  usesLocation: boolean;
  usesMicrophone: boolean;
  usesStorage: boolean;
  customPermissions: string[];
  reasoning: string; // Explicación del modelo
}

export enum Step {
  UPLOAD = 0,
  ANALYZE = 1,
  ICON = 2,
  BUILD = 3
}

// Declaración global para JSZip y saveAs cargados vía CDN
declare global {
  interface Window {
    JSZip: any;
    saveAs: any;
  }
}