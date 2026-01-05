import React, { useState, useRef, useEffect } from 'react';
import { Step, AppConfig, AndroidPermissions } from './types';
import { StepIndicator } from './components/StepIndicator';
import { analyzeCodeForPermissions, generateAppIcon } from './services/geminiService';
import { generateProjectZip } from './services/projectGenerator';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.UPLOAD);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Estado de la configuración
  const [config, setConfig] = useState<AppConfig>({
    appName: "MyApp",
    packageName: "com.example.myapp",
    versionName: "1.0.0",
    htmlContent: "",
    description: "",
    iconUrl: ""
  });
  
  // Estado de permisos detectados por la IA
  const [permissions, setPermissions] = useState<AndroidPermissions | null>(null);

  // Referencias para inputs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejador de subida de archivo (HTML o ZIP)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Caso 1: Archivo ZIP
    if (file.name.endsWith('.zip')) {
        setIsLoading(true);
        setLoadingMessage("📂 Descomprimiendo y buscando index.html...");
        
        try {
            // Guardamos el archivo ZIP para el paso de construcción final
            const newConfig = { 
                ...config, 
                zipFile: file,
                appName: file.name.replace('.zip', '').replace(/[^a-zA-Z0-9]/g, '') || "MyZipApp"
            };

            // Intentamos extraer el index.html para el análisis de IA
            if (window.JSZip) {
                const zip = await new window.JSZip().loadAsync(file);
                // Buscar index.html en la raíz o en una subcarpeta de primer nivel
                let indexFile = zip.file("index.html");
                
                // Si no está en la raíz, buscar en el primer nivel de carpetas
                if (!indexFile) {
                    const files = Object.keys(zip.files);
                    const foundPath = files.find(path => path.endsWith('index.html'));
                    if (foundPath) indexFile = zip.file(foundPath);
                }

                if (indexFile) {
                    const textContent = await indexFile.async("string");
                    newConfig.htmlContent = textContent;
                    console.log("index.html encontrado y extraído para análisis.");
                } else {
                    alert("Nota: No se encontró 'index.html' en el ZIP. Deberás pegar el código principal manualmente para que la IA detecte permisos, o confiar en los predeterminados.");
                    newConfig.htmlContent = "<!-- No index.html found in ZIP, default permissions will be applied -->";
                }
            }

            setConfig(newConfig);

        } catch (err) {
            console.error(err);
            alert("Error leyendo el archivo ZIP.");
        } finally {
            setIsLoading(false);
        }
    } 
    // Caso 2: Archivo HTML
    else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (evt.target?.result) {
                setConfig(prev => ({ 
                    ...prev, 
                    htmlContent: evt.target!.result as string,
                    zipFile: undefined, // Limpiar zip anterior si lo hubiera
                    appName: file.name.replace('.html', '').replace(/[^a-zA-Z0-9]/g, '') || "MyWebApp"
                }));
            }
        };
        reader.readAsText(file);
    } else {
        alert("Por favor sube un archivo .html o .zip");
    }
  };

  // Paso 1 -> 2: Analizar Código
  const handleAnalyze = async () => {
    // Si hay un ZIP pero no hay contenido HTML claro, permitimos continuar pero avisando
    if (!config.htmlContent && !config.zipFile) return alert("Por favor sube un archivo HTML/ZIP o pega el código.");
    
    setIsLoading(true);
    setLoadingMessage("🧠 Gemini está pensando profundamente sobre tu estructura...");
    
    try {
      // Uso de Thinking Budget 32k en el servicio
      const perms = await analyzeCodeForPermissions(config.htmlContent || "GENERIC_WEB_APP");
      setPermissions(perms);
      setCurrentStep(Step.ANALYZE);
    } catch (err) {
      alert("Error analizando el código. Verifica tu API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2 -> 3: Generar Icono
  const handleGenerateIcon = async () => {
    if (!config.description) return alert("Por favor describe tu app para generar el icono.");
    
    setIsLoading(true);
    setLoadingMessage("🎨 Pintando un icono pixel-perfect con Gemini Image...");
    
    try {
      const iconDataUrl = await generateAppIcon(config.appName, config.description);
      setConfig(prev => ({ ...prev, iconUrl: iconDataUrl }));
      setCurrentStep(Step.ICON);
    } catch (err) {
      alert("Error generando icono.");
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 3 -> 4: Construir
  const handleBuild = async () => {
    setCurrentStep(Step.BUILD);
    setIsLoading(true);
    setLoadingMessage("📦 Generando código, assets y configurando GitHub Actions...");
    
    try {
      if (permissions) {
        await generateProjectZip(config, permissions);
      }
    } catch (error) {
      console.error(error);
      alert("Error creando el ZIP.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("¡Descarga lista! 🚀");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-xl font-light text-blue-300 animate-pulse">{loadingMessage}</p>
        </div>
      );
    }

    switch (currentStep) {
      case Step.UPLOAD:
        return (
          <div className="space-y-8 animate-fade-in-up">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">Sube tu Web App</h2>
              <p className="text-slate-400">Soporte para <span className="text-blue-400 font-mono">.html</span> simple o carpetas completas en <span className="text-blue-400 font-mono">.zip</span>.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Editor Area */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-slate-300">Código fuente o Archivo</label>
                    {config.zipFile && (
                        <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">ZIP Cargado: {config.zipFile.name}</span>
                    )}
                </div>
                
                <div className="relative">
                    <textarea 
                    className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg p-4 font-mono text-sm text-blue-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Pega tu HTML aquí, o sube un archivo ZIP si tienes múltiples carpetas/imágenes..."
                    value={config.htmlContent}
                    onChange={(e) => setConfig({...config, htmlContent: e.target.value, zipFile: undefined})}
                    />
                     {config.zipFile && (
                        <div className="absolute inset-0 bg-slate-800/90 flex flex-col items-center justify-center rounded-lg border border-green-500/50">
                            <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p className="text-green-400 font-bold">{config.zipFile.name}</p>
                            <p className="text-slate-400 text-xs mt-1">Se usará todo el contenido del ZIP para la app.</p>
                            <button 
                                onClick={() => setConfig({...config, zipFile: undefined, htmlContent: ''})}
                                className="mt-3 text-red-400 hover:text-red-300 text-sm underline"
                            >
                                Quitar archivo
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-dashed border-slate-600 hover:border-blue-500 transition-colors">
                    <div className="flex-1">
                        <p className="text-sm text-slate-300 font-semibold">Subir Archivo</p>
                        <p className="text-xs text-slate-500">Soporta .html (simple) o .zip (proyecto completo)</p>
                    </div>
                    <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors text-sm">
                        Seleccionar
                        <input 
                            type="file" 
                            accept=".html,.htm,.zip" 
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </label>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-6 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nombre de la App</label>
                  <input 
                    type="text" 
                    value={config.appName}
                    onChange={(e) => setConfig({...config, appName: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Package Name (ej. com.miapp)</label>
                  <input 
                    type="text" 
                    value={config.packageName}
                    onChange={(e) => setConfig({...config, packageName: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Descripción (para la IA)</label>
                  <textarea 
                    value={config.description}
                    onChange={(e) => setConfig({...config, description: e.target.value})}
                    placeholder="Describe tu app para que Gemini genere el icono perfecto..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none h-24"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={handleAnalyze}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30 flex items-center gap-2"
              >
                <span>Analizar con Gemini 3 Pro</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </button>
            </div>
          </div>
        );

      case Step.ANALYZE:
        return (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
             <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">Análisis de Inteligencia</h2>
              <p className="text-slate-400">Gemini ha detectado los siguientes requisitos para tu app.</p>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-700 bg-slate-800/80">
                    <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         Permisos Detectados
                    </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <PermissionItem label="Acceso a Internet" active={permissions?.usesInternet} />
                     <PermissionItem label="Cámara" active={permissions?.usesCamera} />
                     <PermissionItem label="Geolocalización" active={permissions?.usesLocation} />
                     <PermissionItem label="Micrófono" active={permissions?.usesMicrophone} />
                     <PermissionItem label="Almacenamiento" active={permissions?.usesStorage} />
                </div>
                {permissions?.reasoning && (
                    <div className="p-6 bg-slate-900/50 border-t border-slate-700">
                        <p className="text-sm text-slate-400 font-mono">
                            <span className="text-blue-500 font-bold">GEMINI THOUGHT:</span> {permissions.reasoning}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-4">
                 <button onClick={() => setCurrentStep(Step.UPLOAD)} className="text-slate-400 hover:text-white">Atrás</button>
                 <button 
                    onClick={handleGenerateIcon}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/30 flex items-center gap-2"
                  >
                    <span>Diseñar Icono</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </button>
            </div>
          </div>
        );

      case Step.ICON:
        return (
            <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">Tu Identidad Visual</h2>
                    <p className="text-slate-400">Generado exclusivamente para "{config.appName}" por Gemini Image.</p>
                </div>

                <div className="flex flex-col items-center justify-center p-10 bg-slate-800 rounded-xl border border-slate-700">
                    {config.iconUrl ? (
                        <div className="relative group">
                            <img src={config.iconUrl} alt="App Icon" className="w-48 h-48 rounded-3xl shadow-2xl shadow-black/50 transition-transform duration-500 hover:scale-105" />
                            <div className="absolute -bottom-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                                GENERADO
                            </div>
                        </div>
                    ) : (
                        <div className="w-48 h-48 bg-slate-700 rounded-3xl animate-pulse"></div>
                    )}
                    <p className="mt-6 text-slate-400 text-sm max-w-md text-center">
                        Si no te gusta, puedes volver a generar o continuar para construir el paquete.
                    </p>
                </div>

                <div className="flex justify-between pt-4">
                     <button onClick={() => setCurrentStep(Step.ANALYZE)} className="text-slate-400 hover:text-white">Atrás</button>
                     <div className="flex gap-4">
                        <button onClick={handleGenerateIcon} className="text-indigo-400 hover:text-indigo-300 font-medium px-4 py-2">Regenerar</button>
                        <button 
                            onClick={handleBuild}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg shadow-green-500/30 flex items-center gap-2"
                        >
                            <span>Construir Proyecto</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                     </div>
                </div>
            </div>
        );

      case Step.BUILD:
        return (
            <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in-up">
                <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h2 className="text-4xl font-bold text-white">¡Proyecto Generado!</h2>
                <p className="text-slate-300 text-lg">
                    El navegador no puede compilar Java directamente, pero hemos creado dos caminos para ti.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {/* Opción 1: GitHub Actions */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors text-left relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </div>
                        <span className="bg-blue-600 text-xs font-bold px-2 py-1 rounded text-white mb-2 inline-block">RECOMENDADO</span>
                        <h3 className="text-xl font-bold text-white mb-2">Compilar en la Nube (Fácil)</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Hemos incluido un archivo oculto para GitHub Actions.
                        </p>
                        <ol className="list-decimal list-inside text-slate-300 text-sm space-y-2 mb-4">
                            <li>Sube el contenido del ZIP a un repositorio de GitHub.</li>
                            <li>Ve a la pestaña <strong>"Actions"</strong> en GitHub.</li>
                            <li>Verás un proceso llamado "Build APK" ejecutándose.</li>
                            <li>¡Descarga el APK desde los "Artifacts" al terminar!</li>
                        </ol>
                    </div>

                    {/* Opción 2: Android Studio */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-green-500 transition-colors text-left relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Compilar Localmente (Experto)</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Para desarrolladores que tienen el entorno listo.
                        </p>
                         <ol className="list-decimal list-inside text-slate-300 text-sm space-y-2 mb-4">
                            <li>Descomprime el ZIP.</li>
                            <li>Abre la carpeta en <strong>Android Studio</strong>.</li>
                            <li>Espera a que Gradle sincronice.</li>
                            <li>Presiona <strong>RUN</strong> o Build > Build Bundle(s) / APK(s).</li>
                        </ol>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-800 mt-8">
                     <p className="text-slate-500 text-sm">¿Por qué no descargamos el APK directo? <br/>Los navegadores no pueden ejecutar Java/Gradle por seguridad. Usar GitHub Actions es la forma más profesional y gratuita de hacerlo.</p>
                </div>

                <button onClick={() => window.location.reload()} className="text-blue-400 hover:text-white mt-4 underline">
                    Crear otra App
                </button>
            </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              WebToDroid AI
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-500">
            <span>Powered by Gemini 3.0 Pro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <StepIndicator currentStep={currentStep} />
        
        <div className="bg-slate-900 min-h-[500px]">
             {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-600 text-sm">
        <p>WebToDroid AI genera código nativo. Usa GitHub Actions para obtener tu APK en la nube.</p>
      </footer>
    </div>
  );
};

const PermissionItem = ({ label, active }: { label: string, active?: boolean }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${active ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
        <span className={active ? 'text-green-400 font-medium' : 'text-slate-500'}>{label}</span>
        {active ? (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        ) : (
             <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        )}
    </div>
);

export default App;