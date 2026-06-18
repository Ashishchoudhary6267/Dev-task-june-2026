'use client';

import React, { useState, useEffect } from 'react';
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
    Activity,
    AlertCircle,
    AlertTriangle,
    Shield,
} from 'lucide-react';
import styles from './sidebar.module.css';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { NavItem } from '@/lib/types/auth';
import ProfileModal from '@/components/profile/profile-modal';
import { usePermissions } from '@/lib/hooks/usePermissions';



const Sidebar = () => {
    const [isMounted, setIsMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');
    const { isCollapsed, toggleSidebar, isMobileOpen, setMobileOpen } = useSidebarStore();
    const { user, logout } = useAuthStore();
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { hasAccess } = usePermissions();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    const noSidebarPaths = [
        '/login',
        '/landing',
        '/auth/pending',
        '/auth/callback',
        '/forgot-password',
        '/reset-password',
        '/register'
    ];

    if (noSidebarPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) return null;

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
                        className={cn(styles.navItem, (pathname === '/dashboard' || pathname === '/dashboard/controller' || pathname === '/dashboard/admin') && styles.active)}
                    >
                        <LayoutDashboard className="h-5 w-5" />
                        <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                            Dashboard
                        </span>
                    </button>

                    {/* Admin Dashboard Sub-tabs */}
                    {user?.platform_role === 'admin' && (
                        <div className={cn("flex flex-col gap-1 my-1", !isCollapsed && "pl-4 border-l border-border/50 ml-4")}>
                            {/* Users */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=users')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && (currentTab === 'users' || !currentTab)) && styles.active)}
                            >
                                <Users className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Users
                                </span>
                            </button>

                            {/* Templates */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=templates')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'templates') && styles.active)}
                            >
                                <File className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Templates
                                </span>
                            </button>

                            {/* Clients */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=clients')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'clients') && styles.active)}
                            >
                                <Activity className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Clients
                                </span>
                            </button>

                            {/* Permissions */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=permissions')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'permissions') && styles.active)}
                            >
                                <Shield className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Permissions
                                </span>
                            </button>

                            {/* Performance */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=performance')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'performance') && styles.active)}
                            >
                                <BarChart3 className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Performance
                                </span>
                            </button>

                            {/* Reports */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=reports')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'reports') && styles.active)}
                            >
                                <File className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Reports
                                </span>
                            </button>

                            {/* Settings */}
                            <button
                                onClick={() => handleNavClick('/dashboard/admin?tab=settings')}
                                className={cn(styles.navItem, (pathname === '/dashboard/admin' && currentTab === 'settings') && styles.active)}
                            >
                                <Settings className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Settings
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Controller Dashboard Sub-tabs */}
                    {(user?.platform_role === 'controller' || (user?.platform_role === 'member' && user?.workflow_role === 'interim_manager')) && (
                        <div className={cn("flex flex-col gap-1 my-1", !isCollapsed && "pl-4 border-l border-border/50 ml-4")}>
                            {/* Active Instances */}
                            <button
                                onClick={() => handleNavClick('/dashboard/controller?tab=instances')}
                                className={cn(styles.navItem, (pathname === '/dashboard/controller' && (currentTab === 'instances' || !currentTab)) && styles.active)}
                            >
                                <Activity className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Active Instances
                                </span>
                            </button>

                            {/* Team Members */}
                            <button
                                onClick={() => handleNavClick('/dashboard/controller?tab=users')}
                                className={cn(styles.navItem, (pathname === '/dashboard/controller' && currentTab === 'users') && styles.active)}
                            >
                                <Users className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Team Members
                                </span>
                            </button>

                            {/* Overdue Task */}
                            <button
                                onClick={() => handleNavClick('/dashboard/controller?tab=overdue')}
                                className={cn(styles.navItem, (pathname === '/dashboard/controller' && currentTab === 'overdue') && styles.active)}
                            >
                                <AlertCircle className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Overdue Task
                                </span>
                            </button>

                            {/* Task Rejections */}
                            <button
                                onClick={() => handleNavClick('/dashboard/controller?tab=rejections')}
                                className={cn(styles.navItem, (pathname === '/dashboard/controller' && currentTab === 'rejections') && styles.active)}
                            >
                                <AlertTriangle className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    Task Rejections
                                </span>
                            </button>

                            {/* SLA Request */}
                            <button
                                onClick={() => handleNavClick('/dashboard/controller?tab=sla-requests')}
                                className={cn(styles.navItem, (pathname === '/dashboard/controller' && currentTab === 'sla-requests') && styles.active)}
                            >
                                <CalendarClock className="h-5 w-5" />
                                <span className={cn(styles.navItemLabel, (isCollapsed && !isMobileOpen) && styles.hidden)}>
                                    SLA Request
                                </span>
                            </button>
                        </div>
                    )}


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