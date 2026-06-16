'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/lib/zustand/sidebar/sidebar';
import { useAuthStore } from '@/lib/zustand/user/user';
import { Avatar, AvatarFallback, Badge } from '@/components/ui';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
    LayoutDashboard,
    GitBranch,
    CheckSquare,
    Calendar,
    Users,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    ChevronsLeft,
    User,
    MessageSquare,
    File,
    CheckSquare2,
    Zap,
    CalendarClock,
} from 'lucide-react';
import styles from './sidebar.module.css';
import { useRouter, usePathname } from 'next/navigation';
import { NavItem } from '@/lib/types/auth';
import ProfileModal from '@/components/profile/profile-modal';
import { usePermissions } from '@/lib/hooks/usePermissions';



const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { isCollapsed, toggleSidebar, isMobileOpen, setMobileOpen } = useSidebarStore();
    const { user, logout } = useAuthStore();
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { hasAccess } = usePermissions();

    if (pathname === '/login' || pathname === '/landing' || pathname === '/auth/pending' || pathname === '/auth/callback' || pathname === '/forgot-password' || pathname === '/reset-password' || pathname === '/register' || user?.platform_role === 'admin') return null;

    const handleLogout = () => {
        logout();
        localStorage.clear();
        router.push('/landing');
    };

    const handleNavClick = (path: string) => {
        router.push(path);
        // Automatically close on mobile after navigation
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setMobileOpen(false);
        }
    };

    const userInitials = user?.name
        ? user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'U';

    const isActive = (path: string) => pathname === path;

    return (
        <>
            {/* Sidebar Overlay (Mobile Only) */}
            <div
                className={cn(styles.overlay, isMobileOpen && styles.show)}
                onClick={() => setMobileOpen(false)}
            />

            <aside className={cn(
                styles.sidebar,
                isCollapsed ? styles.collapsed : styles.expanded,
                isMobileOpen && styles.mobileOpen
            )}>

                {/* Toggle (Hidden on Mobile via CSS) */}
                <button
                    onClick={toggleSidebar}
                    className={styles.toggleButton}
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>

                {/* Logo */}
                <div className={styles.logoArea} onClick={() => handleNavClick('/dashboard')}>
                    <div className={styles.logoIcon}>F</div>
                    <div className={cn(styles.logoText, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                        <span className={styles.logoTitle}>FMS</span>
                        <span className={styles.logoSubtitle}>Flow Manager</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className={cn(styles.nav, (isCollapsed && !isMobileOpen) && styles.hidden)}>



                    {/* Dashboard */}
                    <button
                        onClick={() => handleNavClick('/dashboard')}
                        className={cn(styles.navItem, isActive('/dashboard') && styles.active)}
                    >
                        <LayoutDashboard className="h-5 w-5" />
                        <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                            Dashboard
                        </span>
                    </button>

                    {/* Dashboard for Controller */}
                    {(user?.platform_role === 'controller' || (user?.platform_role === 'member' && user?.workflow_role === 'interim_manager')) && (
                        <div>
                            <button
                                onClick={() => handleNavClick('/dashboard/controller/own-tasks')}
                                className={cn(styles.navItem, isActive('/dashboard/controller/own-tasks') && styles.active)}
                            >
                                <CheckSquare2 className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Own Tasks
                                </span>
                            </button>


                            <button
                                onClick={() => handleNavClick('/dashboard/controller/notifications')}
                                className={cn(styles.navItem, isActive('/dashboard/controller/notifications') && styles.active)}
                            >
                                <MessageSquare className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Notifications
                                </span>
                            </button>

                            {(user?.workflow_role === 'interim_manager' || hasAccess('reports', 'read')) && (
                                <button
                                    onClick={() => handleNavClick('/dashboard/controller/performance-metrics')}
                                    className={cn(styles.navItem, isActive('/dashboard/controller/performance-metrics') && styles.active)}
                                >
                                    <BarChart3 className="h-5 w-5" />
                                    <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                        Performance Metrics
                                    </span>
                                </button>
                            )}

                            {(user?.workflow_role === 'interim_manager' || hasAccess('projects', 'read')) && (
                                <button
                                    onClick={() => handleNavClick('/dashboard/controller/templates')}
                                    className={cn(styles.navItem, isActive('/dashboard/controller/templates') && styles.active)}
                                >
                                    <File className="h-5 w-5" />
                                    <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                        Templates
                                    </span>
                                </button>
                            )}

                            {(user?.workflow_role === 'interim_manager' || hasAccess('tasks', 'read')) && (
                                <button
                                    onClick={() => handleNavClick('/dashboard/controller/manual-tasks')}
                                    className={cn(styles.navItem, isActive('/dashboard/controller/manual-tasks') && styles.active)}
                                >
                                    <CheckSquare className="h-5 w-5" />
                                    <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                        Manual Tasks
                                    </span>
                                </button>
                            )}
                        </div>
                    )}


                    {/* Member dashboard */}
                    {(user?.platform_role === 'member' && user?.workflow_role !== 'interim_manager') && (
                        <div>
                            <button
                                onClick={() => handleNavClick('/dashboard/member/company')}
                                className={cn(styles.navItem, isActive('/dashboard/member/company') && styles.active)}
                            >
                                <Users className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Company
                                </span>
                            </button>

                            <button
                                onClick={() => handleNavClick('/dashboard/member/sla_requests')}
                                className={cn(styles.navItem, isActive('/dashboard/member/sla_requests') && styles.active)}
                            >
                                <CalendarClock className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    TAT Requests
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Super Admin Dashboard */}
                    {user?.platform_role === 'superadmin' && (
                        <div>

                            <button
                                onClick={() => handleNavClick('/dashboard/superadmin/companies')}
                                className={cn(styles.navItem, isActive('/dashboard/superadmin/companies') && styles.active)}
                            >
                                <Users className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Companies
                                </span>
                            </button>

                            <button
                                onClick={() => handleNavClick('/dashboard/superadmin/templates')}
                                className={cn(styles.navItem, isActive('/dashboard/superadmin/templates') && styles.active)}
                            >
                                <File className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Global Templates
                                </span>
                            </button>

                            <button
                                onClick={() => handleNavClick('/dashboard/superadmin/ai-assistant')}
                                className={cn(styles.navItem, isActive('/dashboard/superadmin/ai-assistant') && styles.active)}
                            >
                                <MessageSquare className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    AI Assistant
                                </span>
                            </button>
                        </div>
                    )}

                </nav>

                {/* User Section */}
                <div className={styles.userSection}>
                    <div className='hidden sm:flex'>
                        <div className={styles.userCard} onClick={() => setShowProfileModal(true)} >
                            <Avatar size="sm">
                                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                                    {userInitials}
                                </AvatarFallback>
                            </Avatar>

                            <div className={cn(styles.userInfo, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                <div className={styles.userName}>{user?.name || 'User'}</div>
                                <div className={styles.userRole}>{user?.platform_role || 'Member'}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className={cn(styles.navItem, 'mt-1 text-destructive hover:bg-destructive/10')}
                    >
                        <LogOut className="h-4 w-4" />
                        <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                            Log out
                        </span>
                    </button>

                </div>
                <ProfileModal open={showProfileModal} onOpenChange={setShowProfileModal} />
            </aside>
        </>
    );
};


export default Sidebar;