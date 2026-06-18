'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useApiCall } from '@/lib/api-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DataInfo {
  searchLogs: {
    count: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  };
  userSessions: {
    count: number;
  };
  warning: string;
}

export function ClearDataModal({ isOpen, onClose, onSuccess }: Props) {
  const apiCall = useApiCall();
  const [dataInfo, setDataInfo] = useState<DataInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'warning' | 'confirm' | 'success'>('warning');
  const [deletedData, setDeletedData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDataInfo();
      // Reset state when modal opens
      setPassword('');
      setConfirmText('');
      setError('');
      setStep('warning');
      setDeletedData(null);
    }
  }, [isOpen]);

  const fetchDataInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const response = await fetch('/api/analytics/clear-data', {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        setDataInfo(result.data);
      } else {
        console.error('Error al obtener información de datos:', response.status);
      }
    } catch (error) {
      console.error('Error fetching data info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleClearData = async () => {
    if (!password) {
      setError('Debes ingresar tu contraseña');
      return;
    }

    if (confirmText !== 'BORRAR DATOS') {
      setError('Debes escribir "BORRAR DATOS" exactamente');
      return;
    }

    setError('');
    setIsDeleting(true);

    try {
      console.log('[ClearData] Enviando petición de limpieza...');
      
      const response = await fetch('/api/analytics/clear-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, confirmText }),
        credentials: 'include',
      });

      console.log('[ClearData] Respuesta recibida:', response.status);

      const result = await response.json();

      if (!response.ok) {
        // Log como warning si es error de validación (400, 403), como error si es del servidor
        if (response.status >= 500) {
          console.error('[ClearData] Error del servidor:', result.error);
        } else {
          console.warn('[ClearData] Validación fallida:', result.error);
        }
        setError(result.error || 'Error al limpiar datos');
        setIsDeleting(false);
        return;
      }

      console.log('[ClearData] Datos de respuesta:', result);

      console.log('[ClearData] Limpieza exitosa:', result.deleted);
      setDeletedData(result);
      setStep('success');
      
      // Auto-close after 3 seconds and reload
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } catch (error) {
      console.error('[ClearData] Error crítico de conexión:', error);
      setError('Error de conexión. Intenta nuevamente.');
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                {/* Header */}
                <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                      </div>
                      <Dialog.Title className="text-lg font-semibold text-red-900">
                        {step === 'success'
                          ? 'Datos Eliminados'
                          : 'Limpiar Datos Históricos'}
                      </Dialog.Title>
                    </div>
                    {!isDeleting && (
                      <button
                        onClick={handleClose}
                        className="rounded-lg p-2 hover:bg-red-100 transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {step === 'warning' && (
                    <>
                      {/* Warning Section */}
                      <div className="mb-4">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                          <div className="flex items-start gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                              <p className="font-semibold mb-2">⚠️ Acción Irreversible</p>
                              <p>
                                Esta acción eliminará permanentemente todos los datos históricos de
                                búsquedas y sesiones. No se pueden recuperar una vez eliminados.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Data Info */}
                        {isLoadingInfo ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                          </div>
                        ) : dataInfo ? (
                          <div className="space-y-3">
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                Datos a Eliminar:
                              </h4>
                              <ul className="space-y-2 text-sm text-gray-700">
                                <li className="flex justify-between">
                                  <span>Registros de búsqueda:</span>
                                  <span className="font-semibold">
                                    {dataInfo.searchLogs.count.toLocaleString()}
                                  </span>
                                </li>
                                <li className="flex justify-between">
                                  <span>Sesiones de usuario:</span>
                                  <span className="font-semibold">
                                    {dataInfo.userSessions.count.toLocaleString()}
                                  </span>
                                </li>
                                {dataInfo.searchLogs.oldestRecord && (
                                  <li className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                                    <span className="text-xs text-gray-500">
                                      Registro más antiguo:
                                    </span>
                                    <span className="font-medium">
                                      {formatDate(dataInfo.searchLogs.oldestRecord)}
                                    </span>
                                  </li>
                                )}
                              </ul>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-sm text-blue-800">
                                <span className="font-semibold">Nota:</span> Los usuarios,
                                cotizaciones y órdenes NO serán eliminados. Solo se limpiarán los
                                datos de análisis (búsquedas y sesiones).
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => setStep('confirm')}
                        disabled={isLoadingInfo}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continuar con la Eliminación
                      </button>
                    </>
                  )}

                  {step === 'confirm' && (
                    <>
                      <div className="space-y-4 mb-4">
                        <p className="text-sm text-gray-700">
                          Para confirmar la eliminación, completa los siguientes pasos:
                        </p>

                        {/* Password Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            1. Ingresa tu contraseña de administrador
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tu contraseña"
                            disabled={isDeleting}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Confirmation Text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            2. Escribe{' '}
                            <span className="font-bold text-red-600">&quot;BORRAR DATOS&quot;</span> para
                            confirmar
                          </label>
                          <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="BORRAR DATOS"
                            disabled={isDeleting}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Error Message */}
                        {error && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-800">{error}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setStep('warning')}
                          disabled={isDeleting}
                          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Atrás
                        </button>
                        <button
                          onClick={handleClearData}
                          disabled={
                            isDeleting ||
                            !password ||
                            confirmText !== 'BORRAR DATOS'
                          }
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isDeleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Eliminando...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4" />
                              Eliminar Datos
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {step === 'success' && deletedData && (
                    <div className="text-center py-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="rounded-full bg-green-100 p-3">
                          <CheckCircleIcon className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Datos Eliminados Exitosamente
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                        <p className="text-sm text-gray-700 mb-2">Registros eliminados:</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>
                            • Búsquedas: {deletedData.deleted.searchLogs.toLocaleString()}
                          </li>
                          <li>
                            • Sesiones: {deletedData.deleted.userSessions.toLocaleString()}
                          </li>
                        </ul>
                      </div>
                      <p className="text-sm text-gray-600">
                        Esta ventana se cerrará automáticamente...
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
