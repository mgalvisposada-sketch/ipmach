import Link from 'next/link';

/**
 * Pages Router custom 404. Used by Next.js build to prerender /404
 * instead of the default _error (which uses Html from next/document and fails in production).
 * Do not import from next/document here.
 */
export default function Custom404() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900">404</h1>
                <p className="mt-2 text-gray-600">Página no encontrada</p>
                <Link
                    href="/"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                    Ir al inicio
                </Link>
            </div>
        </div>
    );
}
