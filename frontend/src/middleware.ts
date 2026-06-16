import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const authCookie = request.cookies.get('auth-user')?.value;
    const publicRoutes = ['/', '/login', '/forgot-password', '/reset-password', '/register', '/landing', '/auth/callback', '/auth/pending'];
    let user = null;
    try {
        if (authCookie) {
            user = JSON.parse(authCookie);
        }
    } catch (e) {
        console.error('Failed to parse auth cookie', e);
    }

    const isAuthenticated = !!user;

    const isPublicRoute = publicRoutes.includes(pathname);

    // 🔹 1. If NOT authenticated → redirect to login
    if (
        !isAuthenticated &&
        !isPublicRoute &&
        !pathname.startsWith('/_next') &&
        pathname !== '/favicon.ico'
    ) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 🔹 2. If authenticated and visiting auth pages/root/dashboard
    if (
        isAuthenticated &&
        (isPublicRoute ||
            pathname === '/' ||
            pathname === '/dashboard')
    ) {
        let target = '/dashboard/member';

        if (user.platform_role === 'admin') {
            target = '/dashboard/admin';
        } else if (user.platform_role === 'controller') {
            target = '/dashboard/controller';
        } else if (user.platform_role === 'superadmin') {
            target = '/dashboard/superadmin';
        } else if (user.platform_role === 'member' && user.workflow_role === 'interim_manager') {
            target = '/dashboard/controller';
        }

        return NextResponse.redirect(new URL(target, request.url));
    }

    // 🔹 3. Role-based access control

    // Admin route protection
    if (
        isAuthenticated &&
        pathname.startsWith('/dashboard/admin') &&
        user.platform_role !== 'admin'
    ) {
        return NextResponse.redirect(
            new URL('/dashboard/member', request.url)
        );
    }

    // Controller route protection
    if (
        isAuthenticated &&
        pathname.startsWith('/dashboard/controller') &&
        user.platform_role !== 'controller' &&
        !(user.platform_role === 'member' && user.workflow_role === 'interim_manager')
    ) {
        return NextResponse.redirect(
            new URL('/dashboard/member', request.url)
        );
    }

    // Superadmin route protection
    if (
        isAuthenticated &&
        pathname.startsWith('/dashboard/superadmin') &&
        user.platform_role !== 'superadmin'
    ) {
        return NextResponse.redirect(
            new URL('/dashboard/member', request.url)
        );
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|icons/.*|assets/.*|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.mp3|.*\\.wav).*)',
    ],
};