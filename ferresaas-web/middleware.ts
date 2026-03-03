import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas explícitas (accesibles SIN autenticación)
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

// Rutas de autenticación (redirigen a /dashboard si YA hay sesión)
const AUTH_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Obtener cookie de refreshToken (HttpOnly, seteada por el backend)
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const hasSession = !!refreshToken;

  // Caso 1: Raíz "/" - redirigir según estado de sesión
  if (pathname === '/') {
    const target = hasSession ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Caso 2: Usuario CON sesión intenta acceder a ruta de auth (login, forgot, reset)
  if (hasSession && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Caso 3: Ruta pública - permitir acceso sin sesión
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Caso 4: Todo lo demás es PROTEGIDO por defecto
  // Si NO hay sesión, redirigir a login con returnUrl
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // Guardar la URL de destino para redirigir después del login
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuario autenticado accediendo a ruta protegida - permitir
  return NextResponse.next();
}

// Configurar qué rutas debe interceptar el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json, icons, sw.js (PWA assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)',
  ],
};
