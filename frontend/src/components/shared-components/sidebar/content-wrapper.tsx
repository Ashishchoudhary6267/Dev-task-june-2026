'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/lib/zustand/sidebar/sidebar';
import styles from '@/components/shared-components/sidebar/sidebar.module.css';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/zustand/user/user';
import { Menu, LogOut, User, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import ProfileModal from '@/components/profile/profile-modal';
import { useNotificationSubscription } from '@/lib/hooks/useNotificationSubscription';
import { Button } from '@/components/ui';
import { HowToModal } from '@/components/how-to/how-to-modal';
import { AdminHowToModal } from '@/components/how-to/AdminHowToModal';
import { MemberHowToModal } from '@/components/how-to/memberHowTo';
import { ImpersonationBanner } from '../ImpersonationBanner';

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { isCollapsed, toggleMobileSidebar } = useSidebarStore();
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [profileOpen, setProfileOpen] = useState(false);
    const [isHowToOpen, setIsHowToOpen] = useState(false);


    // Initialise realtime notification subscription exactly once for the session.
    // NotificationBell UI components are pure renderers — they don't subscribe.
    useNotificationSubscription();

    const [isMounted, setIsMounted] = useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const noSidebarPages = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/landing',
        '/auth/pending',
        '/auth/callback'
    ];

    // No offset on auth pages
    const isFullWidth = noSidebarPages.some(page => pathname === page || pathname.startsWith(page + '/'));

    const userInitials = user?.name
        ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    return (
        <div className={cn(
            isFullWidth
                ? "w-full min-h-screen"
                : cn(styles.contentWrapper, isCollapsed ? styles.collapsed : styles.expanded)
        )}>
            <ImpersonationBanner />
            {/* Mobile Header — only shown on non-full-width pages */}
            {!isFullWidth && (
                <div className={cn(styles.mobileHeader, "mobile-nav-fade-transition")}>
                    {/* Hamburger */}
                    <button className={styles.burgerButton} onClick={toggleMobileSidebar}>
                        <Menu className="h-6 w-6" />
                    </button>

                    {/* Logo */}
                    <div className={styles.mobileLogo}>
                        {pathname !== '/landing' && (
                            <div
                                className={styles.logoIcon}
                                style={{ width: '32px', height: '32px', minWidth: '32px', fontSize: '14px' }}
                            >
                                F
                            </div>
                        )}
                    </div>

                    {/* Right side: Notifications + Avatar dropdown */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsHowToOpen(true)}
                            className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                        <NotificationBell />

                        <DropdownMenu>
                            <DropdownMenuTrigger className="outline-none group">
                                <Avatar className="h-8 w-8 ring-2 ring-background ring-offset-1 ring-offset-border/10 group-hover:ring-primary/20 transition-all duration-500 shadow-sm">
                                    <AvatarFallback className="bg-linear-to-br from-primary/10 to-primary/5 text-primary font-bold text-[10px]">
                                        {userInitials}
                                    </AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-64 p-2 shadow-2xl border-border/40 bg-background/95 backdrop-blur-xl mt-2">
                                {/* Identity card */}
                                <div className="px-3 py-4 mb-2 bg-linear-to-br from-primary/3 to-transparent rounded-xl border border-primary/5">
                                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-2 px-1">Identity</p>
                                    <div className="flex items-center gap-3 px-1">
                                        <Avatar className="h-10 w-10 border border-border/40 shadow-sm">
                                            <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                                                {userInitials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                                {user?.platform_role}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-1 space-y-1">
                                    {/* Profile & Settings */}
                                    <DropdownMenuItem
                                        onClick={() => setProfileOpen(true)}
                                        className="px-3 py-2.5 font-semibold rounded-lg group cursor-pointer"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                        Profile &amp; Settings
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    {/* Logout */}
                                    <DropdownMenuItem
                                        onClick={() => {
                                            logout();
                                            localStorage.clear();
                                            router.push('/landing');
                                        }}
                                        className="px-3 py-2.5 text-red-500 font-bold focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20 rounded-lg group cursor-pointer"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                            <LogOut className="h-4 w-4" />
                                        </div>
                                        Logout
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}

            {/* Page content */}
            {children}

            {/* Profile Modal — mounted here so it floats above everything on mobile */}
            <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />

            {user?.platform_role === 'controller' ?
                <HowToModal open={isHowToOpen} onOpenChange={setIsHowToOpen} />
                : user?.platform_role === 'admin' ?
                    <AdminHowToModal open={isHowToOpen} onOpenChange={setIsHowToOpen} />
                    : <MemberHowToModal open={isHowToOpen} onOpenChange={setIsHowToOpen} />
            }
        </div>
    );
}
