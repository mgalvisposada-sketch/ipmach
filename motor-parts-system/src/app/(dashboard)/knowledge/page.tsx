'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

type BySourceItem = { source: string; type: string; count: number };
type Fragment = {
  id: number;
  content: string;
  source: string;
  type: string;
  created_at: string;
};

export default function KnowledgePage() {
  const { data: session } = useSession();
  const [total, setTotal] = useState<number>(0);
  const [bySource, setBySource] = useState<BySourceItem[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [source, setSource] = useState('manual');
  const [type, setType] = useState('admin');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfPreview, setPdfPreview] = useState('');
  const [extractedFullText, setExtractedFullText] = useState('');
  
  // Fragments management (paginated, load on demand)
  const PAGE_SIZE = 20;
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [fragmentsTotal, setFragmentsTotal] = useState(0);
  const [fragmentsPage, setFragmentsPage] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [fragmentsLoading, setFragmentsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedFragment, setSelectedFragment] = useState<Fragment | null>(null);
  const [showFragmentPreview, setShowFragmentPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSourceTypeHelp, setShowSourceTypeHelp] = useState(false);
  const [customSource, setCustomSource] = useState('');
  const [customType, setCustomType] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ipmach/knowledge/status');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setTotal(data.total ?? 0);
      setBySource(data.bySource ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar estado');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchFragments = useCallback(async (page: number = 0) => {
    setFragmentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (sourceFilter) params.set('source', sourceFilter);
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await fetch(`/api/ipmach/knowledge/fragments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch fragments');
      setFragments(data.fragments || []);
      setFragmentsTotal(data.total ?? 0);
      setFragmentsPage(page);
      setHasSearched(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar fragmentos');
    } finally {
      setFragmentsLoading(false);
    }
  }, [searchQuery, sourceFilter, typeFilter]);

  const handleDeleteFragment = async (id: number) => {
    if (!confirm('¿Eliminar este fragmento?')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/ipmach/knowledge/fragments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Fragmento eliminado');
      fetchFragments(fragmentsPage);
      fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSourceType = async (src: string, typ: string) => {
    if (!confirm(`¿Eliminar TODOS los fragmentos de ${src}/${typ}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/ipmach/knowledge/fragments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src, type: typ }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(data.message || 'Fragmentos eliminados');
      fetchFragments(0);
      fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    fetchStatus();
  }, [session?.user?.role, fetchStatus]);

  const extractPdfText = async (pdfFile: File): Promise<string> => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker path
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) { // Limit to first 50 pages for preview
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText.trim();
    } catch (err) {
      console.error('Error extracting PDF text:', err);
      throw new Error('No se pudo extraer el texto del PDF. Puede ser un PDF escaneado (imagen).');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (session?.user?.role !== 'admin') return;
    if (!file && !pastedText.trim()) {
      toast.error('Sube un archivo (PDF o TXT) o pega texto para indexar.');
      return;
    }

    // If it's a PDF file, extract and preview first
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setIngesting(true);
      try {
        const extractedText = await extractPdfText(file);
        setExtractedFullText(extractedText);
        setPdfPreview(extractedText.slice(0, 5000)); // First 5000 chars for preview
        setShowPreview(true);
        toast.success(`Extraído ${extractedText.length.toLocaleString()} caracteres. Revisa el preview.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al extraer PDF');
      } finally {
        setIngesting(false);
      }
      return;
    }

    // For text files or pasted text, proceed directly
    await proceedWithIngest();
  };

  const proceedWithIngest = async () => {
    if (session?.user?.role !== 'admin') return;

    setIngesting(true);
    try {
      const formData = new FormData();
      if (file) formData.set('file', file);
      
      // If we have extracted text from PDF, send it as text
      if (extractedFullText) {
        formData.set('text', extractedFullText);
      } else if (pastedText.trim()) {
        formData.set('text', pastedText.trim());
      }
      
      const sourceValue = source === 'other' ? customSource.trim() : source.trim() || 'manual';
      const typeValue = type === 'other' ? customType.trim() : type.trim() || 'catalog';
      formData.set('source', sourceValue || 'manual');
      formData.set('type', typeValue || 'catalog');

      const res = await fetch('/api/ipmach/knowledge/ingest', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Ingest failed');

      toast.success(data.message || `${data.inserted} fragmentos indexados.`);
      setFile(null);
      setPastedText('');
      setExtractedFullText('');
      setPdfPreview('');
      setShowPreview(false);
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al indexar');
    } finally {
      setIngesting(false);
    }
  };

  if (session?.user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso denegado</h3>
        <p className="mt-1 text-sm text-gray-500">Solo administradores pueden gestionar la base de conocimiento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Base de conocimiento IPMach</h1>
        <p className="mt-1 text-sm text-gray-500">
          Indexa archivos o texto para que el asistente de /ipmach pueda responder con esta información.
        </p>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Resumen</h2>
          <button
            onClick={() => {
              fetchStatus();
              fetchFragments();
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Actualizar
          </button>
        </div>
        {statusLoading ? (
          <p className="mt-2 text-sm text-gray-500">Cargando…</p>
        ) : (
          <>
            <p className="mt-2 text-lg font-medium text-gray-900">Total: {total} fragmentos</p>
            {bySource.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bySource.map((r) => (
                  <div
                    key={`${r.source}-${r.type}`}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div>
                      <p className="text-xs text-blue-600 font-medium">{r.source}</p>
                      <p className="text-xs text-blue-500">{r.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-700">{r.count}</span>
                      <button
                        onClick={() => handleDeleteSourceType(r.source, r.type)}
                        disabled={deleting}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Eliminar todos"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fragments Browser */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Explorar Fragmentos Indexados</h2>
          
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en contenido..."
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas las fuentes</option>
              {Array.from(new Set(bySource.map(r => r.source))).map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              {Array.from(new Set(bySource.map(r => r.type))).map(typ => (
                <option key={typ} value={typ}>{typ}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => fetchFragments(0)}
            disabled={fragmentsLoading}
            className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {fragmentsLoading ? 'Buscando...' : 'Buscar fragmentos'}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Usa filtros y clic en &quot;Buscar fragmentos&quot; para cargar resultados (20 por página).
          </p>
        </div>

        {/* Fragments Table - only shown after search, with pagination */}
        {hasSearched && (
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              {fragmentsLoading ? (
                <div className="p-8 text-center text-gray-500">Cargando...</div>
              ) : fragments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No se encontraron fragmentos con estos filtros.
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente / Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contenido (Preview)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {fragments.map((fragment) => (
                        <tr key={fragment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-xs">
                              <p className="font-medium text-blue-600">{fragment.source}</p>
                              <p className="text-gray-500">{fragment.type}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-700 line-clamp-2">
                              {fragment.content.slice(0, 150)}...
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(fragment.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedFragment(fragment);
                                  setShowFragmentPreview(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                              >
                                Ver
                              </button>
                              <button
                                onClick={() => handleDeleteFragment(fragment.id)}
                                disabled={deleting}
                                className="text-red-600 hover:text-red-700 font-medium text-xs disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm">
                    <span className="text-gray-600">
                      Mostrando {fragmentsPage * PAGE_SIZE + 1}-{Math.min((fragmentsPage + 1) * PAGE_SIZE, fragmentsTotal)} de {fragmentsTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchFragments(fragmentsPage - 1)}
                        disabled={fragmentsPage === 0 || fragmentsLoading}
                        className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => fetchFragments(fragmentsPage + 1)}
                        disabled={(fragmentsPage + 1) * PAGE_SIZE >= fragmentsTotal || fragmentsLoading}
                        className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ingest form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">Indexar nuevo contenido</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Archivo (PDF o TXT)</label>
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">O pega texto aquí</label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Pega manuales, FAQs, horarios, descripciones..."
          />
        </div>

        {/* Origen y Tipo: instrucciones y presets */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <button
            type="button"
            onClick={() => setShowSourceTypeHelp(!showSourceTypeHelp)}
            className="flex items-center gap-2 text-sm font-medium text-blue-800 hover:text-blue-900"
          >
            {showSourceTypeHelp ? '▼' : '▶'} ¿Qué pongo en Origen y Tipo?
          </button>
          {showSourceTypeHelp && (
            <div className="mt-3 text-sm text-blue-900/90 space-y-2">
              <p>
                <strong>Origen</strong> = de dónde viene el contenido (ej: manual, catálogo 2025, faq).
                <br />
                <strong>Tipo</strong> = qué clase de información es (ej: catalog = productos/part numbers, admin = horarios/contacto/FAQs).
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Texto pegado (horarios, contacto, preguntas frecuentes) → Origen: <code className="bg-blue-100 px-1 rounded">manual</code>, Tipo: <code className="bg-blue-100 px-1 rounded">admin</code></li>
                <li>PDF o archivo de catálogo de productos → Origen: <code className="bg-blue-100 px-1 rounded">catalog-2025</code> (o el año), Tipo: <code className="bg-blue-100 px-1 rounded">catalog</code></li>
                <li>Manuales o documentación técnica → Origen: <code className="bg-blue-100 px-1 rounded">manual</code>, Tipo: <code className="bg-blue-100 px-1 rounded">catalog</code> o <code className="bg-blue-100 px-1 rounded">manual</code></li>
              </ul>
              <p className="text-xs text-blue-700">
                En el asistente IPMach podrás filtrar por Origen para buscar solo en un tipo de contenido.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Origen</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="manual">manual (texto pegado, FAQs, horarios)</option>
              <option value="catalog-2025">catalog-2025 (PDF catálogo)</option>
              <option value="catalog-2024">catalog-2024</option>
              <option value="faq">faq</option>
              <option value="other">Otro (escribir abajo)</option>
            </select>
            {source === 'other' && (
              <input
                type="text"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                placeholder="Ej: mi-catalogo"
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="admin">admin (horarios, contacto, información general)</option>
              <option value="catalog">catalog (productos, part numbers)</option>
              <option value="faq">faq</option>
              <option value="manual">manual</option>
              <option value="other">Otro (escribir abajo)</option>
            </select>
            {type === 'other' && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Ej: manual-tecnico"
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Resumen: este contenido se indexará como <strong>{source === 'other' ? (customSource || '…') : source}</strong> / <strong>{type === 'other' ? (customType || '…') : type}</strong>
        </p>

        <button
          type="submit"
          disabled={
            ingesting ||
            (!file && !pastedText.trim() && !extractedFullText) ||
            (source === 'other' && !customSource.trim()) ||
            (type === 'other' && !customType.trim())
          }
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ingesting ? 'Indexando…' : 'Indexar'}
        </button>
      </form>

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Vista previa del texto extraído</h3>
              <p className="mt-1 text-sm text-gray-600">
                Total: {extractedFullText.length.toLocaleString()} caracteres
                {extractedFullText.length > 5000 && ' (mostrando primeros 5,000)'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Verifica que los números de parte y la información importante estén presentes antes de indexar.
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-xs bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap font-mono">
                {pdfPreview}
                {extractedFullText.length > 5000 && '\n\n... (texto continúa)'}
              </pre>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPdfPreview('');
                  setExtractedFullText('');
                  setFile(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => proceedWithIngest()}
                disabled={ingesting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ingesting ? 'Indexando…' : 'Confirmar e Indexar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fragment Preview Modal */}
      {showFragmentPreview && selectedFragment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Detalle del Fragmento</h3>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  {selectedFragment.source}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {selectedFragment.type}
                </span>
                <span className="text-gray-500">
                  ID: {selectedFragment.id}
                </span>
                <span className="text-gray-500">
                  {new Date(selectedFragment.created_at).toLocaleString('es-ES')}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap leading-relaxed">
                {selectedFragment.content}
              </pre>
              <p className="mt-4 text-xs text-gray-500">
                Longitud: {selectedFragment.content.length} caracteres
              </p>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowFragmentPreview(false);
                  setSelectedFragment(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  handleDeleteFragment(selectedFragment.id);
                  setShowFragmentPreview(false);
                  setSelectedFragment(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar este fragmento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
