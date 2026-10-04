/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  CloudRain, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  MapPin, 
  RefreshCw, 
  Settings, 
  Sparkles, 
  Thermometer, 
  Wind, 
  Info, 
  Layers
} from 'lucide-react';

declare global {
  interface Window {
    windyInit?: (options: any, callback: (windy: any) => void) => void;
    L?: any;
  }
}

interface TelemetryData {
  location: {
    name: string;
    lat: number;
    lon: number;
    elevation: string;
  };
  model: string;
  generatedAt: string;
  isSimulated: boolean;
  totalRainMm: number;
  status: string;
  badgeColor: string;
  riverLevelMeters: number;
  forecast: {
    timestamps: number[];
    rain: number[];
    temp: number[];
    wind: number[];
  };
  stations: Array<{
    id: string;
    name: string;
    distance: string;
    status: string;
    reading: string;
  }>;
}

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState<boolean>(false);
  const [windyApiKeyInput, setWindyApiKeyInput] = useState<string>('');
  const [aiAdvisory, setAiAdvisory] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [gmapsRiskSummary, setGmapsRiskSummary] = useState<string | null>(null);
  const [gmapsLoading, setGmapsLoading] = useState<boolean>(false);
  const [mapMode, setMapMode] = useState<'windy' | 'leaflet'>('windy');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const fetchTelemetry = async (key = windyApiKeyInput) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/forecast?key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.message || data.error || 'Error al conectar con la API de Windy');
        setTelemetry(null);
        if (res.status === 400) {
          setApiKeyModalOpen(true);
        }
      } else {
        setTelemetry(data);
      }
    } catch (err: any) {
      console.error('Error fetching telemetry:', err);
      setApiError(err.message || 'Error de red al consultar telemetría');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleMapsRisk = async () => {
    setGmapsLoading(true);
    try {
      const res = await fetch('/api/google-maps-risk-check', { method: 'POST' });
      const data = await res.json();
      setGmapsRiskSummary(data.groundingSummary);
    } catch (err) {
      console.error('Error fetching Google Maps risk check:', err);
    } finally {
      setGmapsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const lat = -25.5350698;
    const lon = -54.6327662;

    if (window.windyInit && windyApiKeyInput && windyApiKeyInput.trim() !== '' && mapMode === 'windy') {
      try {
        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = '';
        }
        window.windyInit(
          {
            key: windyApiKeyInput,
            lat,
            lon,
            zoom: 15,
            overlay: 'rain',
            model: 'ecmwf',
          },
          (windyInstance: any) => {
            const { map, L } = windyInstance;
            mapInstanceRef.current = map;

            const pulsingIcon = L.divIcon({
              className: 'custom-pulsing-marker',
              html: `
                <div class="relative flex items-center justify-center">
                  <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <div class="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl border-2 border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });

            const marker = L.marker([lat, lon], { icon: pulsingIcon }).addTo(map);
            marker.bindPopup(`
              <div class="p-2 text-slate-900 font-sans">
                <h3 class="font-bold text-sm text-rose-700">Estación Arroyo - Presidente Franco</h3>
                <p class="text-xs text-slate-600">Lat: ${lat}, Lon: ${lon}</p>
                <p class="text-xs font-semibold mt-1">Acumulado 48h: ${telemetry?.totalRainMm || 0} mm</p>
              </div>
            `).openPopup();
          }
        );
        return;
      } catch (e) {
        console.warn('Windy Map API init failed, falling back to Leaflet map:', e);
      }
    }

    if (window.L && mapContainerRef.current) {
      if (mapInstanceRef.current && mapInstanceRef.current.remove) {
        mapInstanceRef.current.remove();
      }
      mapContainerRef.current.innerHTML = '';

      const map = window.L.map(mapContainerRef.current).setView([lat, lon], 15);
      mapInstanceRef.current = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Windy Real API',
        maxZoom: 19,
      }).addTo(map);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: 'CartoDB Voyager',
        maxZoom: 19,
      }).addTo(map);

      const pulsingIcon = window.L.divIcon({
        className: 'custom-pulsing-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-rose-500 opacity-75"></span>
            <div class="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-2xl border-2 border-white">
              📍
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = window.L.marker([lat, lon], { icon: pulsingIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans">
          <h3 class="font-bold text-sm text-rose-700">Arroyo - Presidente Franco</h3>
          <p class="text-xs text-slate-600">Coordenadas: -25.5350698, -54.6327662</p>
          <p class="text-xs font-bold text-slate-800 mt-1">Estado: ${telemetry?.status || 'Esperando API Key'}</p>
        </div>
      `).openPopup();
    }
  }, [telemetry, windyApiKeyInput, mapMode]);

  const generateAiAdvisory = async () => {
    if (!telemetry) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalRainMm: telemetry.totalRainMm,
          status: telemetry.status,
          riverLevelMeters: telemetry.riverLevelMeters
        })
      });
      const data = await res.json();
      setAiAdvisory(data.advisory);
    } catch (err) {
      console.error('Error generating AI advisory:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const isEvacuation = telemetry?.status === 'ALERTA DE EVACUACIÓN';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl z-20">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${isEvacuation ? 'bg-rose-600 animate-bounce' : 'bg-blue-600'} text-white shadow-lg`}>
            <CloudRain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Alerta Temprana Inundaciones (API Real Windy)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                Presidente Franco, Paraguay
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>Lat: -25.5350698, Lon: -54.6327662 (ECMWF Model)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTelemetry()}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Datos</span>
          </button>

          <button
            onClick={() => setApiKeyModalOpen(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center gap-2 transition-all"
          >
            <Settings className="w-4 h-4" />
            <span>Configurar Windy API Key</span>
          </button>
        </div>
      </header>

      {/* API Error Banner if missing */}
      {apiError && (
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-6 py-3 text-rose-200 text-xs flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span><strong>Atención:</strong> {apiError}</span>
          </div>
          <button
            onClick={() => setApiKeyModalOpen(true)}
            className="px-3 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-bold"
          >
            Ingresar API Key Real
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Telemetry Panel */}
        <aside className="w-full lg:w-[32%] xl:w-[28%] bg-slate-900/95 border-r border-slate-800 p-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-120px)]">
          
          {/* Status Alert Card */}
          <div className={`p-5 rounded-2xl border transition-all shadow-xl ${
            isEvacuation 
              ? 'bg-gradient-to-br from-rose-950/90 via-rose-900/40 to-slate-900 border-rose-600/80 shadow-rose-950/50' 
              : telemetry?.badgeColor === 'amber'
              ? 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 border-amber-500/60'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/40'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Estado del Cauce (API Real)</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                isEvacuation 
                  ? 'bg-rose-600 text-white animate-pulse' 
                  : telemetry?.badgeColor === 'amber'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-600 text-white'
              }`}>
                {isEvacuation ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {telemetry?.status || (apiError ? 'Error de API' : 'Configure API Key')}
              </span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  {telemetry ? `${telemetry.totalRainMm}` : '--'} <span className="text-lg font-normal text-slate-400">mm</span>
                </span>
                <p className="text-xs text-slate-400 mt-1">Lluvia acumulada real (48h)</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-400">
                  {telemetry ? `${telemetry.riverLevelMeters}` : '--'} <span className="text-sm font-normal text-slate-400">m</span>
                </span>
                <p className="text-xs text-slate-400 mt-1">Nivel hídrico estimado</p>
              </div>
            </div>

            {/* Threshold Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Umbral de Seguridad (45 mm)</span>
                <span className={isEvacuation ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {telemetry ? Math.min(100, Math.round((telemetry.totalRainMm / 45) * 100)) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className={`h-full transition-all duration-500 ${
                    isEvacuation ? 'bg-rose-600' : telemetry?.totalRainMm && telemetry.totalRainMm > 25 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, ((telemetry?.totalRainMm || 0) / 45) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* AI Risk Assessment Briefing */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Asistente Hidrológico IA</span>
              </h3>
              <button
                onClick={generateAiAdvisory}
                disabled={aiLoading || !telemetry}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>Analizar Riesgo</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-2">
              {aiAdvisory || 'Configure su API Key de Windy para cargar datos reales y generar el informe hidrometeorológico basado en Gemini.'}
            </p>
          </div>

          {/* Google Maps Grounding Risk Check */}
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Google Maps - Zonas Críticas (24h)</span>
              </h3>
              <button
                onClick={fetchGoogleMapsRisk}
                disabled={gmapsLoading}
                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {gmapsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                <span>Verificar Zonas</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-2">
              {gmapsRiskSummary || 'Consulte los lugares en riesgo crítico para las próximas 24 horas en Presidente Franco utilizando datos geoespaciales de Google Maps.'}
            </p>
          </div>

          {/* Meteorological Parameters Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Thermometer className="w-4 h-4 text-amber-400" />
                <span>Temperatura Prom.</span>
              </div>
              <div className="text-lg font-bold text-white">
                {telemetry && telemetry.forecast.temp.length > 0 
                  ? `${Math.round(telemetry.forecast.temp.reduce((a,b)=>a+b,0)/telemetry.forecast.temp.length)}°C` 
                  : '--'}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Wind className="w-4 h-4 text-teal-400" />
                <span>Viento Máximo</span>
              </div>
              <div className="text-lg font-bold text-white">
                {telemetry && telemetry.forecast.wind.length > 0 
                  ? `${Math.max(...telemetry.forecast.wind)} km/h` 
                  : '--'}
              </div>
            </div>
          </div>

          {/* Monitoring Stations List */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Red de Sensores (Presidente Franco)</span>
            </h3>
            <div className="space-y-2.5">
              {telemetry?.stations.map((station) => (
                <div key={station.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">{station.name}</p>
                    <span className="text-slate-400 text-[10px]">Distancia: {station.distance}</span>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      station.status === 'Crítico' || station.status === 'Alerta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {station.reading}
                    </span>
                  </div>
                </div>
              )) || <p className="text-xs text-slate-500 text-center py-3">Sin datos de estaciones (Ingrese su API Key de Windy)</p>}
            </div>
          </div>
        </aside>

        {/* Right Side: Windy Map */}
        <main className="flex-1 relative flex flex-col bg-slate-900">
          <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Capa Activa: <strong className="text-white">Lluvia (ECMWF Real)</strong></span>
            </span>
          </div>

          <div ref={mapContainerRef} className="w-full flex-1 h-full min-h-[450px]"></div>

          <div className="bg-slate-900/95 border-t border-slate-800 px-6 py-2.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>Coordenadas de Monitoreo: <strong>-25.5350698, -54.6327662</strong> (Presidente Franco, Paraguay).</span>
            </div>
            <span className="text-slate-500">Conectado a Windy Point Forecast API v2</span>
          </div>
        </main>
      </div>

      {/* API Key Configuration Modal */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <span>Configurar Clave API de Windy</span>
              </h3>
              <button 
                onClick={() => setApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Para cumplir con el requerimiento de datos reales sin simulación, por favor ingrese su clave de API comercial de <strong>Windy API Key</strong>. Esta clave se enviará directamente a la Windy Point Forecast API v2 para Presidente Franco.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">WINDY_API_KEY</label>
                <input
                  type="text"
                  value={windyApiKeyInput}
                  onChange={(e) => setWindyApiKeyInput(e.target.value)}
                  placeholder="Ingrese su API Key real de Windy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setApiKeyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setApiKeyModalOpen(false);
                    fetchTelemetry(windyApiKeyInput);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                >
                  Consultar Datos Reales
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
